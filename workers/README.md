# Claipper Local Production Runtime

The presentation MVP runs all media work on the operator Mac. Supabase stores structured records, job state, transcripts, moments, and render metadata. Original videos, chat exports, temporary audio chunks, subtitles, and rendered clips stay under `CLAIPPER_LOCAL_STORAGE_DIR`.

## Processes

`npm run dev:local` loads the existing Supabase/OpenAI credentials from the linked Railway service, then starts three local processes:

- Next.js at `http://127.0.0.1:3000`
- the token-protected local upload/media agent at `http://127.0.0.1:43120`
- the Stream Scan worker that polls Supabase and runs FFmpeg, FFprobe, OpenAI transcription, Moment Finder, captions, rendering, and QA

The local agent accepts a streamed video plus optional Kick chat JSON. Platform URL imports and yt-dlp are disabled in local mode.

## Required environment

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TRANSCRIBE_MODEL=whisper-1

CLAIPPER_STORAGE_MODE=local
CLAIPPER_LOCAL_STORAGE_DIR=/Users/paradajko/ClaipperStorage
CLAIPPER_LOCAL_AGENT_PORT=43120
CLAIPPER_LOCAL_AGENT_TOKEN=<random-secret>
CLAIPPER_LOCAL_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CLAIPPER_LOCAL_MAX_UPLOAD_SIZE_MB=20000
NEXT_PUBLIC_CLAIPPER_AGENT_URL=http://127.0.0.1:43120
NEXT_PUBLIC_CLAIPPER_LOCAL_MAX_UPLOAD_SIZE_MB=20000

WORKER_ID=claipper-mac
WORKER_POLL_INTERVAL_MS=3000
FFMPEG_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
FFPROBE_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffprobe
APP_PASSWORD=
```

Generate the local token with `openssl rand -hex 32`. Enter the same value once in the Content Lab token field; the browser keeps it in local storage.

The removed Railway deployment does not run any worker. `railway run` is used only as a secure environment-variable source for the Mac processes; no media is sent to Railway. Cloud bucket, R2/S3, and yt-dlp variables are not used while `CLAIPPER_STORAGE_MODE=local`.

If the API credentials are filled directly in `.env.local`, `npm run dev:local:processes` starts the same runtime without Railway CLI injection.

## Dependencies and database

Install the full FFmpeg build. Claipper requires its `libass`-backed `subtitles` filter for creator captions:

```bash
brew install ffmpeg-full
npm install
```

Apply Supabase migrations `001` through `007`. This branch adds no new SQL migration; it uses the existing `videos`, `transcripts`, `transcript_segments`, `clip_ideas`, `clips`, `processing_jobs`, and `worker_heartbeats` schema.

## Start

```bash
mkdir -p /Users/paradajko/ClaipperStorage
npm run dev:local
```

Health check: `http://127.0.0.1:43120/health`.

## Output

For each MP4, MOV, MKV, WEBM, MPG, or MPEG video, Claipper creates an isolated directory containing the original, optional raw and normalized chat, metadata, temporary working files, captions, previews, and ready clips. Ready clips are rendered as 1080x1920 H.264/AAC MP4 with word-timed ASS captions and FFprobe QA.

No real video was tested by Codex. The operator performs the first media upload, quality review, Natural export, Cold open export, Creator Enhance check, framing/background comparison, and final download.

## Cloud worker

The previous Railway/R2 path remains in code for later cloud deployment, but the Railway worker must stay stopped during local testing so only the Mac claims jobs.
