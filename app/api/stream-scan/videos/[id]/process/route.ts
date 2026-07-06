import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for Stream Scan processing." }, { status: 503 });
  }

  const { data: video, error: loadError } = await supabase
    .from("videos")
    .select("id, status")
    .eq("id", id)
    .single();

  if (loadError || !video) {
    return NextResponse.redirect(new URL(`/app/content-lab/${id}?error=${encodeURIComponent("Video not found.")}`, request.url), { status: 303 });
  }

  const { error: updateError } = await supabase
    .from("videos")
    .update({
      status: "queued",
      progress_percent: 5,
      progress_text: "Video queued for processing worker.",
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.redirect(new URL(`/app/content-lab/${id}?error=${encodeURIComponent(updateError.message)}`, request.url), { status: 303 });
  }

  const { error: jobError } = await supabase.from("processing_jobs").insert({
    video_id: id,
    job_type: "analyze_video",
    status: "queued",
    progress_percent: 0,
    current_step: "queued",
    step: "queued"
  });

  if (jobError) {
    return NextResponse.redirect(new URL(`/app/content-lab/${id}?error=${encodeURIComponent(jobError.message)}`, request.url), { status: 303 });
  }

  revalidatePath(`/app/content-lab/${id}`);
  revalidatePath("/app/content-lab");

  return NextResponse.redirect(new URL(`/app/content-lab/${id}`, request.url), { status: 303 });
}
