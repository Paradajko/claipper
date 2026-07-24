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
- `YTDLP_PATH` or `yt-dlp` available on `PATH` for platform imports
- `WORKER_ID`
- `WORKER_POLL_INTERVAL_MS`

The worker polls `processing_jobs`, downloads source files from Supabase Storage, runs FFmpeg/OpenAI analysis, writes transcript segments and clip ideas to Postgres, and uploads rendered draft clips back to Supabase Storage.

The worker also updates `worker_heartbeats` every 15 seconds so Content Lab can show whether processing is connected or offline.

## Campaign Analyzer

Campaign Analyzer uses the same worker poll loop and `processing_jobs` table through the `campaign_analysis` job type. YouTube and clipper metadata use yt-dlp with `--skip-download`; Kick VOD metadata uses Kick's public API v2 through the Docker image's `curl_cffi` TLS impersonation. Neither path writes video, audio, subtitles, or thumbnails.

YouTube, Kick, and the optional clipper channel are processed independently. One source failure does not stop the others, and a failed refresh preserves earlier successful metadata as stale. This feature uses neither OpenAI nor the YouTube API and needs no new API key.
