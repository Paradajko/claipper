import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { saveUploadedVideo } from "@/lib/stream-scan-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for Stream Scan uploads." }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Upload a video file to start Stream Scan." }, { status: 400 });
  }

  const id = randomUUID();
  const title = String(formData.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
  const filePath = await saveUploadedVideo(file, id);

  const { error } = await supabase.from("videos").insert({
    id,
    title,
    original_filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    file_path: filePath,
    status: "uploaded",
    progress_text: "Video uploaded. Ready to scan.",
    raw_data: { upload_source: "content_lab" }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("processing_jobs").insert({
    video_id: id,
    job_type: "stream_scan",
    status: "queued",
    step: "uploaded"
  });

  return NextResponse.redirect(new URL(`/app/content-lab/${id}`, request.url), { status: 303 });
}
