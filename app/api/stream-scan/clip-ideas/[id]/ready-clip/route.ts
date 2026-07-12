import { NextResponse } from "next/server";
import { z } from "zod";
import { storageBuckets } from "@/lib/stream-scan-config";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const optionalNumber = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().optional()
);
const formBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean()
);
const editPlanSchema = z.object({
  startSeconds: z.coerce.number().min(0),
  endSeconds: z.coerce.number().positive(),
  hookMode: z.enum(["natural", "cold_open"]).default("natural"),
  hookStartSeconds: optionalNumber,
  hookEndSeconds: optionalNumber,
  framingMode: z.enum(["left", "center", "right"]).default("center"),
  backgroundMode: z.enum(["crop", "blur"]).default("crop"),
  subtitlePreset: z.literal("creator").default("creator"),
  addCaptions: formBoolean,
  enhanceEnabled: formBoolean
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for ready clip generation." }, { status: 503 });
  }

  const { data: idea, error: ideaError } = await supabase
    .from("clip_ideas")
    .select("*")
    .eq("id", id)
    .single();

  if (ideaError || !idea) {
    return redirectWithError(request, "/app/content-lab", "Clip idea not found.");
  }

  const parsedResult = editPlanSchema.safeParse({
    startSeconds: formData.get("startSeconds") ?? idea.start_time,
    endSeconds: formData.get("endSeconds") ?? idea.end_time,
    hookMode: formData.get("hookMode") ?? "natural",
    hookStartSeconds: formData.get("hookStartSeconds"),
    hookEndSeconds: formData.get("hookEndSeconds"),
    framingMode: formData.get("framingMode") ?? "center",
    backgroundMode: formData.get("backgroundMode") ?? "crop",
    subtitlePreset: formData.get("subtitlePreset") ?? "creator",
    addCaptions: formData.get("addCaptions"),
    enhanceEnabled: formData.get("enhanceEnabled")
  });
  if (!parsedResult.success) {
    return NextResponse.json({ error: "Invalid ready clip edit settings." }, { status: 400 });
  }

  const parsed = parsedResult.data;
  const duration = parsed.endSeconds - parsed.startSeconds;
  const allowedStart = Math.max(0, Number(idea.start_time) - 20);
  const allowedEnd = Number(idea.end_time) + 20;
  const coldOpenDuration = (parsed.hookEndSeconds ?? 0) - (parsed.hookStartSeconds ?? 0);
  const coldOpenValid =
    parsed.hookMode === "natural" ||
    (parsed.hookStartSeconds !== undefined &&
      parsed.hookEndSeconds !== undefined &&
      parsed.hookStartSeconds >= parsed.startSeconds &&
      parsed.hookEndSeconds <= parsed.endSeconds &&
      coldOpenDuration >= 1 &&
      coldOpenDuration <= 3);
  if (
    duration <= 0 ||
    duration < 20 ||
    duration > 60 ||
    parsed.startSeconds < allowedStart ||
    parsed.endSeconds > allowedEnd ||
    !coldOpenValid
  ) {
    return NextResponse.json({ error: "Ready clip timing is outside the grounded moment range." }, { status: 400 });
  }

  const addCaptions = parsed.addCaptions;
  const editPlan = {
    version: 1 as const,
    start_seconds: parsed.startSeconds,
    end_seconds: parsed.endSeconds,
    hook_mode: parsed.hookMode,
    hook_start_seconds: parsed.hookMode === "cold_open" ? parsed.hookStartSeconds! : null,
    hook_end_seconds: parsed.hookMode === "cold_open" ? parsed.hookEndSeconds! : null,
    framing_mode: parsed.framingMode,
    background_mode: parsed.backgroundMode,
    subtitle_preset: parsed.subtitlePreset,
    add_captions: addCaptions,
    enhance_enabled: parsed.enhanceEnabled
  };

  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .insert({
      video_id: idea.video_id,
      clip_idea_id: idea.id,
      title: idea.title,
      start_seconds: editPlan.start_seconds,
      end_seconds: editPlan.end_seconds,
      duration_seconds: editPlan.end_seconds - editPlan.start_seconds,
      hook: idea.hook,
      caption: idea.caption,
      content_type: idea.clip_type,
      score: idea.score,
      status: "editing",
      render_status: "queued",
      type: "ready",
      storage_bucket: storageBuckets.clips,
      raw_data: {
        created_from: "clip_idea",
        render_requested_at: new Date().toISOString(),
        target_aspect_ratio: "9:16",
        add_captions: addCaptions,
        add_hook_overlay: false,
        edit_plan: editPlan
      }
    })
    .select("id")
    .single();

  if (clipError || !clip) {
    return redirectWithError(request, `/app/content-lab/${idea.video_id}`, clipError?.message ?? "Could not create ready clip record.");
  }

  const { error: jobError } = await supabase.from("processing_jobs").insert({
    video_id: idea.video_id,
    clip_idea_id: idea.id,
    clip_id: clip.id,
    job_type: "render_ready_clip",
    status: "queued",
    progress_percent: 0,
    current_step: "queued",
    step: "queued",
    raw_data: { add_captions: addCaptions, add_hook_overlay: false, edit_plan: editPlan }
  });

  if (jobError) {
    return redirectWithError(request, `/app/content-lab/${idea.video_id}`, jobError.message);
  }

  return NextResponse.redirect(new URL(`/app/content-lab/${idea.video_id}`, request.url), { status: 303 });
}

function redirectWithError(request: Request, path: string, message: string) {
  return NextResponse.redirect(new URL(`${path}?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
}
