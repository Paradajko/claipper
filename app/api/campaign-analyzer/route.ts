import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { CampaignAnalyzerUnavailableError, saveCampaignAnalysis } from "@/lib/campaign-analyzer/server";
import { campaignInputSchema } from "@/lib/campaign-analyzer/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = campaignInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid campaign analysis.", fields: parsed.error.flatten() }, { status: 400 });
  try {
    const analysis = await saveCampaignAnalysis(parsed.data);
    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    return failureResponse(error);
  }
}

function failureResponse(error: unknown) {
  if (error instanceof CampaignAnalyzerUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign analysis request failed." }, { status: 500 });
}
