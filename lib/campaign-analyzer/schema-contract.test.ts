import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/008_campaign_analyzer.sql", "utf8");

describe("campaign analyzer schema", () => {
  it("stores durable inputs, metadata, overrides and source states", () => {
    for (const token of [
      "create table if not exists campaign_analyses",
      "creator_name text not null",
      "youtube_url text",
      "kick_url text",
      "clipper_youtube_url text",
      "monthly_budget_eur numeric",
      "reward_per_1000_views_eur numeric",
      "automatic_metadata jsonb not null default '{}'::jsonb",
      "manual_overrides jsonb not null default '{}'::jsonb",
      "source_statuses jsonb not null default '{}'::jsonb",
      "last_successful_metadata_at timestamptz"
    ]) expect(migration).toContain(token);
  });

  it("allows one queued or running campaign job per analysis", () => {
    expect(migration).toContain("processing_jobs_campaign_analysis_active_idx");
    expect(migration).toContain("raw_data->>'campaign_analysis_id'");
    expect(migration).toContain("status in ('queued', 'running')");
    expect(migration).toContain("create or replace function queue_campaign_analysis");
    expect(migration).toContain("exception when unique_violation");
  });

  it("uses service-role-only access", () => {
    expect(migration).toContain("alter table campaign_analyses enable row level security");
    expect(migration).toContain("to service_role using (true) with check (true)");
  });
});
