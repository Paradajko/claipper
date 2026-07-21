# Campaign Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compact internal Campaign Analyzer at `/app/campaign-analyzer` that stores campaign economics, collects public YouTube/Kick metadata through the existing Railway worker, and calculates campaign feasibility immediately.

**Architecture:** Supabase owns durable `campaign_analyses` rows while the existing `processing_jobs` table owns transient `campaign_analysis` jobs. Pure TypeScript calculation code and a pure worker metadata module keep formulas, benchmark selection, yt-dlp argument safety, and 30-day aggregation independently testable. Authenticated Next.js routes save and enqueue analyses; one client workspace edits inputs and metadata overrides, polls job state, and recalculates locally.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zod, Tailwind CSS, Supabase/PostgreSQL, Node.js Railway worker, yt-dlp metadata JSON, Vitest.

## Global Constraints

- Work only in `/private/tmp/claipper-campaign-analyzer` on `codex/campaign-analyzer`.
- Never modify `main`, `codex/ai-production-mvp`, Smart split, facecam detection, or video-production behavior.
- Keep the interface one compact workspace; do not add another dashboard or unrelated reporting.
- Reuse the existing Railway worker and `processing_jobs`; do not create another worker or queue.
- Every yt-dlp metadata command must include `--skip-download`; never download video, audio, thumbnails, or subtitles.
- YouTube, Kick, and optional clipper YouTube collection run independently; one failure must not abort or erase another source.
- Preserve previous successful automatic metadata when a later source refresh fails.
- Use no YouTube API key and collect no Instagram or TikTok metadata.
- All Campaign Analyzer API routes must call `isAuthenticated()` and return `401` before accessing Supabase.
- Missing Supabase configuration returns a clear unavailable response and never creates demo analyses.
- Do not apply migrations, deploy, or merge to `main` without separate user approval.
- Use TDD for every behavioral change: add a failing focused test, verify RED, implement minimally, verify GREEN, then commit.

---

### Task 1: Durable campaign model and shared types

**Files:**
- Create: `supabase/migrations/007_campaign_analyzer.sql`
- Create: `lib/campaign-analyzer/types.ts`
- Create: `lib/campaign-analyzer/schema-contract.test.ts`

**Interfaces:**
- Produces: `CampaignAnalysis`, `CampaignInputs`, `CampaignSource`, `SourceMetrics`, `SourceCollectionState`, `CampaignAutomaticMetadata`, and `CampaignManualOverrides`.
- Produces: durable `campaign_analyses` rows and a database-enforced single active job per analysis.
- Consumes: existing `processing_jobs` table and service-role RLS pattern.

- [ ] **Step 1: Write the failing schema contract test**

Create `lib/campaign-analyzer/schema-contract.test.ts` with assertions that the migration contains the complete table, service-role policy, state constraint, and active-job unique index:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/007_campaign_analyzer.sql", "utf8");

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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- lib/campaign-analyzer/schema-contract.test.ts
```

Expected: FAIL because `007_campaign_analyzer.sql` does not exist.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/007_campaign_analyzer.sql` with this shape:

```sql
create table if not exists campaign_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creator_name text not null,
  youtube_url text,
  kick_url text,
  clipper_youtube_url text,
  monthly_budget_eur numeric not null default 0 check (monthly_budget_eur >= 0),
  reward_per_1000_views_eur numeric not null default 0 check (reward_per_1000_views_eur >= 0),
  tiktok_account_count integer not null default 0 check (tiktok_account_count >= 0),
  instagram_account_count integer not null default 0 check (instagram_account_count >= 0),
  youtube_shorts_account_count integer not null default 0 check (youtube_shorts_account_count >= 0),
  clips_per_day numeric not null default 0 check (clips_per_day >= 0),
  campaign_duration_days integer not null default 0 check (campaign_duration_days >= 0),
  content_hours_per_good_clip numeric not null default 0 check (content_hours_per_good_clip >= 0),
  manual_expected_views_per_upload numeric check (manual_expected_views_per_upload is null or manual_expected_views_per_upload >= 0),
  status text not null default 'draft' check (status in ('draft', 'analyzing', 'completed', 'failed')),
  automatic_metadata jsonb not null default '{}'::jsonb,
  manual_overrides jsonb not null default '{}'::jsonb,
  source_statuses jsonb not null default '{}'::jsonb,
  last_successful_metadata_at timestamptz,
  error_message text
);

create index if not exists campaign_analyses_updated_at_idx on campaign_analyses(updated_at desc);
create index if not exists campaign_analyses_status_idx on campaign_analyses(status);
create unique index if not exists processing_jobs_campaign_analysis_active_idx
  on processing_jobs ((raw_data->>'campaign_analysis_id'))
  where job_type = 'campaign_analysis' and status in ('queued', 'running');

create or replace function queue_campaign_analysis(p_analysis_id uuid)
returns processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_job processing_jobs;
begin
  select * into queued_job from processing_jobs
  where job_type = 'campaign_analysis'
    and status in ('queued', 'running')
    and raw_data->>'campaign_analysis_id' = p_analysis_id::text
  order by created_at desc limit 1;
  if found then return queued_job; end if;

  update campaign_analyses
  set status = 'analyzing', error_message = null, updated_at = now()
  where id = p_analysis_id;
  if not found then raise exception 'campaign analysis not found'; end if;

  insert into processing_jobs (video_id, job_type, status, step, raw_data)
  values (null, 'campaign_analysis', 'queued', 'campaign_analysis_queued', jsonb_build_object('campaign_analysis_id', p_analysis_id))
  returning * into queued_job;
  return queued_job;
exception when unique_violation then
  select * into queued_job from processing_jobs
  where job_type = 'campaign_analysis'
    and status in ('queued', 'running')
    and raw_data->>'campaign_analysis_id' = p_analysis_id::text
  order by created_at desc limit 1;
  return queued_job;
end;
$$;

revoke all on function queue_campaign_analysis(uuid) from public;
grant execute on function queue_campaign_analysis(uuid) to service_role;

alter table campaign_analyses enable row level security;
drop policy if exists "service_role_all_campaign_analyses" on campaign_analyses;
create policy "service_role_all_campaign_analyses" on campaign_analyses
  for all to service_role using (true) with check (true);
```

- [ ] **Step 4: Add shared types**

Create `lib/campaign-analyzer/types.ts` with these public contracts:

```ts
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
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- lib/campaign-analyzer/schema-contract.test.ts
npm run typecheck
git diff --check
```

Expected: schema test PASS, typecheck PASS, no whitespace errors.

Commit:

```bash
git add supabase/migrations/007_campaign_analyzer.sql lib/campaign-analyzer/types.ts lib/campaign-analyzer/schema-contract.test.ts
git commit -m "Add campaign analyzer data model"
```

---

### Task 2: Immediate campaign calculations and benchmark rules

**Files:**
- Create: `lib/campaign-analyzer/calculations.ts`
- Create: `lib/campaign-analyzer/calculations.test.ts`

**Interfaces:**
- Consumes: `CampaignInputs`, `CampaignAutomaticMetadata`, `CampaignManualOverrides`.
- Produces: `resolveSourceMetrics()`, `selectCampaignBenchmark()`, and `calculateCampaign()`.
- Decision: content capacity sums creator YouTube and Kick duration only; clipper duration is excluded because the clipper channel is a performance benchmark, not creator source inventory.
- Decision: nullable YouTube/Kick URLs are valid and become `not_provided`; campaign economics can still use manual values.

- [ ] **Step 1: Write failing formula and control-example tests**

Create `lib/campaign-analyzer/calculations.test.ts` covering:

```ts
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
  manual_expected_views_per_upload: null
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
    const result = calculateCampaign({ ...base, reward_per_1000_views_eur: 0, clips_per_day: 0 }, {}, {});
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

  it("rates exact median as realistic and over three times median as unrealistic", () => {
    const realistic = calculateCampaign(base, { clipper: { shorts_median_views: 12_346 } } as never, {});
    const unrealistic = calculateCampaign(base, { clipper: { shorts_median_views: 4_000 } } as never, {});
    expect(realistic.rating).toBe("realistické");
    expect(unrealistic.rating).toBe("nereálne");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run `npm test -- lib/campaign-analyzer/calculations.test.ts`.

Expected: FAIL because `calculations.ts` does not exist.

- [ ] **Step 3: Implement the pure calculation module**

Create `lib/campaign-analyzer/calculations.ts` with:

```ts
import type { CampaignAutomaticMetadata, CampaignInputs, CampaignManualOverrides, CampaignSource, SourceMetrics } from "./types";

const emptyMetrics: SourceMetrics = {
  item_count: null, total_duration_seconds: null, average_views: null,
  median_views: null, top_views: null, sample_size: 0,
  shorts_median_views: null, shorts_sample_size: 0
};

export function resolveSourceMetrics(source: CampaignSource, automatic: CampaignAutomaticMetadata, overrides: CampaignManualOverrides): SourceMetrics {
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

export function calculateCampaign(inputs: CampaignInputs, automatic: CampaignAutomaticMetadata, overrides: CampaignManualOverrides) {
  const youtube = resolveSourceMetrics("youtube", automatic, overrides);
  const kick = resolveSourceMetrics("kick", automatic, overrides);
  const resolved = { ...automatic, youtube, kick, clipper: resolveSourceMetrics("clipper", automatic, overrides) };
  const uniqueClips = validProduct(inputs.clips_per_day, inputs.campaign_duration_days);
  const totalAccounts = inputs.tiktok_account_count + inputs.instagram_account_count + inputs.youtube_shorts_account_count;
  const totalUploads = uniqueClips === null ? null : uniqueClips * totalAccounts;
  const requiredTotalViews = positiveDivide(inputs.monthly_budget_eur * 1000, inputs.reward_per_1000_views_eur);
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
    available_clips: positiveDivide(((youtube.total_duration_seconds ?? 0) + (kick.total_duration_seconds ?? 0)) / 3600, inputs.content_hours_per_good_clip),
    benchmark,
    multiplier,
    rating: benchmark.value === null || requiredPerUpload === null ? "nedostatok dát" : requiredPerUpload <= benchmark.value ? "realistické" : requiredPerUpload <= benchmark.value * 3 ? "ambiciózne" : "nereálne"
  };
}

function isPositive(value: number | null | undefined): value is number { return Number.isFinite(value) && Number(value) > 0; }
function positiveDivide(value: number | null, divisor: number | null) { return isPositive(divisor) && Number.isFinite(value) ? Number(value) / divisor : null; }
function validProduct(first: number, second: number) { return isPositive(first) && isPositive(second) ? first * second : null; }
```

- [ ] **Step 4: Add boundary tests and verify GREEN**

Add these exact cases before rerunning the suite:

```ts
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
      clipper: { total_duration_seconds: 360_000 }
    } as never,
    {}
  );
  expect(result.available_clips).toBe(2.5);
  expect(Math.floor(result.available_clips!)).toBe(2);
});

it("returns null outputs for non-finite arithmetic inputs", () => {
  const result = calculateCampaign({ ...base, monthly_budget_eur: Number.NaN }, {}, {});
  expect(result.required_total_views).toBeNull();
  expect(result.required_views_per_upload).toBeNull();
});
```

Run:

```bash
npm test -- lib/campaign-analyzer/calculations.test.ts
npm run typecheck
```

Expected: all calculation tests PASS and typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/campaign-analyzer/calculations.ts lib/campaign-analyzer/calculations.test.ts
git commit -m "Calculate campaign feasibility"
```

---

### Task 3: Safe yt-dlp metadata parser and 30-day aggregation

**Files:**
- Create: `workers/campaign-analysis-metadata.mjs`
- Create: `workers/campaign-analysis-metadata.d.mts`
- Create: `workers/campaign-analysis-metadata.test.ts`

**Interfaces:**
- Produces: `buildCampaignMetadataArgs(url)`, `parseCampaignMetadata(value, options)`, `safeCampaignSourceError(error)`.
- Produces `SourceMetrics`-compatible snake_case values.
- Does not execute yt-dlp; the existing worker owns process execution.

- [ ] **Step 1: Write failing metadata tests with fixtures**

Create tests that assert:

```ts
import { describe, expect, it } from "vitest";
import { buildCampaignMetadataArgs, parseCampaignMetadata, safeCampaignSourceError } from "./campaign-analysis-metadata.mjs";

const now = new Date("2026-07-21T12:00:00Z");

describe("campaign metadata", () => {
  it("builds metadata-only yt-dlp arguments", () => {
    const args = buildCampaignMetadataArgs("https://youtube.com/@creator");
    expect(args).toContain("--skip-download");
    expect(args).toContain("--dump-single-json");
    expect(args).toContain("--playlist-end");
    expect(args).not.toContain("--output");
    expect(args.join(" ")).not.toMatch(/--format|write-thumbnail|write-subs/);
  });

  it("uses only dated entries in the trailing 30-day UTC window", () => {
    const value = { entries: [
      { id: "a", timestamp: now.getTime() / 1000 - 86400, duration: 120, view_count: 1000, webpage_url: "https://youtube.com/shorts/a" },
      { id: "b", upload_date: "20260625", duration: 600, view_count: 3000 },
      { id: "old", upload_date: "20260501", duration: 60, view_count: 999999 },
      { id: "unknown", duration: 60, view_count: 999999 }
    ] };
    const result = parseCampaignMetadata(value, { source: "youtube", now });
    expect(result.item_count).toBe(2);
    expect(result.total_duration_seconds).toBe(720);
    expect(result.average_views).toBe(2000);
    expect(result.median_views).toBe(2000);
    expect(result.top_views).toBe(3000);
    expect(result.shorts_median_views).toBe(1000);
  });

  it("treats a YouTube item as a Short by URL or duration at most 180 seconds", () => {
    const value = { entries: [
      { timestamp: now.getTime() / 1000, duration: 181, view_count: 100, webpage_url: "https://youtube.com/shorts/a" },
      { timestamp: now.getTime() / 1000, duration: 180, view_count: 300, webpage_url: "https://youtube.com/watch?v=b" }
    ] };
    expect(parseCampaignMetadata(value, { source: "youtube", now }).shorts_median_views).toBe(200);
  });

  it("returns a concise source error without command output", () => {
    expect(safeCampaignSourceError(new Error("HTTP Error 403 with cookie=secret"))).toBe("Zdrojové metadáta sa nepodarilo načítať.");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run `npm test -- workers/campaign-analysis-metadata.test.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement metadata-only command construction**

`buildCampaignMetadataArgs(url)` must return exactly these safety-relevant flags plus the URL:

```js
export function buildCampaignMetadataArgs(url) {
  return [
    "--skip-download",
    "--dump-single-json",
    "--ignore-errors",
    "--no-warnings",
    "--playlist-end", "200",
    "--", url
  ];
}
```

Do not add `--format`, `--output`, subtitle, thumbnail, or media post-processing flags.

- [ ] **Step 4: Implement recursive entry parsing and aggregation**

Implement these internal rules in `campaign-analysis-metadata.mjs`:

```js
export function parseCampaignMetadata(value, { source, now = new Date() }) {
  const cutoffMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const entries = flattenEntries(value)
    .map(normalizeEntry)
    .filter((entry) => entry.publishedAt !== null && entry.publishedAt >= cutoffMs && entry.publishedAt <= now.getTime());
  const views = entries.map((entry) => entry.views).filter(Number.isFinite);
  const durations = entries.map((entry) => entry.duration).filter(Number.isFinite);
  const shortsViews = source === "youtube" || source === "clipper"
    ? entries.filter(isShort).map((entry) => entry.views).filter(Number.isFinite)
    : [];
  return {
    item_count: entries.length,
    total_duration_seconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) : null,
    average_views: views.length ? views.reduce((sum, value) => sum + value, 0) / views.length : null,
    median_views: median(views),
    top_views: views.length ? Math.max(...views) : null,
    sample_size: views.length,
    shorts_median_views: median(shortsViews),
    shorts_sample_size: shortsViews.length
  };
}
```

`normalizeEntry()` must read publication time from `timestamp`, `release_timestamp`, or strict `YYYYMMDD` `upload_date`; unknown dates are excluded. `flattenEntries()` must walk nested playlist/tab entries. `isShort()` must accept `/shorts/`, an extractor-provided Shorts marker, or duration `<= 180`.

- [ ] **Step 5: Verify parser tests and syntax**

Run:

```bash
npm test -- workers/campaign-analysis-metadata.test.ts
node --check workers/campaign-analysis-metadata.mjs
npm run typecheck
```

Expected: all metadata tests PASS, syntax and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add workers/campaign-analysis-metadata.mjs workers/campaign-analysis-metadata.d.mts workers/campaign-analysis-metadata.test.ts
git commit -m "Parse campaign source metadata"
```

---

### Task 4: Existing Railway worker campaign job

**Files:**
- Modify: `workers/stream-scan-worker.mjs`
- Create: `workers/campaign-analysis-worker-contract.test.ts`

**Interfaces:**
- Consumes: `buildCampaignMetadataArgs`, `parseCampaignMetadata`, `safeCampaignSourceError` from Task 3.
- Consumes: `processing_jobs.raw_data.campaign_analysis_id`.
- Produces: independently updated `automatic_metadata.youtube`, `.kick`, `.clipper` and matching `source_statuses`.
- Produces: completed best-effort jobs even with source failures; throws only for job-level load/persist/runtime failures.

- [ ] **Step 1: Write failing worker contract tests**

Create `workers/campaign-analysis-worker-contract.test.ts` that reads the worker source and asserts:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("workers/stream-scan-worker.mjs", "utf8");

describe("campaign analysis worker integration", () => {
  it("dispatches campaign jobs through the existing worker", () => {
    expect(worker).toContain('job.job_type === "campaign_analysis"');
    expect(worker).toContain("processCampaignAnalysis(job)");
    expect(worker).toContain("campaign_analysis_id");
  });

  it("uses metadata-only yt-dlp and no media pipeline", () => {
    expect(worker).toContain("buildCampaignMetadataArgs");
    expect(worker).toContain("parseCampaignMetadata");
    expect(worker).not.toContain("processCampaignAnalysis(job, { download");
  });

  it("isolates all three source attempts and preserves stale data", () => {
    for (const source of ["youtube", "kick", "clipper"]) expect(worker).toContain(`source: "${source}"`);
    expect(worker).toContain("collectCampaignSource");
    expect(worker).toContain("previousAutomaticMetadata");
    expect(worker).toContain("stale: true");
    expect(worker).toContain("Hotovo s upozornením");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- workers/campaign-analysis-worker-contract.test.ts`.

Expected: FAIL because the worker has no campaign job branch.

- [ ] **Step 3: Add imports and dispatcher branch**

Add:

```js
import { buildCampaignMetadataArgs, parseCampaignMetadata, safeCampaignSourceError } from "./campaign-analysis-metadata.mjs";
```

In `runJob(job)`, before the unsupported-job throw:

```js
if (job.job_type === "campaign_analysis") {
  await processCampaignAnalysis(job);
  return;
}
```

- [ ] **Step 4: Implement independent source collection**

Add focused helpers to `workers/stream-scan-worker.mjs`:

```js
async function collectCampaignSource({ source, url, now }) {
  if (!url) return { source, status: "not_provided", metrics: null, error: null, technicalError: null };
  try {
    const { stdout } = await execFileAsync(ytDlpBinary, buildCampaignMetadataArgs(url), { maxBuffer: 20 * 1024 * 1024 });
    return { source, status: "completed", metrics: parseCampaignMetadata(JSON.parse(stdout), { source, now }), error: null, technicalError: null };
  } catch (error) {
    console.error(`[claipper-worker] campaign ${source} metadata failed`, cleanError(error));
    return { source, status: "failed", metrics: null, error: safeCampaignSourceError(error), technicalError: cleanError(error) };
  }
}
```

`processCampaignAnalysis(job)` must:

1. validate `job.raw_data.campaign_analysis_id`,
2. load one `campaign_analyses` row,
3. set all provided sources to `pending`,
4. invoke three separate `collectCampaignSource()` calls with source descriptors,
5. merge only successful source metrics into `previousAutomaticMetadata`,
6. retain failed source metrics and mark `stale: true` when prior data exists,
7. mark omitted sources `not_provided`,
8. update `last_successful_metadata_at` when at least one source succeeds,
9. set analysis status `completed` and error message `Hotovo s upozornením` when any source failed,
10. store joined technical source failures in the completed job's `technical_error`, then call existing `updateJob(..., "completed", "campaign_analysis_completed", 100)`.

Use sequential collection to limit Railway CPU/memory and simplify per-source persistence. Persist each source result immediately before moving to the next source so a later process crash cannot erase an earlier success.

- [ ] **Step 5: Add behavior-level tests through exported pure orchestration helpers**

If direct worker import would start `pollForever`, extract only the merge decision into Task 3's pure module as:

```js
export function mergeCampaignSourceResult({ automaticMetadata, sourceStatuses, result, collectedAt }) { /* deterministic merge */ }
```

Add fixture tests proving:

- YouTube failure retains old YouTube values with `stale: true` while Kick succeeds and replaces Kick values.
- Clipper omission becomes `not_provided` and does not fail the pass.
- Three source failures return three separate safe status errors.
- No returned object contains downloaded file paths or media bytes.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- workers/campaign-analysis-metadata.test.ts workers/campaign-analysis-worker-contract.test.ts
node --check workers/stream-scan-worker.mjs
npm run typecheck
```

Expected: focused tests PASS, worker syntax PASS, typecheck PASS.

Commit:

```bash
git add workers/stream-scan-worker.mjs workers/campaign-analysis-metadata.mjs workers/campaign-analysis-metadata.d.mts workers/campaign-analysis-metadata.test.ts workers/campaign-analysis-worker-contract.test.ts
git commit -m "Collect campaign metadata in worker"
```

---

### Task 5: Validation, persistence service, and authenticated API

**Files:**
- Create: `lib/campaign-analyzer/validation.ts`
- Create: `lib/campaign-analyzer/server.ts`
- Create: `lib/campaign-analyzer/server.test.ts`
- Create: `app/api/campaign-analyzer/route.ts`
- Create: `app/api/campaign-analyzer/[id]/route.ts`
- Create: `app/api/campaign-analyzer/[id]/analyze/route.ts`
- Create: `app/api/campaign-analyzer/routes-contract.test.ts`

**Interfaces:**
- Produces: `campaignInputSchema`, `campaignUpdateSchema`.
- Produces: `listCampaignAnalyses()`, `getCampaignAnalysis(id)`, `saveCampaignAnalysis(input, id?)`, `queueCampaignAnalysis(id)`.
- HTTP: `POST /api/campaign-analyzer`, `GET/PATCH /api/campaign-analyzer/[id]`, `POST /api/campaign-analyzer/[id]/analyze`.

- [ ] **Step 1: Write failing validation and service tests**

Add these initial validation assertions:

```ts
expect(campaignInputSchema.safeParse(validInput).success).toBe(true);
expect(campaignInputSchema.safeParse({ ...validInput, monthly_budget_eur: -1 }).success).toBe(false);
expect(campaignInputSchema.safeParse({ ...validInput, reward_per_1000_views_eur: Number.POSITIVE_INFINITY }).success).toBe(false);
expect(campaignInputSchema.parse({ ...validInput, youtube_url: "" }).youtube_url).toBeNull();
```

Use an injected fake Supabase client in `server.test.ts` to prove:

- a new save inserts exactly one row,
- saving an ID updates that row rather than inserting,
- enqueue invokes `queue_campaign_analysis` exactly once with `{ p_analysis_id: id }`,
- the RPC result is returned without a direct `processing_jobs.insert()`.

Use this assertion shape for the queue boundary:

```ts
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
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- lib/campaign-analyzer/server.test.ts app/api/campaign-analyzer/routes-contract.test.ts
```

Expected: FAIL because the modules/routes do not exist.

- [ ] **Step 3: Implement finite input validation**

Use Zod coercion only at the HTTP boundary and `.finite().nonnegative()` for every numeric value. `creator_name` is trimmed and requires at least one character. Use this schema structure and derive `campaignUpdateSchema` from it:

```ts
const emptyToNull = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
const nullableUrl = z.preprocess(emptyToNull, z.string().url().nullable());
const finiteNonNegative = z.coerce.number().finite().nonnegative();

export const campaignInputSchema = z.object({
  creator_name: z.string().trim().min(1),
  youtube_url: nullableUrl,
  kick_url: nullableUrl,
  clipper_youtube_url: nullableUrl,
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
```

`campaignManualOverridesSchema` accepts only `youtube`, `kick`, and `clipper`, and each source accepts only the eight keys declared by `SourceMetrics`; `.strict()` rejects unknown keys rather than persisting arbitrary JSON.

- [ ] **Step 4: Implement an injectable persistence service**

`lib/campaign-analyzer/server.ts` must expose functions accepting `client = getSupabaseAdmin()` so unit tests can inject a fake. Queueing uses the Task 1 transaction boundary:

```ts
export async function queueCampaignAnalysis(id: string, client = getSupabaseAdmin()) {
  if (!client) throw new CampaignAnalyzerUnavailableError();
  const { data, error } = await client
    .rpc("queue_campaign_analysis", { p_analysis_id: id })
    .single();
  if (error || !data) throw new Error(error?.message ?? "Campaign analysis job was not created.");
  return data;
}
```

The route saves validated input first, then invokes the RPC. The RPC atomically reuses an active job or marks the row `analyzing` and inserts one job; the partial unique index and `unique_violation` handler close concurrent-click races.

- [ ] **Step 5: Implement authenticated routes**

Every handler begins:

```ts
if (!(await isAuthenticated())) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Then return:

- `POST /api/campaign-analyzer`: `201 { analysis }` after validated insert.
- `GET /api/campaign-analyzer/[id]`: `200 { analysis, activeJob }`, or `404`.
- `PATCH /api/campaign-analyzer/[id]`: `200 { analysis }` after validated update.
- `POST /api/campaign-analyzer/[id]/analyze`: save validated body, enqueue idempotently, return `202 { analysis, job }`.
- Missing Supabase: `503 { error: "Campaign Analyzer requires Supabase." }`.
- Invalid payload: `400 { error, fields }` with no job insertion.

- [ ] **Step 6: Add route contract tests**

`routes-contract.test.ts` may source-inspect route files, matching the repository's current test style, but must assert all four handlers call `isAuthenticated`, use the campaign schemas/service, return `401/400/503`, and analyze uses `queueCampaignAnalysis` rather than directly inserting a job.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm test -- lib/campaign-analyzer/server.test.ts app/api/campaign-analyzer/routes-contract.test.ts
npm run typecheck
npm run lint
```

Expected: focused tests, typecheck, and lint PASS.

Commit:

```bash
git add lib/campaign-analyzer app/api/campaign-analyzer
git commit -m "Add campaign analysis API"
```

---

### Task 6: Compact Campaign Analyzer workspace

**Files:**
- Create: `app/app/campaign-analyzer/page.tsx`
- Create: `components/campaign-analyzer-workspace.tsx`
- Create: `components/campaign-analyzer-fields.tsx`
- Create: `components/campaign-analyzer-results.tsx`
- Create: `components/campaign-analyzer-workspace.test.tsx`
- Modify: `components/ui.tsx`
- Modify: `app-workflow.test.ts`

**Interfaces:**
- Consumes: Task 2 calculations, Task 5 APIs, `CampaignAnalysis` types.
- Produces: one responsive editing/results workspace, saved-analysis reopening, 2.5-second polling while analyzing.
- Copy: Slovak action/status labels from the spec; existing global navigation remains English except new `Campaign Analyzer` item.

- [ ] **Step 1: Write failing UI and navigation tests**

Use `renderToStaticMarkup` for initial component states and repository-style source assertions for interaction wiring. Cover:

```ts
expect(markup).toContain("Campaign Analyzer");
expect(markup).toContain("Analyzovať");
expect(markup).toContain("Uložiť zmeny");
expect(markup).toContain("Nová analýza");
expect(markup).toContain("Automaticky");
expect(markup).toContain("Nezistené");
expect(source).toContain("calculateCampaign(");
expect(source).toContain("setInterval");
expect(source).toContain("2500");
expect(source).toContain("Ručne upravené");
expect(source).toContain("Staršie dáta");
expect(source).toContain("Hotovo s upozornením");
expect(readFileSync("components/ui.tsx", "utf8")).toContain('label: "Campaign Analyzer"');
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- components/campaign-analyzer-workspace.test.tsx app-workflow.test.ts
```

Expected: FAIL because the page/components/navigation do not exist.

- [ ] **Step 3: Build the server page**

`app/app/campaign-analyzer/page.tsx` must:

- export `dynamic = "force-dynamic"`,
- use `AppShell title="Campaign Analyzer" eyebrow="Campaign planning"`,
- load the latest 20 saved analyses,
- select `searchParams.id` when present, otherwise the newest row,
- show a compact unavailable notice when Supabase is absent,
- pass plain serializable values to `CampaignAnalyzerWorkspace`.

- [ ] **Step 4: Build compact editable fields**

`campaign-analyzer-fields.tsx` owns labeled text/number controls only. Use stable two-column grids where space permits. Group fields into three unframed sections:

1. `Kampaň`: creator, budget, reward, clips/day, days, hours/good clip.
2. `Kanály`: YouTube URL, Kick URL, optional clipper URL.
3. `Distribúcia`: TikTok, Instagram, YouTube Shorts account counts and manual expected views.

Do not nest `Card` components and do not add help/marketing paragraphs.

- [ ] **Step 5: Build editable source metadata and origin labels**

For each source, show a compact status badge and numeric controls for:

- item count,
- content hours (convert to/from `total_duration_seconds`),
- average views,
- median views,
- top views,
- Shorts median for YouTube/clipper only.

Changing a discovered field writes only `manual_overrides[source][metric]`. Clearing it removes that override and reveals the automatic value. Origin labels resolve exactly as:

```ts
override present -> "Ručne upravené"
automatic missing -> "Nezistené"
source status stale -> "Staršie dáta"
otherwise -> "Automaticky"
```

Show each failed source error beside that source. Never replace all source sections with one generic error.

- [ ] **Step 6: Build the sticky result summary**

`campaign-analyzer-results.tsx` receives the return value of `calculateCampaign()` and renders:

- unique clips, available clips, accounts, total uploads,
- required total views, views per unique clip, per upload, and per account,
- selected benchmark, multiplier, benchmark source,
- rating badge (`realistické`, `ambiciózne`, `nereálne`, `nedostatok dát`),
- capacity warning when `Math.floor(available_clips) < unique_clips`,
- the YouTube benchmark caveat for Instagram/TikTok.

Numbers shown as views use `Math.round`; stored state keeps decimal precision.

- [ ] **Step 7: Wire save, analyze, reopen, new, and polling**

`campaign-analyzer-workspace.tsx` must:

- initialize state from the selected row or a blank draft,
- recalculate with `useMemo` on every relevant state change,
- save new rows with `POST`, existing rows with `PATCH`,
- analyze with `POST /api/campaign-analyzer/[id]/analyze`, saving first when needed,
- disable duplicate analyze clicks while status is `analyzing`,
- poll `GET /api/campaign-analyzer/[id]` every `2500` ms only while analyzing,
- stop polling on `completed` or `failed`,
- reopen saved rows through `/app/campaign-analyzer?id=<uuid>`,
- reset to a blank unsaved draft on `Nová analýza`.

- [ ] **Step 8: Add navigation without changing mobile primary slots**

In `components/ui.tsx`, import `Gauge` from Lucide and add:

```ts
{ href: "/app/campaign-analyzer", label: "Campaign Analyzer", mobileLabel: "Analyzer", icon: Gauge }
```

Do not set `mobilePrimary`; it belongs under `More` on mobile, preserving the five-slot bottom navigation.

- [ ] **Step 9: Verify responsive/static contracts and commit**

Run:

```bash
npm test -- components/campaign-analyzer-workspace.test.tsx app-workflow.test.ts lib/campaign-analyzer/calculations.test.ts
npm run typecheck
npm run lint
```

Expected: focused tests, typecheck, and lint PASS.

Commit:

```bash
git add app/app/campaign-analyzer components/campaign-analyzer-workspace.tsx components/campaign-analyzer-fields.tsx components/campaign-analyzer-results.tsx components/campaign-analyzer-workspace.test.tsx components/ui.tsx app-workflow.test.ts
git commit -m "Add compact campaign analyzer workspace"
```

---

### Task 7: Documentation and full verification

**Files:**
- Modify: `workers/README.md`
- Create: `docs/campaign-analyzer-operations.md`
- Modify only if required by implementation: `.env.example`

**Interfaces:**
- Documents: migration, existing env dependencies, metadata-only worker behavior, independent source failures, and manual verification.
- No new runtime secrets are expected; reuse `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `YTDLP_PATH`, and existing worker variables.

- [ ] **Step 1: Document worker behavior and operational boundaries**

Add a concise Campaign Analyzer section to `workers/README.md` stating:

- `campaign_analysis` uses the same worker poll loop,
- yt-dlp is called with `--skip-download --dump-single-json`,
- no media/subtitles/thumbnails are written,
- YouTube, Kick, and clipper statuses are independent,
- source failures preserve old metadata as stale,
- no OpenAI or YouTube API call is used for this feature.

- [ ] **Step 2: Add migration and manual-test instructions**

Create `docs/campaign-analyzer-operations.md` with:

1. apply `supabase/migrations/007_campaign_analyzer.sql`,
2. deploy the existing worker branch only after explicit approval,
3. open `/app/campaign-analyzer`,
4. create/save an analysis,
5. run metadata analysis,
6. verify each source status independently,
7. edit an automatic value and verify immediate recalculation,
8. clear the override and verify automatic restoration,
9. reopen the saved analysis.

Explicitly state that automated verification does not fetch a real creator URL.

- [ ] **Step 3: Run the complete verification suite**

Run in this order:

```bash
npm test
npm run typecheck
npm run lint
npm run build
node --check workers/campaign-analysis-metadata.mjs
node --check workers/stream-scan-worker.mjs
git diff --check
git status --short
```

Expected:

- all Vitest files PASS,
- typecheck PASS,
- lint PASS,
- Next.js production build PASS with `/app/campaign-analyzer` and its API routes listed,
- both worker modules pass syntax checking,
- no whitespace errors,
- only intended documentation changes remain before the final commit.

- [ ] **Step 4: Confirm scope isolation**

Run:

```bash
git diff --name-only main...HEAD
git diff main...HEAD -- workers/video-production.mjs workers/facecam-detection.mjs
git branch --show-current
```

Expected:

- branch is `codex/campaign-analyzer`,
- no Smart split, facecam, or video-production files appear,
- changes are limited to Campaign Analyzer, shared navigation, existing worker dispatcher, docs, and tests.

- [ ] **Step 5: Commit documentation**

```bash
git add workers/README.md docs/campaign-analyzer-operations.md .env.example
git commit -m "Document campaign analyzer operations"
```

If `.env.example` required no change, omit it from `git add`.

- [ ] **Step 6: Request final code review before any push/deploy**

Use `superpowers:requesting-code-review` over `main...HEAD`. Resolve Critical and Important findings with focused tests and a separate fix commit. Re-run the complete verification suite after fixes.

- [ ] **Step 7: Handoff without infrastructure mutation**

Report:

- final commit hash,
- exact test/typecheck/lint/build results,
- migration path,
- required existing env variables,
- what remains manual (migration application, branch push, Vercel/Railway deployment, live URL metadata test),
- confirmation that no real media was downloaded and no deployment/merge occurred.

Do not push, apply the migration, deploy, or merge until the user explicitly authorizes those actions.
