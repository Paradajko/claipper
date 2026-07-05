import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "Large videos must upload directly to Supabase Storage. Use the Content Lab direct upload flow."
    },
    { status: 410 }
  );
}
