# Claipper Local Agent Design

**Date:** 2026-07-13
**Status:** Approved architecture

## Goal

Run the complete Claipper presentation workflow on the operator's Mac. Claipper accepts a manually selected long video, shows processing progress and ranked clip candidates, renders polished vertical clips, and supports a small edit followed by rerendering. MyLaura integration and link imports are out of scope.

No source video, extracted audio, subtitle file, or rendered clip is uploaded to Supabase Storage, R2, Railway, or another cloud object store. Supabase remains the shared metadata database and job queue.

## System Boundary

### Claipper UI

- Runs locally in the existing Next.js application and provides the upload, progress, review, and basic edit UI.
- Detects whether the local Claipper agent is available before enabling manual upload.
- Sends the selected video directly from the browser to the local agent.
- Reads durable job, transcript, moment, and clip metadata from Supabase.
- Loads preview and rendered media from the local agent on the same Mac.

### Claipper Local Agent

- Runs only on the operator's Mac and binds to the loopback interface.
- Receives manual browser uploads without routing video bytes through Vercel or Supabase.
- Stores all media beneath `/Users/paradajko/ClaipperStorage`.
- Runs FFmpeg, FFprobe, OpenAI transcription, Moment Finder, subtitle generation, and rendering.
- Writes status, progress, transcript, moment, clip, and error records to Supabase.
- Serves local preview and rendered media to the browser.
- Accepts a constrained edit plan and rerenders the selected clip.

### Supabase

Supabase stores only structured records:

- videos and local source references;
- processing jobs, progress, leases, and errors;
- worker heartbeat;
- transcript and timestamped transcript segments;
- ranked clip ideas and grounded hooks;
- clip edit plans, render state, and performance metadata.

Supabase Storage buckets are not used in this phase.

### Disabled Services

- Railway worker is disabled to prevent two workers from claiming the same job.
- R2 and generic S3 object storage are unused.
- Platform link imports and MyLaura integration are disabled for this phase.

## Local Storage Layout

Each video uses a stable ID and a dedicated directory:

```text
/Users/paradajko/ClaipperStorage/
  <video-id>/
    original/
      source.<ext>
      chat.json
    working/
      audio.mp3
      transcript-chunks/
      subtitles/
      normalized-chat.json
    clips/
      <clip-id>/
        preview.mp4
        ready.mp4
        captions.ass
    metadata.json
```

Supabase stores only paths relative to the storage root, never the operator's absolute home-directory path.

Temporary files are removed after a successful stage. The original and ready clips remain until explicitly deleted. Failed jobs preserve diagnostics while disposable partial files are cleaned up.

## Data Flow

1. The local Claipper page checks `GET http://127.0.0.1:43120/health`.
2. The operator selects a supported local video file and may add a Kick chat JSON export.
3. Claipper sends the video and optional chat JSON as a streamed multipart upload to the local agent. The browser does not create database records directly.
4. The agent generates the video ID, writes the upload directly to `<video-id>/original`, creates the Supabase records, and returns the video ID to Claipper. Supabase receives `source_storage_provider = local` plus a relative source path.
5. The agent validates the source with FFprobe and queues or starts analysis.
6. The agent normalizes chat messages, converts absolute `createdAt` timestamps to video-relative seconds, extracts emotes, and removes repeated bot or promotional noise. The first chat timestamp is the default zero point; a manual `chat_offset_seconds` value can correct synchronization without rewriting the source JSON.
7. FFmpeg extracts audio locally. Long audio is processed in bounded chunks so transcription requests remain within provider limits.
8. The agent merges timestamped transcript chunks and adds bounded chat windows containing message velocity, unique-user count, emote spikes, and representative reactions.
9. Moment Finder uses transcript evidence as the required grounding source and chat activity as a supporting ranking signal. It then grounds and verifies candidates and stores the results in Supabase.
10. Claipper displays ranked moments and local previews.
11. The operator approves a moment or changes supported edit settings.
12. The agent renders the 9:16 clip locally, runs FFprobe quality checks, and exposes the result through a local media endpoint.
13. Claipper displays and downloads the ready clip from the local agent. MyLaura and cloud delivery are later phases.

## Local API

The initial API is intentionally small:

- `GET /health` reports agent readiness and tool availability.
- `POST /uploads` streams one manually selected video plus an optional Kick chat JSON file, creates the video ID, and returns that ID.
- `GET /media/videos/:videoId/source` serves browser-compatible source playback when available.
- `GET /media/clips/:clipId/:variant` serves preview or ready output.
- `POST /clips/:clipId/render` accepts the existing constrained edit-plan schema and queues rerendering.

The browser never submits arbitrary filesystem paths or shell arguments. IDs are validated as UUIDs, filenames are normalized, and FFmpeg continues to use argument arrays.

## Kick Chat Format

The presentation parser accepts the supplied array export shape:

```json
{
  "content": "[emote:37226:KEKW]",
  "createdAt": "2026-06-28T15:49:43Z",
  "userId": 4434348,
  "username": "viewer"
}
```

It produces normalized records with `timestamp_seconds`, `username`, `message`, and extracted emote names. Invalid timestamps and empty messages are rejected. Repeated identical promotions, chat commands, and high-frequency messages from one user are suppressed before aggregation. Ranking considers activity from multiple unique users more strongly than repeated messages from one account. Raw usernames are not included in AI prompts unless required for understanding a reply.

## Browser Connectivity And Security

- The agent binds to `127.0.0.1`, not the LAN interface.
- CORS allows only configured Claipper local-development origins.
- Requests require `X-Claipper-Agent-Token`. The same token is stored in the Mac environment and entered once into Claipper on the presentation Mac, where it remains in browser-local storage rather than Supabase.
- Health checks return no secrets or filesystem paths.
- Private-network preflight requests are handled explicitly for the supported browser.
- The presentation browser and local agent run on the same Mac.

## Persistence And Recovery

- Supabase remains the durable source for workflow state and metadata.
- Local files survive browser refreshes and agent restarts.
- The agent heartbeat distinguishes `online`, `busy`, and `offline`.
- Interrupted jobs can be reclaimed only by the same configured local worker after their lease expires.
- A missing local file produces a clear user error and a detailed technical error in the processing job.
- The UI explains that local media is unavailable when the agent or Mac is offline.

## Presentation Scope

Included:

- local Claipper upload, progress, review, and edit UI;
- direct browser-to-local-agent upload;
- optional Kick chat JSON upload and timeline synchronization;
- local source validation and processing;
- CZ/SK transcription and ranked moment detection;
- local 9:16 preview and ready render;
- captions and existing creator edit settings;
- basic rerender after a small edit;
- progress and errors visible in Claipper.

Excluded:

- Kick, Twitch, YouTube, or other URL downloads;
- MyLaura integration;
- Railway processing;
- R2 or Supabase media storage;
- sharing local clips from another computer;
- automatic social publishing;
- account generation;
- MyLaura campaign and payout logic.

## Testing And Acceptance

Automated verification covers:

- local-path validation and traversal prevention;
- streamed upload behavior without buffering the whole video;
- supplied Kick chat JSON parsing, emote extraction, spam suppression, aggregation, and offset correction;
- CORS and local-agent authentication;
- local provider metadata persistence;
- job claiming and heartbeat behavior;
- local media endpoint range requests;
- edit-plan validation and rerender queueing;
- existing unit tests, typecheck, lint, and production build.

Codex does not upload or process a real video. The operator performs the final manual test from Claipper on the presentation Mac and verifies video plus chat upload, synchronization, progress, moment quality, preview, small edit, rerender, and playback.

## Later Production Migration

The local-agent interface keeps media storage behind a provider boundary. A later production phase can replace local paths with R2/S3 objects, move workers to managed compute, and integrate the workflow into MyLaura without changing the Supabase metadata model.
