# Campaign Analyzer Design

## Goal

Add a compact internal Campaign Analyzer to Claipper. A user enters campaign economics and creator links, the existing Railway worker collects public YouTube and Kick metadata, and the page calculates whether the campaign's required per-upload performance is realistic.

The feature reuses Claipper's current password authentication, Supabase database, `processing_jobs` queue, Railway worker, shared `AppShell`, and visual system. It does not introduce another worker, queue, dashboard, or external API key.

## Product Scope

The analyzer lives at `/app/campaign-analyzer` and appears in the existing application navigation. The page remains a single compact workspace with:

1. campaign and source inputs,
2. editable discovered metadata,
3. calculated results and status,
4. a compact list of saved analyses that can be reopened.

The interface avoids a new dashboard, long explanatory copy, and unrelated reporting functionality.

## Inputs

The editable campaign inputs are:

- creator name,
- YouTube URL,
- Kick URL,
- optional existing clipper YouTube URL,
- monthly budget in euros,
- reward in euros per 1,000 views,
- TikTok account count,
- Instagram account count,
- YouTube Shorts account count,
- clips per day,
- campaign duration in days,
- estimated content hours per one good clip,
- optional manually entered expected average views per upload.

All numeric campaign inputs must be finite and non-negative. Values used as divisors—reward per 1,000 views, campaign duration where applicable, account count, clip count, and hours per good clip—must be positive before the corresponding result is shown. Invalid or incomplete inputs produce a local field error rather than `Infinity`, `NaN`, or a server error.

## Persistence Model

### `campaign_analyses`

`campaign_analyses` is the durable source of truth. A row stores:

- identity and timestamps,
- all campaign inputs,
- source URLs,
- current high-level state (`draft`, `analyzing`, `completed`, or `failed`),
- automatically discovered metadata as structured JSON,
- manual metadata overrides as separate structured JSON,
- per-source collection status and user-safe errors,
- the last successful metadata collection timestamp.

Automatic values and manual overrides are never merged destructively. When resolving a value for display or calculation, a present manual override wins; otherwise the automatic value is used. Clearing a manual override restores the automatic value.

Previous successful automatic metadata remains stored when a later run cannot refresh one of the sources. The failed source receives a failed status and error, while its last successful values remain available and visibly identified as stale. Successful sources from the new run update normally.

### `processing_jobs`

`processing_jobs` remains transient processing state. A job with `job_type = 'campaign_analysis'` stores the target `campaign_analysis_id` in `raw_data`; it does not own campaign inputs or results.

Starting an analysis for an existing row updates that same `campaign_analyses` row and creates a fresh processing job. It never creates a duplicate analysis row. The UI starts a new row only when the user explicitly chooses a new analysis.

## Metadata Collection

The existing Railway worker gains a `campaign_analysis` branch in its current job dispatcher. It invokes the worker's configured `yt-dlp` binary for metadata only and never downloads video, audio, thumbnails, or subtitles.

YouTube, Kick, and the optional clipper channel are independent collection sources. A failure in one source is caught and recorded without aborting the others. The worker reports per-source state as `pending`, `completed`, `failed`, or `not_provided`, with a concise safe error for failed sources.

For the trailing 30-day window, the worker makes a best-effort collection of public entries and derives:

- number of videos or streams,
- total duration,
- average views,
- median views,
- top views,
- the underlying sample size.

For the creator's YouTube source, the worker also derives the median views of creator Shorts. For the optional clipper channel, it derives recent Shorts performance and its median views. In the MVP, a YouTube entry counts as a Short when metadata identifies it as a Short or its duration is at most 180 seconds. Unknown individual fields remain `null` and render as `nezistené`.

The 30-day cutoff is evaluated from the worker's current UTC time. Entries whose publication timestamp cannot be determined are excluded from time-window aggregates rather than guessed.

The worker updates automatic metadata only after each source has been processed. A completely failed refresh therefore cannot erase previously successful values.

## Request and Status Flow

All Campaign Analyzer routes verify Claipper's existing password authentication on the server.

1. Opening the page loads saved analyses and optionally one selected analysis.
2. Saving campaign fields updates the durable analysis row.
3. Pressing `Analyzovať` saves the current row, marks it as analyzing, and inserts one new `campaign_analysis` processing job referencing that row.
4. Repeated clicks while that analysis already has a queued or running job are rejected idempotently and do not create parallel duplicate jobs.
5. The client polls a small status endpoint while work is queued or running.
6. The page displays `Analyzuje sa`, then `Hotovo` or `Nepodarilo sa`, plus separate YouTube, Kick, and clipper source states.
7. A failed overall job remains reopenable and editable. Successful partial source data remains usable.

## Client-Side Resolution and Calculations

Campaign economics recalculate immediately in the browser when the user changes budget, reward, account counts, clips per day, campaign days, hours per good clip, discovered-value overrides, or the manual benchmark. No worker rerun is required.

For any discovered metric:

```text
resolved value = manual override when present, otherwise automatic value
```

Core formulas:

```text
unique clips = clips per day × campaign days
available clips = total discovered content hours ÷ hours per good clip
total accounts = TikTok + Instagram + YouTube Shorts accounts
total uploads = unique clips × total accounts
required total views = budget ÷ reward per 1,000 views × 1,000
required views per unique clip = required total views ÷ unique clips
required views per upload = required total views ÷ total uploads
required views per account = required total views ÷ total accounts
```

`available clips` is an estimate and may be fractional internally; the UI presents a rounded-down whole-clip capacity while retaining the precise value for comparison. If available clips are fewer than planned unique clips, the page shows a compact capacity warning. This warning does not change the views-based rating.

Displayed view counts are rounded to the nearest whole view. Stored inputs and internal calculations retain decimal precision.

## Benchmark and Rating

The benchmark is selected in this exact order:

1. median views of the optional existing clipper channel's recent Shorts,
2. median views of the creator's own recent Shorts,
3. manually entered expected average views per upload,
4. no benchmark.

The rating compares required views per upload—not per unique clip and never creator long-form views—with the selected reference median:

- `realistické`: required views per upload is at most the reference median,
- `ambiciózne`: required views per upload is greater than the median and at most three times the median,
- `nereálne`: required views per upload is greater than three times the median,
- `nedostatok dát`: no reference median is available.

The result displays:

- required views per upload,
- selected reference median,
- the required-to-reference multiplier,
- benchmark source.

When the selected benchmark comes from YouTube Shorts, the UI explicitly notes that the rating is only indicative for Instagram and TikTok.

## UI Design

The page uses the existing dark emerald Claipper styling, `AppShell`, `Card`, typography, form controls, and responsive behavior.

On wider screens, the input/editing area and sticky result summary may sit in two columns. On smaller screens, they stack into a single reading order. The saved-analysis selector stays compact near the page title or top card.

Detected values use ordinary editable numeric inputs with a small origin label such as `Automaticky`, `Ručne upravené`, `Nezistené`, or `Staršie dáta`. Source failures are shown beside their source rather than as one generic page error.

The primary actions are limited to saving current changes, running or rerunning metadata analysis, creating a new analysis, and opening a saved analysis.

## Error Handling

- Missing or invalid form fields are reported inline and do not enqueue a job.
- Unauthorized API calls return `401` without exposing data.
- A missing Supabase configuration produces a clear unavailable state; Campaign Analyzer does not create demo records because saved analyses must be durable.
- `yt-dlp` errors are converted to safe source-specific messages. Technical detail remains available in worker logs and job technical error fields.
- One source failure does not fail the other source collectors.
- The overall analysis is `completed` when the worker finishes its best-effort pass, even if one source failed; the UI may present `Hotovo s upozornením`. It is `failed` only when the job itself cannot perform or persist the pass.
- A later failed source refresh preserves its prior successful automatic data.

## Testing Strategy

Tests cover independent boundaries:

- pure calculation tests for every formula, zero/invalid divisors, override precedence, rounding, benchmark selection, multipliers, and rating thresholds,
- the required control example,
- worker metadata parsing and aggregation fixtures for YouTube, Kick, Shorts detection, missing fields, and the 30-day cutoff,
- worker behavior proving independent source failures and preservation of previous successful data,
- API tests for authentication, validation, row reuse on rerun, duplicate active-job prevention, persistence, and status responses,
- component tests for immediate recalculation, editable automatic values, `nezistené`, stale values, source-specific failures, and reopening a saved analysis,
- navigation and production build/type checks.

## Acceptance Example

Given:

- budget: €2,000,
- reward: €0.30 per 1,000 views,
- clips per day: 2,
- campaign days: 30,
- accounts: 3 TikTok + 3 Instagram + 3 YouTube Shorts,

the result is:

- 60 unique clips,
- 9 accounts,
- 540 uploads,
- approximately 6,666,667 required total views,
- approximately 12,346 required views per upload.

## Out of Scope

- downloading or analyzing video/audio content,
- computer vision or transcript analysis,
- new YouTube API keys,
- a new worker or queue system,
- Instagram or TikTok metadata collection,
- automated campaign execution, posting, or spend tracking,
- a separate analytics dashboard.
