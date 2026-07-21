import type {
  CampaignAutomaticMetadata,
  CampaignInputs,
  CampaignManualOverrides,
  CampaignSource,
  SourceMetrics,
} from "./types";

const emptyMetrics: SourceMetrics = {
  item_count: null,
  total_duration_seconds: null,
  average_views: null,
  median_views: null,
  top_views: null,
  sample_size: 0,
  shorts_median_views: null,
  shorts_sample_size: 0,
};

export function resolveSourceMetrics(
  source: CampaignSource,
  automatic: CampaignAutomaticMetadata,
  overrides: CampaignManualOverrides,
): SourceMetrics {
  return { ...emptyMetrics, ...(automatic[source] ?? {}), ...(overrides[source] ?? {}) };
}

export function selectCampaignBenchmark(metrics: CampaignAutomaticMetadata, manual: number | null) {
  const clipper = metrics.clipper?.shorts_median_views;
  const creator = metrics.youtube?.shorts_median_views;
  if (isPositive(clipper)) return { source: "clipper_shorts" as const, value: clipper };
  if (isPositive(creator)) return { source: "creator_shorts" as const, value: creator };
  if (isPositive(manual)) return { source: "manual" as const, value: manual };
  return { source: "none" as const, value: null };
}

export function calculateCampaign(
  inputs: CampaignInputs,
  automatic: CampaignAutomaticMetadata,
  overrides: CampaignManualOverrides,
) {
  const youtube = resolveSourceMetrics("youtube", automatic, overrides);
  const kick = resolveSourceMetrics("kick", automatic, overrides);
  const resolved = {
    ...automatic,
    youtube,
    kick,
    clipper: resolveSourceMetrics("clipper", automatic, overrides),
  };
  const uniqueClips = validProduct(inputs.clips_per_day, inputs.campaign_duration_days);
  const totalAccounts =
    inputs.tiktok_account_count +
    inputs.instagram_account_count +
    inputs.youtube_shorts_account_count;
  const totalUploads = uniqueClips === null ? null : uniqueClips * totalAccounts;
  const requiredTotalViews = positiveDivide(
    inputs.monthly_budget_eur * 1000,
    inputs.reward_per_1000_views_eur,
  );
  const benchmark = selectCampaignBenchmark(resolved, inputs.manual_expected_views_per_upload);
  const requiredPerUpload = positiveDivide(requiredTotalViews, totalUploads);
  const multiplier = positiveDivide(requiredPerUpload, benchmark.value);

  return {
    unique_clips: uniqueClips,
    total_accounts: totalAccounts,
    total_uploads: totalUploads,
    required_total_views: requiredTotalViews,
    required_views_per_unique_clip: positiveDivide(requiredTotalViews, uniqueClips),
    required_views_per_upload: requiredPerUpload,
    required_views_per_account: positiveDivide(requiredTotalViews, totalAccounts),
    available_clips: positiveDivide(
      ((youtube.total_duration_seconds ?? 0) + (kick.total_duration_seconds ?? 0)) / 3600,
      inputs.content_hours_per_good_clip,
    ),
    benchmark,
    multiplier,
    rating:
      benchmark.value === null || requiredPerUpload === null
        ? "nedostatok dát"
        : requiredPerUpload <= benchmark.value
          ? "realistické"
          : requiredPerUpload <= benchmark.value * 3
            ? "ambiciózne"
            : "nereálne",
  };
}

function isPositive(value: number | null | undefined): value is number {
  return Number.isFinite(value) && Number(value) > 0;
}

function positiveDivide(value: number | null, divisor: number | null) {
  return isPositive(divisor) && Number.isFinite(value) ? Number(value) / divisor : null;
}

function validProduct(first: number, second: number) {
  return isPositive(first) && isPositive(second) ? first * second : null;
}
