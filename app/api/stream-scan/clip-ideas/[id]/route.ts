import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const productionStatuses = ["selected", "rejected", "needs_edit", "exported", "uploaded"] as const;

type ProductionStatus = (typeof productionStatuses)[number];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is required for moment updates." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid moment update payload." }, { status: 400 });
  }

  const { data: idea, error: ideaError } = await supabase
    .from("clip_ideas")
    .select("id, video_id, hook, caption, raw_data")
    .eq("id", id)
    .single();

  if (ideaError || !idea) {
    return NextResponse.json({ error: "Clip idea not found." }, { status: 404 });
  }

  const currentRawData = isRecord(idea.raw_data) ? idea.raw_data : {};
  const currentMomentV2 = isRecord(currentRawData.moment_v2) ? currentRawData.moment_v2 : {};
  const currentProduction = isRecord(currentMomentV2.production) ? currentMomentV2.production : {};
  const nextStatus = productionStatusFromRaw(body.status ?? currentProduction.status);

  const production = {
    ...currentProduction,
    status: nextStatus,
    final_hook: textFieldFromRaw(body.final_hook, textFieldFromRaw(currentProduction.final_hook, String(idea.hook ?? ""))),
    final_caption: textFieldFromRaw(body.final_caption, textFieldFromRaw(currentProduction.final_caption, String(idea.caption ?? ""))),
    edit_note: textFieldFromRaw(body.edit_note, textFieldFromRaw(currentProduction.edit_note, "")),
    visual_notes: textFieldFromRaw(body.visual_notes, textFieldFromRaw(currentProduction.visual_notes, "")),
    updated_at: new Date().toISOString()
  };
  const raw_data = {
    ...currentRawData,
    moment_v2: {
      ...currentMomentV2,
      production
    }
  };

  const { data: updatedIdea, error: updateError } = await supabase
    .from("clip_ideas")
    .update({ raw_data })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updatedIdea) {
    return NextResponse.json({ error: updateError?.message ?? "Could not update moment." }, { status: 500 });
  }

  revalidatePath(`/app/content-lab/${idea.video_id}`);
  return NextResponse.json({ idea: updatedIdea });
}

function productionStatusFromRaw(value: unknown): ProductionStatus {
  return productionStatuses.includes(value as ProductionStatus) ? (value as ProductionStatus) : "selected";
}

function textFieldFromRaw(value: unknown, fallback: string) {
  return typeof value === "string" ? value.slice(0, 2000) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
