# Claipper AI Production MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Claipper Content Lab from grounded moment suggestions into a CZ/SK production flow that creates editable natural or cold-open 1080x1920 clips with creator captions, enhancement, export QA, and human approval.

**Architecture:** Keep Next.js/Vercel responsible for short API and UI work, Supabase for durable records and the job queue, R2 for original videos, and the Railway worker for downloads, OpenAI calls, FFmpeg, FFprobe, and rendered assets. Extract only deterministic production logic from the large worker into a pure ESM module so it can be developed with unit tests without processing a real video. Store the editable production plan in `clips.raw_data.edit_plan` and Moment Finder metadata in `clip_ideas.raw_data.moment_v3`, avoiding a migration unless production audit proves migration 006 is missing.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Supabase, Cloudflare R2/S3-compatible storage, OpenAI, Node.js Railway worker, FFmpeg/FFprobe, Vitest.

## Global Constraints

- Claipper is a clipping production engine for MyLaura; it does not own campaigns, clients, tracking, accounts, or payouts.
- P0 supports direct MP4/MOV/MKV/WEBM upload and queued YouTube/Twitch/Kick VOD imports already accepted by the current API.
- CZ/SK is the only editorial-language target for this sprint.
- Source duration limit remains 480 minutes and direct uploads continue to bypass Vercel request bodies.
- Do not bypass DRM, private content, CAPTCHA, login checks, or platform protections.
- Do not implement account generation, publishing, campaign management, public registration, or a multitrack editor.
- Do not upload, import, render, or inspect any real video while implementing this plan.
- Verification is limited to deterministic unit tests, `typecheck`, `lint`, and `build`.
- Do not claim practical or visual verification; the user performs all real-video testing.

---

## File Map

**Create**

- `workers/video-production.mjs`: pure edit-plan normalization, render timeline, ASS generation, FFmpeg graph construction, and FFprobe result validation.
- `workers/video-production.d.mts`: TypeScript declarations for the pure worker module.
- `workers/video-production.test.ts`: deterministic unit coverage without media files or external processes.
- `components/clip-export-form.tsx`: compact export/edit controls used by each Moment Review card.

**Modify**

- `lib/stream-scan.ts`: Moment Finder v3 candidate fields, overlapping analysis windows, deduplication, v3 ranking, and payload storage.
- `lib/stream-scan.test.ts`: test-first coverage for overlap, duplicate removal, hook interval grounding, and v3 payloads.
- `lib/types.ts`: typed moment-v3 metadata and clip edit-plan fields used by UI code.
- `lib/stream-scan-server.ts`: keep the legacy local path schema/prompts compatible with v3 even though production uses Railway.
- `workers/stream-scan-worker.mjs`: v3 OpenAI stages, word timestamps, edit-plan render execution, ASS captions, 1080x1920 output, and FFprobe QA.
- `app/api/stream-scan/clip-ideas/[id]/ready-clip/route.ts`: validate export settings and queue a normalized edit plan.
- `components/moment-review-client.tsx`: render v3 metadata and delegate export controls to `ClipExportForm`.
- `app-workflow.test.ts`: update source-level workflow assertions from v2.1/720p to v3/1080p and the new controls.
- `.env.example`: add optional `FFPROBE_PATH` and document existing object-storage values as worker requirements.
- `workers/worker-utils.mjs`, `workers/worker-utils.d.mts`, `workers/worker-utils.test.ts`: report FFprobe availability without invoking real media processing.
- `docs/worker-railway-deploy.md`: production variables, migration 006 audit, and explicit user-owned manual video test handoff.

---

### Task 1: Moment Finder v3 deterministic model

**Files:**
- Modify: `lib/stream-scan.ts`
- Modify: `lib/stream-scan.test.ts`

**Interfaces:**
- Consumes: existing `TranscriptItem`, `NormalizedClipCandidate`, `normalizeClipCandidate`, `rankClipCandidates`, and `clipIdeaInsertPayload`.
- Produces: `buildOverlappingTranscriptSegments(items, windowSeconds, overlapSeconds)`, `dedupeClipCandidates(candidates, overlapThreshold)`, and v3 hook fields on `NormalizedClipCandidate`.

- [ ] **Step 1: Write failing tests for overlapping analysis windows**

Add an import for `buildOverlappingTranscriptSegments` and this focused test:

```ts
it("builds overlapping analysis windows so boundary moments are visible twice", () => {
  const items = Array.from({ length: 13 }, (_, index) => ({
    start: index * 60,
    end: index * 60 + 30,
    text: `minute-${index}`
  }));

  const segments = buildOverlappingTranscriptSegments(items, 600, 120);

  expect(segments).toHaveLength(2);
  expect(segments[0]).toMatchObject({ start_time: 0, end_time: 570 });
  expect(segments[1].start_time).toBe(480);
  expect(segments[1].text).toContain("minute-8");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test -- lib/stream-scan.test.ts`

Expected: FAIL because `buildOverlappingTranscriptSegments` is not exported.

- [ ] **Step 3: Implement overlapping windows**

Add a deterministic window builder that validates `overlapSeconds < windowSeconds`, advances by `windowSeconds - overlapSeconds`, includes transcript items overlapping each window, and emits no empty windows:

```ts
export function buildOverlappingTranscriptSegments(
  items: TranscriptItem[],
  windowSeconds = 600,
  overlapSeconds = 120
): TranscriptSegment[] {
  if (items.length === 0) return [];
  if (windowSeconds <= 0 || overlapSeconds < 0 || overlapSeconds >= windowSeconds) {
    throw new Error("Transcript window must be positive and larger than its overlap.");
  }

  const segments: TranscriptSegment[] = [];
  const finalEnd = Math.max(...items.map((item) => item.end));
  const step = windowSeconds - overlapSeconds;
  for (let windowStart = 0; windowStart < finalEnd; windowStart += step) {
    const windowEnd = windowStart + windowSeconds;
    const selected = items.filter((item) => item.end > windowStart && item.start < windowEnd);
    if (selected.length === 0) continue;
    segments.push(toSegment(segments.length, selected));
  }
  return segments;
}
```

- [ ] **Step 4: Write failing tests for duplicate candidates and v3 hook fields**

Create two candidates whose ranges overlap by more than 70%, assert that the stronger one survives, and add a normalization assertion for:

```ts
hook_start_time: "00:02:20",
hook_end_time: "00:02:22",
hook_mode: "cold_open"
```

Expected normalized values:

```ts
{
  hook_start_time: 140,
  hook_end_time: 142,
  hook_mode: "cold_open"
}
```

- [ ] **Step 5: Run the focused test and verify RED**

Run: `npm run test -- lib/stream-scan.test.ts`

Expected: FAIL because v3 hook fields and `dedupeClipCandidates` do not exist.

- [ ] **Step 6: Implement v3 candidate normalization and deduplication**

Extend the Zod schema with optional `hook_start_time`, `hook_end_time`, and `hook_mode`. Normalize the hook only when it is inside the candidate and lasts 1-3 seconds; otherwise fall back to `natural` with null hook bounds.

Implement range intersection over the shorter candidate duration:

```ts
export function dedupeClipCandidates(candidates: NormalizedClipCandidate[], threshold = 0.7) {
  return [...candidates]
    .sort((a, b) => v3MomentScore(b) - v3MomentScore(a))
    .filter((candidate, index, ranked) =>
      ranked.slice(0, index).every((kept) => overlapRatio(candidate, kept) < threshold)
    );
}
```

Make `rankClipCandidates` dedupe before slicing and preserve 5-10 strong non-skip moments where available.

- [ ] **Step 7: Store v3 metadata without new columns**

Change `clipIdeaInsertPayload` to write:

```ts
raw_data: {
  source,
  moment_finder_version: "v3",
  moment_v3: {
    attention_score: idea.attention_score,
    emotion_spike: idea.emotion_spike,
    hook_strength: idea.hook_strength,
    payoff_score: idea.payoff_score,
    context_needed: idea.context_needed,
    retention_risk: idea.retention_risk,
    edit_difficulty: idea.edit_difficulty,
    recommendation: idea.recommendation,
    recut_suggestion: idea.recut_suggestion,
    source_quote: idea.source_quote,
    hook_mode: idea.hook_mode,
    hook_start_seconds: idea.hook_start_time,
    hook_end_seconds: idea.hook_end_time
  }
}
```

- [ ] **Step 8: Run focused and full unit tests**

Run: `npm run test -- lib/stream-scan.test.ts`

Expected: PASS.

Run: `npm run test`

Expected: existing source-level tests may still fail only where they explicitly assert v2.1; record those assertions for Task 7 rather than weakening production logic.

- [ ] **Step 9: Commit**

```bash
git add lib/stream-scan.ts lib/stream-scan.test.ts
git commit -m "Upgrade moment candidate model to v3"
```

---

### Task 2: Railway Moment Finder v3 and grounded hook verification

**Files:**
- Modify: `workers/stream-scan-worker.mjs`
- Modify: `lib/stream-scan-server.ts`
- Modify: `lib/types.ts`

**Interfaces:**
- Consumes: v3 candidate shape from Task 1 and current OpenAI JSON response handling.
- Produces: grounded 5-10 candidates with timing verification and optional 1-3 second cold-open bounds in `moment_v3`.

- [ ] **Step 1: Write source-level failing assertions**

Update `app-workflow.test.ts` in a temporary focused commit only after Task 7; for TDD here add assertions to `lib/stream-scan.test.ts` that invalid/out-of-range hook bounds normalize to `natural` and null bounds.

- [ ] **Step 2: Verify RED**

Run: `npm run test -- lib/stream-scan.test.ts`

Expected: FAIL until hook constraints are enforced for every normalization path.

- [ ] **Step 3: Request word timestamps for caption quality**

In both transcription paths request:

```ts
timestamp_granularities: ["segment", "word"]
```

For the manual FormData request append both values. Save `segments_json` as an object that preserves both arrays:

```js
segments_json: {
  segments: transcript.segments ?? [],
  words: transcript.words ?? []
}
```

Keep `raw_data: transcript` for backward compatibility and update the fine-segment parser later to accept both the legacy array and the new object.

- [ ] **Step 4: Upgrade discovery and global ranking prompts**

Set `MOMENT_FINDER_VERSION = "v3"`. Require CZ/SK output and the exact v3 candidate JSON fields, including optional hook bounds. Discovery should favor recall; global ranking should deduplicate and select 5-10 candidates.

The system prompt must explicitly say:

```text
Never invent a quote. Every hook and timestamp must overlap words present in the supplied transcript. A cold-open interval must be 1-3 seconds and remain inside the candidate interval. Use natural when no self-contained cold open exists.
```

- [ ] **Step 5: Add a separate timing-and-hook verification call**

After global ranking, call a verifier for each candidate with approximately 20 seconds of transcript context on both sides. Require JSON:

```json
{
  "start_seconds": 120.0,
  "end_seconds": 158.0,
  "hook_mode": "natural",
  "hook_start_seconds": null,
  "hook_end_seconds": null,
  "reason": "Starts on a complete strong sentence and ends after the payoff."
}
```

Constrain returned bounds to transcript segments, 20-60 seconds, and 1-3 seconds for a cold open. If verification fails, keep the grounded deterministic timing and use `natural`.

- [ ] **Step 6: Keep the local server path compatible**

Mirror schemas and prompts in `lib/stream-scan-server.ts` so local fallback data does not produce a different metadata version. Do not add a second independent scoring formula.

- [ ] **Step 7: Update public types**

Add typed `MomentV3Metadata`, `MomentProduction`, and `ClipEditPlan` definitions in `lib/types.ts`, while keeping `raw_data` backward compatible for old records.

- [ ] **Step 8: Run technical checks**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test -- lib/stream-scan.test.ts`

Expected: PASS. No OpenAI request is executed by tests.

- [ ] **Step 9: Commit**

```bash
git add workers/stream-scan-worker.mjs lib/stream-scan-server.ts lib/types.ts
git commit -m "Add grounded v3 moment verification"
```

---

### Task 3: Editable export plan API

**Files:**
- Modify: `app/api/stream-scan/clip-ideas/[id]/ready-clip/route.ts`
- Modify: `lib/types.ts`
- Modify: `app-workflow.test.ts`

**Interfaces:**
- Consumes: form fields from the review UI and `moment_v3` defaults.
- Produces: `clips.raw_data.edit_plan` and identical `processing_jobs.raw_data.edit_plan`.

- [ ] **Step 1: Write a failing workflow assertion for edit-plan fields**

Assert that the ready route accepts and stores these names:

```ts
for (const field of [
  "hookMode", "hookStartSeconds", "hookEndSeconds", "startSeconds", "endSeconds",
  "framingMode", "backgroundMode", "addCaptions", "subtitlePreset", "enhanceEnabled"
]) {
  expect(readyRoute).toContain(field);
}
expect(readyRoute).toContain("edit_plan");
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test -- app-workflow.test.ts`

Expected: FAIL because the route currently accepts only `addCaptions`.

- [ ] **Step 3: Validate the form with Zod**

Define a schema with coercion and strict enums:

```ts
const editPlanSchema = z.object({
  startSeconds: z.coerce.number().min(0),
  endSeconds: z.coerce.number().positive(),
  hookMode: z.enum(["natural", "cold_open"]).default("natural"),
  hookStartSeconds: optionalNumber,
  hookEndSeconds: optionalNumber,
  framingMode: z.enum(["left", "center", "right"]).default("center"),
  backgroundMode: z.enum(["crop", "blur"]).default("crop"),
  subtitlePreset: z.literal("creator").default("creator"),
  addCaptions: formBoolean,
  enhanceEnabled: formBoolean
});
```

Reject `end <= start`, clips outside the idea's grounded range allowance, hook intervals outside the selected clip, and cold opens outside 1-3 seconds. Invalid cold-open bounds should return a 400 response, not silently queue a broken job.

- [ ] **Step 4: Store one normalized edit-plan object**

Use the same object for clip and job:

```ts
const editPlan = {
  version: 1,
  start_seconds: parsed.startSeconds,
  end_seconds: parsed.endSeconds,
  hook_mode: parsed.hookMode,
  hook_start_seconds: parsed.hookMode === "cold_open" ? parsed.hookStartSeconds : null,
  hook_end_seconds: parsed.hookMode === "cold_open" ? parsed.hookEndSeconds : null,
  framing_mode: parsed.framingMode,
  background_mode: parsed.backgroundMode,
  subtitle_preset: "creator",
  add_captions: parsed.addCaptions,
  enhance_enabled: parsed.enhanceEnabled
};
```

Set the clip's top-level start/end/duration from this normalized plan and leave status `editing` until worker QA succeeds.

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- app-workflow.test.ts`

Expected: new route contract assertions PASS; legacy 720p assertions remain for Task 7.

- [ ] **Step 6: Commit**

```bash
git add 'app/api/stream-scan/clip-ideas/[id]/ready-clip/route.ts' lib/types.ts app-workflow.test.ts
git commit -m "Queue editable clip production plans"
```

---

### Task 4: Pure video production module

**Files:**
- Create: `workers/video-production.mjs`
- Create: `workers/video-production.d.mts`
- Create: `workers/video-production.test.ts`

**Interfaces:**
- Consumes: `edit_plan`, transcript word/segment records, source/output paths, and FFprobe JSON.
- Produces: `normalizeEditPlan`, `buildRenderTimeline`, `buildAssDocument`, `buildReadyRenderCommand`, and `validateProbeResult`.

- [ ] **Step 1: Write failing edit-plan and timeline tests**

Test that natural produces one segment and cold-open produces hook first plus the main range with the hook removed:

```ts
expect(buildRenderTimeline({
  start_seconds: 100,
  end_seconds: 140,
  hook_mode: "cold_open",
  hook_start_seconds: 125,
  hook_end_seconds: 127
})).toEqual([
  { role: "hook", start: 125, end: 127 },
  { role: "body", start: 100, end: 125 },
  { role: "body", start: 127, end: 140 }
]);
```

Also test invalid, overlapping, sub-250ms, and out-of-range segments.

- [ ] **Step 2: Verify RED**

Run: `npm run test -- workers/video-production.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement normalization and render timeline**

`normalizeEditPlan` must clamp framing/background enums, reject invalid clip bounds, and downgrade invalid cold opens to natural only when reading legacy records. `buildRenderTimeline` must never duplicate the hook range and must preserve source order for body segments.

- [ ] **Step 4: Write failing ASS caption tests**

Use deterministic word input with Slovak diacritics:

```ts
const words = [
  { start: 100, end: 100.5, text: "Toto" },
  { start: 100.5, end: 101, text: "je" },
  { start: 101, end: 101.7, text: "naozaj" },
  { start: 101.7, end: 102.4, text: "dôležité." }
];
const ass = buildAssDocument(words, timeline, { width: 1080, height: 1920, preset: "creator" });
expect(ass).toContain("PlayResX: 1080");
expect(ass).toContain("PlayResY: 1920");
expect(ass).toContain("dôležité");
expect(ass).toContain("MarginV,260");
expect(ass).toContain("\\1c&H00FFFF&");
```

The expected header may use a named style line instead of the exact `MarginV` fragment, but the test must assert 1080x1920 and a safe bottom margin.

- [ ] **Step 5: Implement creator ASS generation**

Build 3-5 word cues, at most two lines, preserve Unicode, escape ASS control characters, remap source timestamps through the cold-open timeline, and highlight the active word with ASS override tags. Use a professional bold sans-serif fallback list and a 260px bottom safe margin.

- [ ] **Step 6: Write failing FFmpeg graph tests**

Assert:

- crop/left, crop/center, crop/right produce distinct `crop` x expressions;
- blur mode builds a blurred 1080x1920 background plus a contained foreground;
- Creator Enhance adds conservative `eq`, `unsharp`, and audio `loudnorm` filters only when enabled;
- output includes `libx264`, `-preset medium`, `-crf 18`, `yuv420p`, AAC, and `+faststart`;
- cold-open command uses `trim`, `atrim`, `setpts`, `asetpts`, and `concat`.

- [ ] **Step 7: Implement FFmpeg command construction**

Return `{ args, expectedDuration }` instead of executing FFmpeg. Keep all user-derived values as separate exec arguments and escape only the ASS filter filename. Never build a shell command string.

- [ ] **Step 8: Write failing FFprobe validation tests**

Cover missing streams, wrong dimensions, duration mismatch, and a valid result:

```ts
expect(validateProbeResult(validProbe, { width: 1080, height: 1920, duration: 40 }))
  .toEqual({ ok: true, errors: [] });
```

- [ ] **Step 9: Implement probe validation**

Allow a 0.75-second duration tolerance, require H.264-compatible video dimensions and one audio stream, and return structured error codes rather than throwing.

- [ ] **Step 10: Run focused tests and type declarations check**

Run: `npm run test -- workers/video-production.test.ts`

Expected: PASS without reading or writing a media file.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add workers/video-production.mjs workers/video-production.d.mts workers/video-production.test.ts
git commit -m "Add deterministic vertical video production plans"
```

---

### Task 5: Worker render execution and automatic QA

**Files:**
- Modify: `workers/stream-scan-worker.mjs`
- Modify: `.env.example`
- Modify: `workers/worker-utils.mjs`
- Modify: `workers/worker-utils.d.mts`
- Modify: `workers/worker-utils.test.ts`

**Interfaces:**
- Consumes: pure functions from Task 4 and queued `edit_plan` from Task 3.
- Produces: uploaded ready MP4 plus `raw_data.quality_check` and accurate `render_status`.

- [ ] **Step 1: Write failing startup-report tests for FFprobe**

Extend the worker utility fixture with:

```ts
ffprobe: { ok: true, binary: "ffprobe" }
```

Assert the report contains `FFprobe: available`.

- [ ] **Step 2: Verify RED and implement reporting**

Run: `npm run test -- workers/worker-utils.test.ts`

Expected: FAIL before implementation, then PASS after adding optional `FFPROBE_PATH` and startup availability reporting.

- [ ] **Step 3: Replace inline ready-render construction**

In `processRenderClip`, keep draft behavior unchanged. For ready clips:

1. load `clip.raw_data.edit_plan`, falling back to legacy fields;
2. load word timestamps, falling back to fine segments;
3. build timeline and optional `.ass` file;
4. obtain FFmpeg args from `buildReadyRenderCommand`;
5. execute only via `execFileAsync(ffmpegBinary, args)`;
6. run FFprobe with JSON output;
7. validate with `validateProbeResult`;
8. upload only after QA passes.

- [ ] **Step 4: Store successful QA atomically with ready status**

On success update:

```js
{
  render_status: "completed",
  status: "ready",
  raw_data: {
    ...clip.raw_data,
    render_type: "ready",
    rendered_by: "railway_worker",
    render_version: 2,
    quality_check: {
      status: "passed",
      checked_at: new Date().toISOString(),
      details: probeSummary
    }
  }
}
```

On failure set `render_status: "failed"`, leave status out of `ready`, persist structured QA details when available, and let existing job failure fields expose retry information.

- [ ] **Step 5: Parse legacy and new transcript storage**

Update transcript loading to accept:

```js
Array.isArray(segments_json)
  ? { segments: segments_json, words: [] }
  : { segments: segments_json?.segments ?? [], words: segments_json?.words ?? [] }
```

Prefer words for ASS; use segments only as a fallback.

- [ ] **Step 6: Update environment documentation**

Add:

```dotenv
FFPROBE_PATH=ffprobe
```

Document that the Railway worker needs the same `OBJECT_STORAGE_*` values as Vercel whenever originals are stored in R2.

- [ ] **Step 7: Run deterministic checks**

Run: `npm run test -- workers/video-production.test.ts workers/worker-utils.test.ts`

Expected: PASS. No FFmpeg or FFprobe process should be invoked by these tests.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add workers/stream-scan-worker.mjs workers/worker-utils.mjs workers/worker-utils.d.mts workers/worker-utils.test.ts .env.example
git commit -m "Render and validate ready vertical clips"
```

---

### Task 6: Moment Review export controls

**Files:**
- Create: `components/clip-export-form.tsx`
- Modify: `components/moment-review-client.tsx`
- Modify: `lib/types.ts`
- Modify: `app-workflow.test.ts`

**Interfaces:**
- Consumes: `ClipIdea`, v3 defaults, and existing `onExportSubmit` callback.
- Produces: validated form fields consumed by Task 3 without creating a client-only persistence path.

- [ ] **Step 1: Write failing workflow assertions for the controls**

Assert the new component contains labels/values for:

```text
Natural
Cold open
Start
End
Hook start
Hook end
Center
Left
Right
Crop
Blur background
Creator captions
Creator Enhance
```

Also assert `moment-review-client.tsx` imports and renders `ClipExportForm`.

- [ ] **Step 2: Verify RED**

Run: `npm run test -- app-workflow.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Build the compact export form**

Use controlled local state initialized from `idea.start_time`, `idea.end_time`, and `moment_v3`. Render native numeric inputs and selects with stable dimensions and no nested cards. Disable hook inputs for natural mode. Use existing lucide `Play` icon for the export command.

The form must submit these exact names:

```tsx
<input name="startSeconds" />
<input name="endSeconds" />
<select name="hookMode" />
<input name="hookStartSeconds" />
<input name="hookEndSeconds" />
<select name="framingMode" />
<select name="backgroundMode" />
<input type="hidden" name="subtitlePreset" value="creator" />
<input type="checkbox" name="addCaptions" value="true" />
<input type="checkbox" name="enhanceEnabled" value="true" />
```

Default captions and enhancement to enabled, but keep explicit user control.

- [ ] **Step 4: Integrate with existing optimistic export flow**

Replace only the current `Add captions` form in each moment card. Preserve `handleExportSubmit`, polling, error states, existing production status fields, and download card behavior.

- [ ] **Step 5: Show v3 hook metadata**

Update score extraction to prefer `moment_v3`, fall back to `moment_v2`, and show the recommended hook mode and range without removing legacy records.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm run test -- app-workflow.test.ts`

Expected: new control assertions PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/clip-export-form.tsx components/moment-review-client.tsx lib/types.ts app-workflow.test.ts
git commit -m "Add editable ready clip export controls"
```

---

### Task 7: Update workflow contracts and production documentation

**Files:**
- Modify: `app-workflow.test.ts`
- Modify: `docs/worker-railway-deploy.md`
- Modify: `workers/README.md`

**Interfaces:**
- Consumes: final P0 behavior from Tasks 1-6.
- Produces: accurate regression assertions and operator handoff documentation.

- [ ] **Step 1: Replace obsolete v2.1/720p assertions**

Update tests to require:

```ts
expect(worker).toContain('MOMENT_FINDER_VERSION = "v3"');
expect(worker).toContain("1080:1920");
expect(worker).not.toContain("720:1280");
expect(worker).toContain("buildReadyRenderCommand");
expect(worker).toContain("validateProbeResult");
expect(worker).toContain("hook_mode");
expect(worker).toContain("quality_check");
```

Keep existing assertions for object-storage abstraction, optimistic polling, production fields, and no draft-render button.

- [ ] **Step 2: Run workflow tests**

Run: `npm run test -- app-workflow.test.ts`

Expected: PASS.

- [ ] **Step 3: Document production configuration and no-video handoff**

Document:

- migration 006 must be applied before R2 production uploads;
- both Vercel and Railway need the relevant `OBJECT_STORAGE_*` values;
- `FFMPEG_PATH`, `FFPROBE_PATH`, and `YTDLP_PATH` defaults;
- no real-video smoke test was run by Codex;
- user test sequence: direct upload, link import, moment review, natural export, cold-open export, captions, framing, enhancement, download;
- platform imports can break when upstream sites change and direct upload is the supported fallback.

- [ ] **Step 4: Run all unit tests**

Run: `npm run test`

Expected: all test files PASS without media processing or network calls.

- [ ] **Step 5: Commit**

```bash
git add app-workflow.test.ts docs/worker-railway-deploy.md workers/README.md
git commit -m "Document AI production MVP operations"
```

---

### Task 8: Final technical verification and deployment handoff

**Files:**
- Inspect: all changed files
- Modify only if a technical check exposes a defect, following a failing unit test first.

**Interfaces:**
- Consumes: complete implementation.
- Produces: a technically checked branch and explicit list of user-owned manual tests.

- [ ] **Step 1: Review the complete diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git diff --stat main...HEAD`

Expected: changes limited to the P0 files listed in this plan.

- [ ] **Step 2: Run all technical checks**

Run in order:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: all commands exit 0. Do not run `worker:smoke-test`, FFmpeg against media, FFprobe against media, browser testing, uploads, or platform imports.

- [ ] **Step 3: Inspect external configuration without exposing secrets**

Confirm key names and presence only:

- Supabase migration 006 status;
- Railway worker heartbeat/status;
- Railway `OBJECT_STORAGE_*`, OpenAI, Supabase, FFmpeg/FFprobe/yt-dlp key presence;
- Vercel deployment commit and environment key presence.

Do not print secret values and do not process a video.

- [ ] **Step 4: Apply approved external changes**

If migration 006 is absent, apply its existing idempotent SQL. Add only missing environment keys. Redeploy after configuration changes. Do not run post-deploy video tests.

- [ ] **Step 5: Push the completed branch**

Run:

```bash
git status --short
git log --oneline --decorate -8
git push
```

Expected: clean worktree and successful push.

- [ ] **Step 6: Deliver the manual test checklist**

State explicitly:

- implementation status;
- technical check results;
- deployment status;
- migrations and environment changes;
- no real video was tested by Codex;
- upload/import/render/visual quality remain for the user to validate;
- exact manual sequence for direct upload, CZ/SK moments, cold open, captions, Creator Enhance, edits, rerender, and download.

---

## Plan Self-Review

- **Spec coverage:** ingest remains intact; v3 moment discovery/ranking/verification, grounded hook, editable cold open, 1080x1920 render, creator ASS captions, framing/background modes, enhancement, review controls, QA, retries, documentation, and deployment handoff each have an owning task.
- **Scope:** account generation, publishing, MyLaura campaign logic, multitrack editing, full visual AI, face tracking, and real-video testing are explicitly excluded.
- **Data compatibility:** existing `moment_v2` and legacy `segments_json` records remain readable; new records use `moment_v3` and `edit_plan` under JSONB.
- **Security:** all process execution uses argument arrays, secrets are never printed, browser uploads continue through signed URLs, and platform protections are not bypassed.
- **Ambiguity resolved:** cold-open duplication is prevented by removing the hook interval from the subsequent body timeline; invalid AI hook output falls back to natural mode.
- **No placeholders:** every task identifies exact files, interfaces, tests, commands, expected outcomes, and commit boundaries.
