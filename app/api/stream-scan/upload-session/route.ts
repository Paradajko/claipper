import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSupportedVideoFile, maxUploadSizeBytes, safeStorageExtension, storageBuckets, streamScanFlags } from "@/lib/stream-scan-config";

export const runtime = "nodejs";

const requestSchema = z.object({
  title: z.string().trim().min(1).max(180),
  filename: z.string().trim().min(1).max(260),
  mimeType: z.string().trim().min(1),
  size: z.number().int().positive()
});

export async function POST(request: Request) {
  if (!streamScanFlags.directUploads) {
    return NextResponse.json({ error: "Direct uploads are currently disabled." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload session request." }, { status: 400 });
  }

  const { title, filename, mimeType, size } = parsed.data;
  if (size > maxUploadSizeBytes()) {
    return NextResponse.json({ error: "This file is too large for the current upload limit." }, { status: 400 });
  }

  if (!isSupportedVideoFile(filename, mimeType)) {
    return NextResponse.json({ error: "This format is not supported yet. Try MP4, MOV, MKV or WEBM." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for direct uploads." }, { status: 503 });
  }

  const videoId = randomUUID();
  const extension = safeStorageExtension(filename);
  const storagePath = `default/${videoId}/source.${extension}`;

  const { data: signedUpload, error: signedError } = await supabase.storage
    .from(storageBuckets.originals)
    .createSignedUploadUrl(storagePath);

  if (signedError) {
    return NextResponse.json({ error: "Could not create a signed upload URL." }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("videos").insert({
    id: videoId,
    title,
    original_filename: filename,
    source_type: "direct_upload",
    storage_bucket: storageBuckets.originals,
    storage_path: storagePath,
    file_path: storagePath,
    mime_type: mimeType,
    size_bytes: size,
    file_size: size,
    status: "uploading",
    progress_percent: 0,
    progress_text: "Waiting for direct upload to finish.",
    raw_data: { upload_source: "direct_upload" }
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    videoId,
    bucket: storageBuckets.originals,
    storagePath,
    token: signedUpload.token,
    signedUrl: signedUpload.signedUrl
  });
}
