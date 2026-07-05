import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateDraftClip } from "@/lib/stream-scan-server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for draft generation." }, { status: 503 });
  }

  try {
    const clip = await generateDraftClip(supabase, id);
    return NextResponse.redirect(new URL(`/app/content-lab/${clip.video_id}`, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft render failed.";
    const referer = request.headers.get("referer") ?? "/app/content-lab";
    return NextResponse.redirect(new URL(`${referer.split("?")[0]}?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
  }
}
