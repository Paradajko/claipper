# Claipper Stream Scan Worker

Run this process outside Vercel on Railway, Render, Fly.io, a VPS, or another Docker-capable host.

```bash
npm install
npm run worker:stream-scan
```

Required environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `FFMPEG_PATH` or `ffmpeg` available on `PATH`
- `YTDLP_PATH` or `yt-dlp` available on `PATH` for platform imports

The worker polls `processing_jobs`, downloads source files from Supabase Storage, runs FFmpeg/OpenAI analysis, writes transcript segments and clip ideas to Postgres, and uploads rendered draft clips back to Supabase Storage.
