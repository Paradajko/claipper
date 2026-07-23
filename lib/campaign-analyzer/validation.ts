import { z } from "zod";

const emptyToNull = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
function platformUrl(allowed: (hostname: string) => boolean) {
  return z.preprocess(emptyToNull, z.string().url().refine((value) => {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && allowed(url.hostname.toLowerCase());
  }, "Unsupported platform URL.").nullable());
}
const youtubeUrl = platformUrl((host) => host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com"));
const kickUrl = platformUrl((host) => host === "kick.com" || host.endsWith(".kick.com"));
const finiteNonNegative = z.coerce.number().finite().nonnegative();
const nullableMetric = z.preprocess(emptyToNull, finiteNonNegative.nullable());

const sourceMetricsOverrideSchema = z.object({
  item_count: nullableMetric,
  total_duration_seconds: nullableMetric,
  average_views: nullableMetric,
  median_views: nullableMetric,
  top_views: nullableMetric,
  sample_size: finiteNonNegative,
  shorts_median_views: nullableMetric,
  shorts_sample_size: finiteNonNegative
}).strict().partial();

export const campaignManualOverridesSchema = z.object({
  youtube: sourceMetricsOverrideSchema.optional(),
  kick: sourceMetricsOverrideSchema.optional(),
  clipper: sourceMetricsOverrideSchema.optional()
}).strict();

export const campaignInputSchema = z.object({
  creator_name: z.string().trim().min(1),
  youtube_url: youtubeUrl,
  kick_url: kickUrl,
  clipper_youtube_url: youtubeUrl,
  monthly_budget_eur: finiteNonNegative,
  reward_per_1000_views_eur: finiteNonNegative,
  tiktok_account_count: finiteNonNegative.int(),
  instagram_account_count: finiteNonNegative.int(),
  youtube_shorts_account_count: finiteNonNegative.int(),
  clips_per_day: finiteNonNegative,
  campaign_duration_days: finiteNonNegative.int(),
  content_hours_per_good_clip: finiteNonNegative,
  manual_expected_views_per_upload: z.preprocess(emptyToNull, finiteNonNegative.nullable()),
  manual_overrides: campaignManualOverridesSchema.default({})
}).strict();

export const campaignUpdateSchema = campaignInputSchema.partial().strict();
