import { NextResponse } from "next/server";
import { storageBuckets } from "@/lib/stream-scan-config";
import { getSupabaseAdmin } from "@/lib/supabase";
import { editPlanSchema, isGroundedReadyClipTiming } from "./ready-clip-validation";

export const runtime = "nodejs";

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
  if (!isGroundedReadyClipTiming(parsed, Number(idea.start_time), Number(idea.end_time))) {
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

  const clipRawData = {
    created_from: "clip_idea",
    render_requested_at: new Date().toISOString(),
    target_aspect_ratio: "9:16",
    add_captions: addCaptions,
    add_hook_overlay: false,
    edit_plan: editPlan
  };
  const jobRawData = { add_captions: addCaptions, add_hook_overlay: false, edit_plan: editPlan };
  const { error: queueError } = await supabase
    .rpc("queue_ready_clip_render", {
      p_video_id: idea.video_id,
      p_clip_idea_id: idea.id,
      p_title: idea.title,
      p_start_seconds: editPlan.start_seconds,
      p_end_seconds: editPlan.end_seconds,
      p_hook: idea.hook,
      p_caption: idea.caption,
      p_content_type: idea.clip_type,
      p_score: idea.score,
      p_storage_bucket: storageBuckets.clips,
      p_clip_raw_data: clipRawData,
      p_job_raw_data: jobRawData
    })
    .single();

  if (queueError) {
    return redirectWithError(request, `/app/content-lab/${idea.video_id}`, queueError.message);
  }

  return NextResponse.redirect(new URL(`/app/content-lab/${idea.video_id}`, request.url), { status: 303 });
}

function redirectWithError(request: Request, path: string, message: string) {
  return NextResponse.redirect(new URL(`${path}?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
}
