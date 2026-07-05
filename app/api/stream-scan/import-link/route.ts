import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { detectPlatform, storageBuckets, streamScanFlags } from "@/lib/stream-scan-config";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const requestSchema = z.object({
  title: z.string().trim().max(180).optional(),
  sourceUrl: z.string().trim().url()
});

export async function POST(request: Request) {
  if (!streamScanFlags.platformImports || !streamScanFlags.workerProcessing) {
    return NextResponse.json(
      { error: "Platform import requires the processing worker. You can still upload a video file directly." },
      { status: 503 }
    );
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid YouTube, Twitch or Kick URL." }, { status: 400 });
  }

  const { sourceUrl } = parsed.data;
  const platform = detectPlatform(sourceUrl);
  if (!platform) {
    return NextResponse.json({ error: "This platform is not supported yet. Upload the video file directly." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for platform imports." }, { status: 503 });
  }

  const videoId = randomUUID();
  const title = parsed.data.title || `${platform} import`;

  const { error: videoError } = await supabase.from("videos").insert({
    id: videoId,
    title,
    source_type: "platform_import",
    source_url: sourceUrl,
    storage_bucket: storageBuckets.originals,
    storage_path: null,
    file_path: `pending-platform-import/${videoId}`,
    status: "import_queued",
    progress_percent: 5,
    progress_text: "Platform import queued. Waiting for processing worker.",
    raw_data: { upload_source: "platform_import", platform }
  });

  if (videoError) {
    return NextResponse.json({ error: videoError.message }, { status: 500 });
  }

  const { error: importError } = await supabase.from("video_imports").insert({
    video_id: videoId,
    source_url: sourceUrl,
    platform,
    status: "queued"
  });

  if (importError) {
    return NextResponse.json({ error: importError.message }, { status: 500 });
  }

  const { error: jobError } = await supabase.from("processing_jobs").insert({
    video_id: videoId,
    job_type: "platform_import",
    status: "queued",
    progress_percent: 0,
    current_step: "queued",
    step: "queued"
  });

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, videoId, href: `/app/content-lab/${videoId}` });
}
