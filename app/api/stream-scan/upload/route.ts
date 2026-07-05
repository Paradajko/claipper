import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { saveUploadedVideo, saveVideoBuffer } from "@/lib/stream-scan-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return redirectWithError(request, "Supabase is required for Stream Scan uploads.");
  }

  const formData = await request.formData();
  const file = formData.get("video");
  const contentUrl = String(formData.get("content_url") ?? "").trim();

  const id = randomUUID();
  let title = String(formData.get("title") ?? "").trim();
  let originalFilename: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;
  let filePath: string;

  try {
    if (file instanceof File && file.size > 0) {
      title ||= file.name.replace(/\.[^.]+$/, "");
      originalFilename = file.name;
      mimeType = file.type || null;
      sizeBytes = file.size;
      filePath = await saveUploadedVideo(file, id);
    } else if (contentUrl) {
      const downloaded = await downloadDirectVideoUrl(contentUrl);
      title ||= downloaded.filename.replace(/\.[^.]+$/, "");
      originalFilename = downloaded.filename;
      mimeType = downloaded.mimeType;
      sizeBytes = downloaded.bytes.length;
      filePath = await saveVideoBuffer(downloaded.bytes, id, downloaded.filename);
    } else {
      return redirectWithError(request, "Upload a video file or paste a direct video URL to start Stream Scan.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import that video.";
    return redirectWithError(request, message);
  }

  const { error } = await supabase.from("videos").insert({
    id,
    title,
    original_filename: originalFilename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    file_path: filePath,
    status: "uploaded",
    progress_text: "Video uploaded. Ready to scan.",
    raw_data: { upload_source: "content_lab", content_url: contentUrl || null }
  });

  if (error) {
    return redirectWithError(request, error.message);
  }

  await supabase.from("processing_jobs").insert({
    video_id: id,
    job_type: "stream_scan",
    status: "queued",
    step: "uploaded"
  });

  return NextResponse.redirect(new URL(`/app/content-lab/${id}`, request.url), { status: 303 });
}

async function downloadDirectVideoUrl(contentUrl: string) {
  let url: URL;
  try {
    url = new URL(contentUrl);
  } catch {
    throw new Error("Paste a valid direct video URL or upload a video file.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Video URL must start with http or https.");
  }

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Could not download video URL. Remote server returned ${response.status}.`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "video/mp4";
  if (!mimeType.startsWith("video/") && mimeType !== "application/octet-stream") {
    throw new Error("That URL does not look like a direct video file. Upload the video file instead.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("Downloaded video file is empty.");
  }

  const filenameFromUrl = url.pathname.split("/").filter(Boolean).pop() ?? "remote-video.mp4";
  const filename = /\.[a-z0-9]+$/i.test(filenameFromUrl) ? filenameFromUrl : `${filenameFromUrl}.mp4`;
  return { bytes, filename, mimeType };
}

function redirectWithError(request: Request, message: string) {
  return NextResponse.redirect(new URL(`/app/content-lab?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
}
