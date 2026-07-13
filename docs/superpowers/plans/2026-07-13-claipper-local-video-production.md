# Claipper Local Video Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claipper run the presentation workflow locally on the operator's Mac: manually upload a long video plus optional Kick chat JSON, find ranked CZ/SK moments, render polished 9:16 clips, and support a small rerender edit without cloud media storage.

**Architecture:** Keep Next.js and Supabase records as the existing UI and workflow model. Add a loopback-only Fastify local agent for streamed uploads and local media, then teach the existing worker to use a `local` source provider and local render destinations. Extract chat normalization and chunked transcription logic into pure modules so long-video and chat behavior can be tested without processing real media.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase Postgres, Node.js ESM worker, Fastify, `@fastify/cors`, `@fastify/multipart`, OpenAI, FFmpeg/FFprobe, Vitest.

## Global Constraints

- Work only on `codex/ai-production-mvp`; do not merge to `main`.
- Store media beneath `/Users/paradajko/ClaipperStorage` and persist only relative local paths in Supabase.
- Do not use Railway, R2, S3, or Supabase Storage for source videos, audio, subtitles, previews, or ready clips in local mode.
- Support manual MP4, MOV, MKV, or WEBM upload; disable URL import in the presentation UI.
- Accept the supplied Kick chat array shape with `content`, `createdAt`, `userId`, and `username`.
- Use transcript evidence for grounding; chat is a supporting ranking signal and cannot create an ungrounded moment.
- Keep ready output at 1080x1920 H.264/AAC with existing cold-open, creator captions, framing, enhance, loudness, and FFprobe QA behavior.
- Codex must not upload, import, transcribe, render, or inspect a real video. The user runs the final media test.
- Run focused tests after each task and full `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before completion.

## File Structure

- `workers/local-storage.mjs`: safe local provider paths and directory layout.
- `workers/kick-chat.mjs`: parse, normalize, suppress spam, aggregate, and align Kick chat.
- `workers/audio-chunks.mjs`: deterministic chunk plans and transcript timestamp merging.
- `workers/local-agent.mjs`: loopback HTTP process entrypoint.
- `workers/local-agent-server.mjs`: testable Fastify server factory and route handlers.
- `workers/stream-scan-worker.mjs`: orchestration only; consume the focused modules above.
- `components/content-lab-ingest.tsx`: local video/chat upload UI and progress.
- `lib/supabase.ts`: resolve local media records to loopback media URLs.
- `.env.example`, `workers/README.md`, `docs/worker-local-test.md`: exact local startup and manual test instructions.

---

### Task 1: Local Storage Provider

**Files:**
- Create: `workers/local-storage.mjs`
- Create: `workers/local-storage.d.mts`
- Create: `workers/local-storage.test.ts`
- Modify: `lib/types.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `createLocalVideoLayout(root, videoId, extension)`, `resolveLocalMediaPath(root, relativePath)`, and `localRelativePath(...parts)`.
- Guarantees: every resolved path remains under the configured root and IDs are UUIDs.

- [ ] **Step 1: Write failing path-safety tests**

```ts
expect(createLocalVideoLayout(root, videoId, "mp4").sourceRelativePath)
  .toBe(`${videoId}/original/source.mp4`);
expect(() => resolveLocalMediaPath(root, "../secret")).toThrow("outside local storage root");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- workers/local-storage.test.ts`
Expected: FAIL because `local-storage.mjs` does not exist.

- [ ] **Step 3: Implement deterministic safe paths**

```js
export function resolveLocalMediaPath(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Path is outside local storage root.");
  }
  return resolved;
}
```

Add `"local"` to `source_storage_provider` types and document `CLAIPPER_LOCAL_STORAGE_DIR`, `CLAIPPER_STORAGE_MODE=local`, `CLAIPPER_LOCAL_AGENT_PORT=43120`, and `CLAIPPER_LOCAL_AGENT_TOKEN`.

- [ ] **Step 4: Run focused tests, typecheck, and commit**

Run: `npm test -- workers/local-storage.test.ts && npm run typecheck`
Commit: `Support safe local video storage`

---

### Task 2: Kick Chat Normalization And Signals

**Files:**
- Create: `workers/kick-chat.mjs`
- Create: `workers/kick-chat.d.mts`
- Create: `workers/kick-chat.test.ts`

**Interfaces:**
- Produces: `normalizeKickChat(input, { offsetSeconds })` and `buildChatWindows(messages, { windowSeconds })`.
- Normalized message: `{ timestamp_seconds, username, message, emotes }`.
- Chat window: `{ start_seconds, end_seconds, message_count, unique_users, messages_per_minute, emote_counts, representative_messages, activity_score }`.

- [ ] **Step 1: Write failing tests using a small representative fixture**

```ts
const input = [
  { content: "[emote:37226:KEKW]", createdAt: "2026-06-28T15:49:43Z", userId: 1, username: "one" },
  { content: "clipni to", createdAt: "2026-06-28T15:49:48Z", userId: 2, username: "two" }
];
expect(normalizeKickChat(input, { offsetSeconds: 2 })[1].timestamp_seconds).toBe(7);
expect(normalizeKickChat(input, { offsetSeconds: 2 })[0].emotes).toEqual(["KEKW"]);
```

Add cases for invalid dates, blank content, repeated promo text, command spam, one-user flooding, unique-user spikes, and negative manual offsets.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- workers/kick-chat.test.ts`
Expected: FAIL because parser exports are missing.

- [ ] **Step 3: Implement normalization and bounded aggregation**

Use the earliest valid `createdAt` as zero, preserve the raw file unchanged, parse `[emote:<id>:<name>]`, cap each user/message contribution per window, and choose representative non-promo reactions. Do not include usernames in the prompt-ready window representation.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- workers/kick-chat.test.ts`
Commit: `Add Kick chat activity signals`

---

### Task 3: Streamed Local Agent Upload And Media API

**Files:**
- Create: `workers/local-agent-server.mjs`
- Create: `workers/local-agent.mjs`
- Create: `workers/local-agent-server.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Task 1 local layout and Task 2 chat parser.
- Produces: `buildLocalAgent({ env, supabase, toolChecks })` for tests and a `worker:local-agent` script.
- HTTP: `GET /health`, `POST /uploads`, `GET /media/*` with byte-range support.

- [ ] **Step 1: Install server dependencies**

Run: `npm install fastify @fastify/cors @fastify/multipart`

- [ ] **Step 2: Write failing API tests**

Use Fastify `inject()` for health/auth/path tests and a temporary directory for upload tests. Assert that a multi-megabyte stream is piped to disk, the optional JSON is stored, the response returns `{ videoId, href }`, and `../` media paths return 400. Assert `Range: bytes=0-3` returns 206 and four bytes.

- [ ] **Step 3: Implement the loopback server**

```js
const app = Fastify({ logger: true, bodyLimit: maxUploadBytes });
await app.register(multipart, { limits: { files: 2, fileSize: maxUploadBytes } });
app.post("/uploads", { preHandler: requireAgentToken }, uploadHandler);
app.get("/media/*", localMediaHandler);
```

Generate the UUID in the agent, stream the video and optional chat directly to Task 1 paths, validate extension/MIME/JSON size, create `videos` plus `processing_jobs` records, and return the Claipper detail URL. Health and loopback media GETs expose no secrets; mutating routes require `X-Claipper-Agent-Token`.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- workers/local-agent-server.test.ts workers/local-storage.test.ts workers/kick-chat.test.ts`
Commit: `Add streamed Claipper local agent`

---

### Task 4: Local Worker Source And Render Destinations

**Files:**
- Modify: `workers/stream-scan-worker.mjs`
- Modify: `workers/worker-utils.mjs`
- Modify: `workers/worker-utils.d.mts`
- Modify: `workers/worker-utils.test.ts`
- Modify: `workers/stream-scan-worker-contract.test.ts`

**Interfaces:**
- Consumes: `source_storage_provider = "local"` and relative source/chat paths.
- Produces: local `audio_path`, clip `storage_bucket = "local"`, and relative clip `storage_path` values.

- [ ] **Step 1: Write failing local-mode worker tests**

Assert local mode does not require Supabase Storage bucket variables or yt-dlp Chrome impersonation, rejects `platform_import`, resolves sources without downloading/copying them, does not call `uploadFile`, writes rendered files to the stable clip directory, and cleans only disposable working files.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- workers/worker-utils.test.ts workers/stream-scan-worker-contract.test.ts`

- [ ] **Step 3: Implement provider branches without changing Moment Finder or render logic**

Add helpers such as:

```js
function isLocalMode() {
  return process.env.CLAIPPER_STORAGE_MODE === "local";
}

function sourcePathForVideo(video) {
  if (getVideoSourceStorageProvider(video) !== "local") return null;
  return resolveLocalMediaPath(localStorageRoot, getVideoSourceStoragePath(video));
}
```

Keep Supabase/R2 code available for future cloud mode, but local mode must not read or write cloud media.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- workers/worker-utils.test.ts workers/stream-scan-worker-contract.test.ts workers/local-storage.test.ts`
Commit: `Run Claipper worker against local media`

---

### Task 5: Chunked Long-Video Transcription

**Files:**
- Create: `workers/audio-chunks.mjs`
- Create: `workers/audio-chunks.d.mts`
- Create: `workers/audio-chunks.test.ts`
- Modify: `workers/stream-scan-worker.mjs`
- Modify: `workers/stream-scan-worker-contract.test.ts`

**Interfaces:**
- Produces: `buildAudioChunkPlan(durationSeconds, { chunkSeconds: 600, overlapSeconds: 5 })` and `mergeVerboseTranscripts(chunks)`.
- Chunk transcript input includes `{ offsetSeconds, transcript }`; merged output preserves absolute segment and word timestamps.

- [ ] **Step 1: Write failing plan and merge tests**

```ts
expect(buildAudioChunkPlan(142 * 60 + 27)).toHaveLength(15);
expect(mergeVerboseTranscripts([
  { offsetSeconds: 0, transcript: { words: [{ start: 599, end: 600, word: "ahoj" }] } },
  { offsetSeconds: 595, transcript: { words: [{ start: 4, end: 5, word: "ahoj" }] } }
]).words).toHaveLength(1);
```

Cover short videos, final partial chunks, overlap de-duplication, and absolute timestamps.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- workers/audio-chunks.test.ts`

- [ ] **Step 3: Implement FFprobe-driven chunk extraction and sequential transcription**

Probe source duration, extract mono 16 kHz MP3 chunks at 48 kbps with argument-array FFmpeg calls, transcribe one bounded file at a time, offset timestamps, deduplicate overlap, and remove chunk files after merging. Keep the merged transcript schema consumed by existing Moment Finder.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- workers/audio-chunks.test.ts workers/stream-scan-worker-contract.test.ts`
Commit: `Transcribe long videos in bounded chunks`

---

### Task 6: Chat-Enriched Moment Finder

**Files:**
- Modify: `workers/stream-scan-worker.mjs`
- Modify: `lib/stream-scan.ts`
- Modify: `lib/stream-scan.test.ts`
- Modify: `workers/stream-scan-worker-contract.test.ts`

**Interfaces:**
- Consumes: Task 2 normalized chat windows.
- Adds to candidate `raw_data.moment_v3`: `chat_activity_score`, `chat_message_count`, `chat_unique_users`, `chat_emote_spike`, and `chat_signal_reason`.

- [ ] **Step 1: Write failing ranking tests**

Assert a transcript-grounded candidate with a genuine multi-user chat spike receives a bounded boost, a promo-only spike receives none, and chat cannot keep a candidate whose transcript recommendation is `skip` or whose quote is ungrounded.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- lib/stream-scan.test.ts workers/stream-scan-worker-contract.test.ts`

- [ ] **Step 3: Add chat summaries to segment prompts and deterministic ranking**

Send only aggregate counts, emote names, and representative message text. Add a maximum chat boost so transcript attention, hook, and payoff remain dominant. Persist the signal metadata for review.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- lib/stream-scan.test.ts workers/kick-chat.test.ts workers/stream-scan-worker-contract.test.ts`
Commit: `Use Kick chat to rank grounded moments`

---

### Task 7: Local Clip Playback And Existing Ready Render

**Files:**
- Modify: `lib/supabase.ts`
- Modify: `lib/types.ts`
- Modify: `workers/stream-scan-worker.mjs`
- Modify: `workers/video-production.test.ts`
- Modify: `workers/stream-scan-worker-contract.test.ts`

**Interfaces:**
- Produces local media URLs from `storage_bucket = "local"` and safe relative `storage_path` values.
- Keeps `normalizeEditPlan`, `buildRenderTimeline`, `buildAssDocument`, `buildReadyRenderCommand`, and `validateProbeResult` behavior unchanged.

- [ ] **Step 1: Write failing local media and render persistence tests**

Assert local clip URLs resolve to `http://127.0.0.1:43120/media/<encoded-relative-path>`, ready output remains 1080x1920 H.264/AAC, and completion persists the local path plus passed QA without cloud upload.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- workers/video-production.test.ts workers/stream-scan-worker-contract.test.ts lib/worker-health.test.ts`

- [ ] **Step 3: Implement local completion path**

Copy or render directly to `<video-id>/clips/<clip-id>/ready.mp4`, write captions beside it, call the existing atomic completion RPC with local storage metadata, and return loopback URLs from the server data loader.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- workers/video-production.test.ts workers/stream-scan-worker-contract.test.ts`
Commit: `Serve ready clips from local storage`

---

### Task 8: Claipper Upload And Review UI

**Files:**
- Modify: `components/content-lab-ingest.tsx`
- Modify: `app/app/content-lab/page.tsx`
- Modify: `components/moment-review-client.tsx`
- Modify: `app-workflow.test.ts`
- Modify: `app/globals.css` only if the existing controls need responsive support.

**Interfaces:**
- Consumes local agent health/upload/media endpoints and existing Supabase polling.
- Upload form fields: title, required video, optional chat JSON, optional numeric chat offset.

- [ ] **Step 1: Write failing UI contract tests**

Assert the link tab and import call are absent, the chat input accepts `.json`, upload uses `NEXT_PUBLIC_CLAIPPER_AGENT_URL`, the agent token is read from browser-local storage, progress uses XHR multipart upload, and agent-offline errors are actionable.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- app-workflow.test.ts`

- [ ] **Step 3: Implement the local-first upload surface**

Use one clear upload workflow, show selected video/chat names, add an optional offset control, verify `/health`, stream `FormData` through XHR for progress, and navigate to the returned detail route. Keep existing moment review, edit-plan controls, polling, status badges, and rerender actions.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- app-workflow.test.ts components/landing-client.test.ts`
Commit: `Connect Content Lab to local agent`

---

### Task 9: One-Command Local Runtime And Verification

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `workers/README.md`
- Modify: `docs/worker-local-test.md`
- Modify: `app/app/settings/page.tsx`

**Interfaces:**
- Produces: `npm run dev:local` for Next.js, local agent, and local worker.

- [ ] **Step 1: Add the local runtime command and environment validation**

Use `concurrently` with clear process names. Document exact `.env.local` values, directory creation, Railway shutdown, Supabase migration requirement, health URL, and the manual test sequence using video plus chat JSON.

- [ ] **Step 2: Run complete automated verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
node --check workers/local-agent.mjs
node --check workers/local-agent-server.mjs
node --check workers/stream-scan-worker.mjs
git diff --check
```

Expected: every command exits 0. Do not run a real media upload or FFmpeg/OpenAI media job.

- [ ] **Step 3: Start the local runtime without media processing**

Run `npm run dev:local`, verify Next.js and `GET http://127.0.0.1:43120/health` start without errors, then leave the processes running for the user's manual test.

- [ ] **Step 4: Commit and report**

Commit: `Document and verify local Claipper runtime`

Report the Claipper URL, local-agent health, storage directory, commit hashes, exact manual test sequence, and remaining limitations. Do not merge to `main` or deploy Railway.
