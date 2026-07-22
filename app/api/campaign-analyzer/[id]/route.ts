import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { CampaignAnalyzerUnavailableError, getActiveCampaignAnalysisJob, getCampaignAnalysis, projectCampaignInput, saveCampaignAnalysis } from "@/lib/campaign-analyzer/server";
import { campaignInputSchema, campaignUpdateSchema } from "@/lib/campaign-analyzer/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const analysis = await getCampaignAnalysis(id);
    if (!analysis) return NextResponse.json({ error: "Campaign analysis not found." }, { status: 404 });
    const activeJob = await getActiveCampaignAnalysisJob(id);
    return NextResponse.json({ analysis, activeJob });
  } catch (error) {
    return failureResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = campaignUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid campaign analysis.", fields: parsed.error.flatten() }, { status: 400 });
  try {
    const { id } = await params;
    const existing = await getCampaignAnalysis(id);
    if (!existing) return NextResponse.json({ error: "Campaign analysis not found." }, { status: 404 });
    const input = campaignInputSchema.parse({ ...projectCampaignInput(existing), ...parsed.data });
    const analysis = await saveCampaignAnalysis(input, id);
    return NextResponse.json({ analysis });
  } catch (error) {
    return failureResponse(error);
  }
}

function failureResponse(error: unknown) {
  if (error instanceof CampaignAnalyzerUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign analysis request failed." }, { status: 500 });
}
