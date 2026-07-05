import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { error: "Rendered files are served from Supabase Storage signed URLs." },
    { status: 410 }
  );
}
