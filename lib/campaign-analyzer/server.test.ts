import { describe, expect, it } from "vitest";
import { queueCampaignAnalysis, saveCampaignAnalysis } from "./server";
import { campaignInputSchema } from "./validation";

const validInput = {
  creator_name: "  Creator  ",
  youtube_url: "https://youtube.com/@creator",
  kick_url: null,
  clipper_youtube_url: null,
  monthly_budget_eur: 1200,
  reward_per_1000_views_eur: 2,
  tiktok_account_count: 2,
  instagram_account_count: 1,
  youtube_shorts_account_count: 1,
  clips_per_day: 3,
  campaign_duration_days: 30,
  content_hours_per_good_clip: 4,
  manual_expected_views_per_upload: null,
  manual_overrides: {}
};

type Call = { method: string; table?: string; name?: string; args?: unknown; values?: unknown; id?: string };

function createFakeSupabase({ rpcResult }: { rpcResult?: unknown } = {}) {
  const calls: Call[] = [];
  const row = { id: "analysis-1", ...validInput };
  const builder = (table: string) => ({
    insert(values: unknown) {
      calls.push({ method: "insert", table, values });
      return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
    },
    update(values: unknown) {
      calls.push({ method: "update", table, values });
      return {
        eq(column: string, id: string) {
          calls.push({ method: "eq", table, args: { column, value: id } });
          return { select: () => ({ single: async () => ({ data: { ...row, id }, error: null }) }) };
        }
      };
    }
  });
  return {
    calls,
    from(table: string) {
      return builder(table);
    },
    rpc(name: string, args: unknown) {
      calls.push({ method: "rpc", name, args });
      return { single: async () => ({ data: rpcResult, error: null }) };
    }
  };
}

describe("campaign analysis validation", () => {
  it("accepts valid finite input and normalizes optional URLs", () => {
    expect(campaignInputSchema.safeParse(validInput).success).toBe(true);
    expect(campaignInputSchema.safeParse({ ...validInput, monthly_budget_eur: -1 }).success).toBe(false);
    expect(campaignInputSchema.safeParse({ ...validInput, reward_per_1000_views_eur: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(campaignInputSchema.parse({ ...validInput, youtube_url: "" }).youtube_url).toBeNull();
  });

  it("rejects arbitrary manual override keys", () => {
    expect(campaignInputSchema.safeParse({ ...validInput, manual_overrides: { youtube: { arbitrary: 1 } } }).success).toBe(false);
  });
});

describe("campaign analysis persistence", () => {
  it("inserts one row for a new analysis", async () => {
    const fake = createFakeSupabase();
    await saveCampaignAnalysis(validInput, undefined, fake as never);
    expect(fake.calls.filter((call) => call.method === "insert" && call.table === "campaign_analyses")).toHaveLength(1);
  });

  it("updates an existing analysis without inserting", async () => {
    const fake = createFakeSupabase();
    await saveCampaignAnalysis({
      ...validInput,
      id: "analysis-1",
      status: "completed",
      automatic_metadata: { youtube: { median_views: 999 } },
      source_statuses: { youtube: { status: "completed" } },
      created_at: "server-created",
      updated_at: "server-updated",
      error_message: "server-error"
    } as never, "analysis-1", fake as never);
    expect(fake.calls).toContainEqual({ method: "update", table: "campaign_analyses", values: validInput });
    expect(fake.calls).toContainEqual({ method: "eq", table: "campaign_analyses", args: { column: "id", value: "analysis-1" } });
    expect(fake.calls.some((call) => call.method === "insert")).toBe(false);
  });

  it("queues through the atomic campaign RPC", async () => {
    const fake = createFakeSupabase({ rpcResult: { id: "job-1", status: "queued" } });
    const job = await queueCampaignAnalysis("analysis-1", fake as never);
    expect(fake.calls).toContainEqual({
      method: "rpc",
      name: "queue_campaign_analysis",
      args: { p_analysis_id: "analysis-1" }
    });
    expect(job).toMatchObject({ id: "job-1", status: "queued" });
    expect(fake.calls.some((call) => call.method === "insert" && call.table === "processing_jobs")).toBe(false);
  });
});
