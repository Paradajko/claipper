import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { streamScanFlags } from "@/lib/stream-scan-config";

export const runtime = "nodejs";

const requestSchema = z.object({
  videoId: z.string().uuid(),
  bucket: z.string().min(1),
  storagePath: z.string().min(1),
  sourceStorageProvider: z.enum(["r2", "s3", "supabase"]).optional(),
  sourceStoragePath: z.string().min(1).optional()
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

  const { videoId, bucket, storagePath, sourceStorageProvider, sourceStoragePath } = parsed.data;
  const { data: video, error: loadError } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .single();

  const rawData = isRecord(video?.raw_data) ? video.raw_data : {};
  const savedProvider = typeof video?.source_storage_provider === "string"
    ? video.source_storage_provider
    : typeof rawData.source_storage_provider === "string"
      ? rawData.source_storage_provider
      : "supabase";
  const savedPath = typeof video?.source_storage_path === "string"
    ? video.source_storage_path
    : typeof rawData.source_storage_path === "string"
      ? rawData.source_storage_path
      : video?.storage_path;

  if (
    loadError ||
    !video ||
    video.storage_bucket !== bucket ||
    video.storage_path !== storagePath ||
    (sourceStorageProvider && savedProvider !== sourceStorageProvider) ||
    (sourceStoragePath && savedPath !== sourceStoragePath)
  ) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
