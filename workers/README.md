# Claipper Stream Scan Worker

Run this process outside Vercel on Railway, Render, Fly.io, a VPS, or another Docker-capable host.

```bash
npm install
npm run worker:smoke-test
npm run worker:stream-scan
```

Required environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `FFMPEG_PATH` or `ffmpeg` available on `PATH`
- `FFPROBE_PATH` or `ffprobe` available on `PATH`
- `YTDLP_PATH` or `yt-dlp` available on `PATH` for platform imports
- `WORKER_ID`
- `WORKER_POLL_INTERVAL_MS`

Before using R2 originals, apply `supabase/migrations/006_r2_original_video_storage.sql` and set the same object-storage values on Railway and Vercel:

- `OBJECT_STORAGE_PROVIDER`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_REGION`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`

The worker polls `processing_jobs`, downloads source files from Supabase Storage, runs FFmpeg/OpenAI analysis, writes transcript segments and clip ideas to Postgres, and uploads rendered draft clips back to Supabase Storage.

The worker also updates `worker_heartbeats` every 15 seconds so Content Lab can show whether processing is connected or offline.

## Manual video handoff

No real video was tested by Codex. After deployment, the user must upload a CZ/SK source and verify moment quality, one Natural export, one Cold open export, Creator captions, Creator Enhance, framing/background changes, rerendering, and the final download.
