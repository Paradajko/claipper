import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runStreamScanPipeline } from "@/lib/stream-scan-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for Stream Scan processing." }, { status: 503 });
  }

  try {
    await runStreamScanPipeline(supabase, id);
    return NextResponse.redirect(new URL(`/app/content-lab/${id}`, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream Scan failed.";
    return NextResponse.redirect(new URL(`/app/content-lab/${id}?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
  }
}
