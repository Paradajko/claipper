# Claipper Worker Local Test

Use this to verify the current Stream Scan flow end-to-end:

Direct upload or platform import -> Supabase Storage -> `processing_jobs` -> external worker -> transcript/clip ideas/draft clips -> Supabase Storage -> UI status.

## 1. Set env vars

Create `.env.local` from `.env.example` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=

STORAGE_BUCKET_ORIGINALS=original-videos
STORAGE_BUCKET_AUDIO=extracted-audio
STORAGE_BUCKET_CLIPS=rendered-clips
STORAGE_BUCKET_SUBTITLES=subtitles

WORKER_ID=local-worker
WORKER_POLL_INTERVAL_MS=3000
FFMPEG_PATH=ffmpeg
YTDLP_PATH=yt-dlp
```

Install local binaries if needed:

```bash
brew install ffmpeg yt-dlp
```

## 2. Run migrations

```bash
supabase db push --linked
```

This creates the worker heartbeat table, processing job debug fields, and required Storage buckets.

## 3. Smoke test the worker environment

```bash
npm run worker:smoke-test
```

Every line should show `PASS`. This does not process video. It only checks Supabase, buckets, tables, a test job insert/update/delete, FFmpeg, yt-dlp, and OpenAI env presence.

## 4. Start Next app

```bash
npm run dev
```

Open `/app/content-lab`.

## 5. Start worker

In another terminal:

```bash
npm run worker:stream-scan
```

Expected startup output:

```text
Claipper Stream Scan Worker
Worker ID: local-worker
Supabase: connected
OpenAI key: present
FFmpeg: available
yt-dlp: available
Buckets:
- original-videos
- extracted-audio
- rendered-clips
Polling every 3000ms
```

The Content Lab worker card should change to `Worker connected` within a few seconds.

## 6. Upload a short MP4

Use the Upload video tab in Content Lab. Pick a short MP4 first, ideally under 2 minutes for the first test.

Expected UI flow:

1. Upload progress appears.
2. Video opens on its detail page.
3. Recent videos shows the processing job status and current step.
4. Worker logs show steps:
   - `downloading_source`
   - `extracting_audio`
   - `uploading_audio`
   - `transcribing`
   - `saving_transcript`
   - `segmenting`
   - `analyzing_segments`
   - `ranking_candidates`
   - `saving_clip_ideas`
   - `ready`
5. Clip ideas appear on the video detail page.

## 7. Debug failures

Content Lab shows:

- worker connected/not connected
- last seen time
- current job id
- video status
- processing job status
- current step
- progress
- clean error message

In development, `/app/content-lab/[id]` also shows a developer debug panel with video id, storage path, job id, worker id, current step, technical error, transcript count, segment count, and clip idea count.

## Common errors and fixes

### Missing env vars

Run:

```bash
npm run worker:smoke-test
```

The smoke test prints exactly which env vars are missing.

### Worker offline

Content Lab shows:

```text
Processing worker is not connected. Uploaded videos will wait in queue.
```

Start:

```bash
npm run worker:stream-scan
```

### Bucket not found

Run migrations:

```bash
supabase db push --linked
```

Then run:

```bash
npm run worker:smoke-test
```

### Supabase permission denied

Use `SUPABASE_SERVICE_ROLE_KEY` for the worker. Do not use the anon key for worker processing.

### FFmpeg not found

Install FFmpeg or set `FFMPEG_PATH`:

```bash
brew install ffmpeg
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg npm run worker:stream-scan
```

### yt-dlp not found

Install yt-dlp or set `YTDLP_PATH`:

```bash
brew install yt-dlp
YTDLP_PATH=/opt/homebrew/bin/yt-dlp npm run worker:stream-scan
```

### OpenAI key missing

Set `OPENAI_API_KEY` in `.env.local`. The worker fails fast without it.

### Transcription failed

Check worker logs and the development debug panel. Common causes are unsupported media audio, invalid OpenAI key, or a source file without audio.

### AI returned invalid JSON

The worker keeps processing other segments, but if no valid candidates are saved, inspect the worker logs and transcript segment text.
