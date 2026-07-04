export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const RequestSchema = z.object({
  email: z.string().email("Neplatný email"),
  name: z.string().optional(),
  use_case: z.enum(["tiktok", "podcast", "youtube-shorts", "instagram-reels", "other"]),
  videos_per_week: z.enum(["1-5", "5-10", "10+"]),
  how_did_you_hear: z.string().optional(),
  honeypot: z.string().max(0)
});

export async function POST(req: NextRequest | Request) {
  try {
    const body = await req.json();

    if (body.honeypot && body.honeypot.length > 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Neplatné dáta", details: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .insert({
        email: parsed.data.email,
        name: parsed.data.name || null,
        use_case: parsed.data.use_case,
        videos_per_week: parsed.data.videos_per_week,
        how_did_you_hear: parsed.data.how_did_you_hear || null
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Uloženie zlyhalo" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Nastala chyba" }, { status: 500 });
  }
}
