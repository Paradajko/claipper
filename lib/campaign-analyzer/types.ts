export const campaignSources = ["youtube", "kick", "clipper"] as const;
export type CampaignSource = (typeof campaignSources)[number];
export type SourceCollectionStatus = "pending" | "completed" | "failed" | "not_provided";

export type SourceMetrics = {
  item_count: number | null;
  total_duration_seconds: number | null;
  average_views: number | null;
  median_views: number | null;
  top_views: number | null;
  sample_size: number;
  shorts_median_views: number | null;
  shorts_sample_size: number;
};

export type SourceCollectionState = {
  status: SourceCollectionStatus;
  error: string | null;
  collected_at: string | null;
  stale: boolean;
};

export type CampaignInputs = {
  creator_name: string;
  youtube_url: string | null;
  kick_url: string | null;
  clipper_youtube_url: string | null;
  monthly_budget_eur: number;
  reward_per_1000_views_eur: number;
  tiktok_account_count: number;
  instagram_account_count: number;
  youtube_shorts_account_count: number;
  clips_per_day: number;
  campaign_duration_days: number;
  content_hours_per_good_clip: number;
  manual_expected_views_per_upload: number | null;
};

export type CampaignAutomaticMetadata = Partial<Record<CampaignSource, SourceMetrics>>;
export type CampaignManualOverrides = Partial<Record<CampaignSource, Partial<SourceMetrics>>>;

export type CampaignAnalysis = CampaignInputs & {
  id: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "analyzing" | "completed" | "failed";
  automatic_metadata: CampaignAutomaticMetadata;
  manual_overrides: CampaignManualOverrides;
  source_statuses: Partial<Record<CampaignSource, SourceCollectionState>>;
  last_successful_metadata_at: string | null;
  error_message: string | null;
};
