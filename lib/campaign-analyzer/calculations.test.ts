import { describe, expect, it } from "vitest";

import { calculateCampaign, resolveSourceMetrics, selectCampaignBenchmark } from "./calculations";

const base = {
  creator_name: "Creator",
  youtube_url: null,
  kick_url: null,
  clipper_youtube_url: null,
  monthly_budget_eur: 2000,
  reward_per_1000_views_eur: 0.3,
  tiktok_account_count: 3,
  instagram_account_count: 3,
  youtube_shorts_account_count: 3,
  clips_per_day: 2,
  campaign_duration_days: 30,
  content_hours_per_good_clip: 1,
  manual_expected_views_per_upload: null,
};

describe("campaign calculations", () => {
  it("matches the approved control example", () => {
    const result = calculateCampaign(base, {}, {});
    expect(result.unique_clips).toBe(60);
    expect(result.total_accounts).toBe(9);
    expect(result.total_uploads).toBe(540);
    expect(Math.round(result.required_total_views!)).toBe(6_666_667);
    expect(Math.round(result.required_views_per_upload!)).toBe(12_346);
  });

  it("never produces Infinity or NaN for zero divisors", () => {
    const result = calculateCampaign(
      { ...base, reward_per_1000_views_eur: 0, clips_per_day: 0 },
      {},
      {},
    );
    expect(result.required_total_views).toBeNull();
    expect(result.required_views_per_upload).toBeNull();
  });

  it("lets manual overrides win and clearing one restores automatic data", () => {
    const automatic = { youtube: { median_views: 1000 } } as never;
    expect(resolveSourceMetrics("youtube", automatic, { youtube: { median_views: 2500 } }).median_views).toBe(2500);
    expect(resolveSourceMetrics("youtube", automatic, { youtube: {} }).median_views).toBe(1000);
  });

  it("selects clipper, creator Shorts, manual, then no benchmark", () => {
    expect(selectCampaignBenchmark({ clipper: { shorts_median_views: 4000 }, youtube: { shorts_median_views: 3000 } } as never, null).source).toBe("clipper_shorts");
    expect(selectCampaignBenchmark({ youtube: { shorts_median_views: 3000 } } as never, 2000).source).toBe("creator_shorts");
    expect(selectCampaignBenchmark({}, 2000).source).toBe("manual");
    expect(selectCampaignBenchmark({}, null).source).toBe("none");
  });

  it("rates an exact benchmark match as realistic and over three times median as unrealistic", () => {
    const exactRequiredViewsPerUpload =
      (base.monthly_budget_eur * 1000 / base.reward_per_1000_views_eur) / 540;
    const realistic = calculateCampaign(
      base,
      { clipper: { shorts_median_views: exactRequiredViewsPerUpload } } as never,
      {},
    );
    const unrealistic = calculateCampaign(base, { clipper: { shorts_median_views: 4_000 } } as never, {});
    expect(realistic.required_views_per_upload).toBe(exactRequiredViewsPerUpload);
    expect(realistic.rating).toBe("realistické");
    expect(unrealistic.rating).toBe("nereálne");
  });

  it("keeps exactly three times the benchmark ambitious", () => {
    const inputs = { ...base, monthly_budget_eur: 1620, reward_per_1000_views_eur: 1 };
    const result = calculateCampaign(inputs, { clipper: { shorts_median_views: 1000 } } as never, {});
    expect(result.required_views_per_upload).toBe(3000);
    expect(result.rating).toBe("ambiciózne");
  });

  it("keeps fractional capacity and excludes clipper duration", () => {
    const result = calculateCampaign(
      { ...base, content_hours_per_good_clip: 2 },
      {
        youtube: { total_duration_seconds: 10_800 },
        kick: { total_duration_seconds: 7_200 },
        clipper: { total_duration_seconds: 360_000 },
      } as never,
      {},
    );
    expect(result.available_clips).toBe(2.5);
    expect(Math.floor(result.available_clips!)).toBe(2);
  });

  it("returns null outputs for non-finite arithmetic inputs", () => {
    const result = calculateCampaign({ ...base, monthly_budget_eur: Number.NaN }, {}, {});
    expect(result.required_total_views).toBeNull();
    expect(result.required_views_per_upload).toBeNull();
  });

  it("returns null aggregate counts for NaN and Infinity account inputs", () => {
    const nanAccounts = calculateCampaign(
      { ...base, tiktok_account_count: Number.NaN },
      {},
      {},
    );
    const infiniteAccounts = calculateCampaign(
      { ...base, instagram_account_count: Number.POSITIVE_INFINITY },
      {},
      {},
    );

    expect(nanAccounts.total_accounts).toBeNull();
    expect(nanAccounts.total_uploads).toBeNull();
    expect(infiniteAccounts.total_accounts).toBeNull();
    expect(infiniteAccounts.total_uploads).toBeNull();
  });
});
