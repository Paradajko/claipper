import { NextResponse } from "next/server";
import { storageBuckets } from "@/lib/stream-scan-config";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .insert({
      video_id: idea.video_id,
      clip_idea_id: idea.id,
      title: idea.title,
      start_seconds: idea.start_time,
      end_seconds: idea.end_time,
      duration_seconds: idea.end_time - idea.start_time,
      hook: idea.hook,
      caption: idea.caption,
      content_type: idea.clip_type,
      score: idea.score,
      status: "editing",
      render_status: "queued",
      type: "ready",
      storage_bucket: storageBuckets.clips,
      raw_data: { created_from: "clip_idea", render_requested_at: new Date().toISOString(), target_aspect_ratio: "9:16" }
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
    step: "queued"
  });

  if (jobError) {
    return redirectWithError(request, `/app/content-lab/${idea.video_id}`, jobError.message);
  }

  return NextResponse.redirect(new URL(`/app/content-lab/${idea.video_id}`, request.url), { status: 303 });
}

function redirectWithError(request: Request, path: string, message: string) {
  return NextResponse.redirect(new URL(`${path}?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
}
