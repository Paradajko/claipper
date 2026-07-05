import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { streamScanFlags } from "@/lib/stream-scan-config";

export const runtime = "nodejs";

const requestSchema = z.object({
  videoId: z.string().uuid(),
  bucket: z.string().min(1),
  storagePath: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload completion request." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for upload completion." }, { status: 503 });
  }

  const { videoId, bucket, storagePath } = parsed.data;
  const { data: video, error: loadError } = await supabase
    .from("videos")
    .select("id, storage_bucket, storage_path")
    .eq("id", videoId)
    .single();

  if (loadError || !video || video.storage_bucket !== bucket || video.storage_path !== storagePath) {
    return NextResponse.json({ error: "Upload completion did not match the created upload session." }, { status: 400 });
  }

  const nextStatus = streamScanFlags.workerProcessing ? "queued" : "uploaded";
  const { error: updateError } = await supabase
    .from("videos")
    .update({
      status: nextStatus,
      progress_percent: streamScanFlags.workerProcessing ? 5 : 100,
      progress_text: streamScanFlags.workerProcessing
        ? "Video uploaded. Waiting for processing worker."
        : "Video uploaded. Processing worker is not connected.",
      updated_at: new Date().toISOString()
    })
    .eq("id", videoId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (streamScanFlags.workerProcessing) {
    const { error: jobError } = await supabase.from("processing_jobs").insert({
      video_id: videoId,
      job_type: "analyze_video",
      status: "queued",
      progress_percent: 0,
      current_step: "queued",
      step: "queued"
    });
    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, videoId, href: `/app/content-lab/${videoId}` });
}
