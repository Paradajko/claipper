import { CampaignAnalyzerWorkspace } from "@/components/campaign-analyzer-workspace";
import { AppShell, EmptyNotice } from "@/components/ui";
import { CampaignAnalyzerUnavailableError, getCampaignAnalysis, listCampaignAnalyses } from "@/lib/campaign-analyzer/server";

export const dynamic = "force-dynamic";

export default async function CampaignAnalyzerPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  try {
    const analyses = (await listCampaignAnalyses()).slice(0, 20);
    const { id } = await searchParams;
    const selected = id ? await getCampaignAnalysis(id) : analyses[0] ?? null;
    return <AppShell title="Campaign Analyzer" eyebrow="Campaign planning"><CampaignAnalyzerWorkspace key={selected?.id ?? "new"} analyses={analyses} initialAnalysis={selected} /></AppShell>;
  } catch (error) {
    if (error instanceof CampaignAnalyzerUnavailableError) return <AppShell title="Campaign Analyzer" eyebrow="Campaign planning"><EmptyNotice>Campaign Analyzer vyžaduje pripojenie k Supabase.</EmptyNotice></AppShell>;
    throw error;
  }
}
