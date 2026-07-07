import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildR2ObjectKey, createR2PresignedUrl, isR2Configured, r2BucketName } from "@/lib/r2";
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
  const useR2 = isR2Configured();
  const storageProvider = useR2 ? "r2" : "supabase";
  const storagePath = useR2 ? buildR2ObjectKey(videoId, extension) : `default/${videoId}/source.${extension}`;
  const bucket = useR2 ? r2BucketName() : storageBuckets.originals;
  let signedUpload;
  try {
    signedUpload = useR2
      ? { ...createR2PresignedUrl({ method: "PUT", key: storagePath, contentType: mimeType, expiresIn: 3600 }), token: null }
      : await createSupabaseSignedUploadUrl(storagePath);
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Could not create a signed upload URL." }, { status: 500 });
  }
  const rawData = {
    upload_source: "direct_upload",
    source_storage_provider: storageProvider,
    source_storage_path: storagePath
  };
  const insertPayload = {
    id: videoId,
    title,
    original_filename: filename,
    source_type: "direct_upload",
    storage_bucket: bucket,
    storage_path: storagePath,
    file_path: storagePath,
    source_storage_provider: storageProvider,
    source_storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: size,
    file_size: size,
    status: "uploading",
    progress_percent: 0,
    progress_text: "Waiting for direct upload to finish.",
    raw_data: rawData
  };

  const { error: insertError } = await insertVideoSession(insertPayload);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    videoId,
    bucket,
    storagePath,
    sourceStorageProvider: storageProvider,
    sourceStoragePath: storagePath,
    token: signedUpload.token,
    signedUrl: signedUpload.signedUrl,
    uploadMethod: useR2 ? "r2_put" : "supabase_signed",
    headers: signedUpload.headers ?? {}
  });
}

async function createSupabaseSignedUploadUrl(storagePath: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is required for direct uploads.");
  const { data, error } = await supabase.storage
    .from(storageBuckets.originals)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error("Could not create a signed upload URL.");
  }
  return { ...data, headers: {} };
}

async function insertVideoSession(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: new Error("Supabase is required for direct uploads.") };
  const result = await supabase.from("videos").insert(payload);
  if (result.error?.code === "42703") {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.source_storage_provider;
    delete fallbackPayload.source_storage_path;
    return supabase.from("videos").insert(fallbackPayload);
  }
  return result;
}
