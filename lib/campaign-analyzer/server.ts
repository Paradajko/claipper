import { getSupabaseAdmin } from "@/lib/supabase";
import type { CampaignAnalysis, CampaignInputs, CampaignManualOverrides } from "./types";

export class CampaignAnalyzerUnavailableError extends Error {
  constructor() {
    super("Campaign Analyzer requires Supabase.");
  }
}

type CampaignInput = CampaignInputs & { manual_overrides: CampaignManualOverrides };

function getCampaignAnalyzerClient() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : null;
}

export function projectCampaignInput(input: CampaignInput): CampaignInput {
  return {
    creator_name: input.creator_name,
    youtube_url: input.youtube_url,
    kick_url: input.kick_url,
    clipper_youtube_url: input.clipper_youtube_url,
    monthly_budget_eur: input.monthly_budget_eur,
    reward_per_1000_views_eur: input.reward_per_1000_views_eur,
    tiktok_account_count: input.tiktok_account_count,
    instagram_account_count: input.instagram_account_count,
    youtube_shorts_account_count: input.youtube_shorts_account_count,
    clips_per_day: input.clips_per_day,
    campaign_duration_days: input.campaign_duration_days,
    content_hours_per_good_clip: input.content_hours_per_good_clip,
    manual_expected_views_per_upload: input.manual_expected_views_per_upload,
    manual_overrides: input.manual_overrides
  };
}

export async function listCampaignAnalyses(client = getCampaignAnalyzerClient()) {
  if (!client) throw new CampaignAnalyzerUnavailableError();
  const { data, error } = await client.from("campaign_analyses").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignAnalysis[];
}

export async function getCampaignAnalysis(id: string, client = getCampaignAnalyzerClient()) {
  if (!client) throw new CampaignAnalyzerUnavailableError();
  const { data, error } = await client.from("campaign_analyses").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CampaignAnalysis | null;
}

export async function getActiveCampaignAnalysisJob(id: string, client = getCampaignAnalyzerClient()) {
  if (!client) throw new CampaignAnalyzerUnavailableError();
  const { data, error } = await client
    .from("processing_jobs")
    .select("*")
    .eq("job_type", "campaign_analysis")
    .in("status", ["queued", "running"])
    .contains("raw_data", { campaign_analysis_id: id })
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCampaignAnalysis(input: CampaignInput, id?: string, client = getCampaignAnalyzerClient()) {
  if (!client) throw new CampaignAnalyzerUnavailableError();
  const values = projectCampaignInput(input);
  if (id) {
    const { data, error } = await client.from("campaign_analyses").update(values).eq("id", id).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Campaign analysis was not found.");
    return data as CampaignAnalysis;
  }
  const { data, error } = await client.from("campaign_analyses").insert(values).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Campaign analysis was not created.");
  return data as CampaignAnalysis;
}

export async function queueCampaignAnalysis(id: string, client = getCampaignAnalyzerClient()) {
  if (!client) throw new CampaignAnalyzerUnavailableError();
  const { data, error } = await client.rpc("queue_campaign_analysis", { p_analysis_id: id }).single();
  if (error || !data) throw new Error(error?.message ?? "Campaign analysis job was not created.");
  return data;
}
