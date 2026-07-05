# Deploy Claipper Stream Scan Worker to Railway

The Claipper web app stays on Vercel. The Stream Scan worker must run as a separate long-running Railway service.

The worker command is:

```bash
npm run worker:stream-scan
```

Do not run FFmpeg, yt-dlp, platform imports, transcription, AI analysis, or draft rendering in Vercel API routes.

## Files Used

- `Dockerfile` installs Node.js runtime dependencies, FFmpeg, Python, pip, and `yt-dlp`.
- `railway.json` tells Railway to build with the Dockerfile and start `npm run worker:stream-scan`.
- `workers/stream-scan-worker.mjs` polls Supabase `processing_jobs` and updates `worker_heartbeats`.
- `workers/stream-scan-smoke-test.mjs` verifies the worker environment without processing video.

## Create Railway Service

1. Open Railway.
2. Create a new project or open the existing Claipper project.
3. Add a new service from the Claipper GitHub repository.
4. Name it `claipper-stream-scan-worker`.
5. Set the service root to the repository root.
6. Railway should detect `railway.json` and build using the Dockerfile.
7. Confirm the start command is:

```bash
npm run worker:stream-scan
```

If Railway UI asks for build settings:

- Builder: Dockerfile
- Dockerfile path: `Dockerfile`
- Start command: `npm run worker:stream-scan`

## Required Environment Variables

Set these on the Railway worker service:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
STORAGE_BUCKET_ORIGINALS=original-videos
STORAGE_BUCKET_AUDIO=extracted-audio
STORAGE_BUCKET_CLIPS=rendered-clips
WORKER_ID=railway-stream-worker-1
WORKER_POLL_INTERVAL_MS=3000
```

Optional:

```bash
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
WORKER_SECRET=...
```

Security rule: `SUPABASE_SERVICE_ROLE_KEY` belongs only on the Railway worker service. Do not expose it to browser code.

## Verify FFmpeg and yt-dlp

The Dockerfile installs both:

```bash
ffmpeg -version
yt-dlp --version
```

The worker startup report also checks both binaries:

```text
FFmpeg: available
yt-dlp: available
```

## Run Smoke Test

Before switching the Railway service to the long-running worker command, you can temporarily set the start command to:

```bash
npm run worker:smoke-test
```

Expected output:

```text
PASS required worker env vars
PASS Supabase connection
PASS bucket original-videos
PASS bucket extracted-audio
PASS bucket rendered-clips
PASS table videos
PASS table processing_jobs
PASS table worker_heartbeats
PASS create test processing job
PASS update test processing job
PASS delete test processing job
PASS ffmpeg available
PASS yt-dlp available
PASS OpenAI key present
PASS worker smoke test
```

After the smoke test passes, set the start command back to:

```bash
npm run worker:stream-scan
```

## Expected Worker Startup

Railway logs should show:

```text
Claipper Stream Scan Worker
Worker ID: railway-stream-worker-1
Supabase: connected
OpenAI key: present
FFmpeg: available
yt-dlp: available
Buckets:
- original-videos
- extracted-audio
- rendered-clips
Polling every 3000ms
Environment: production
```

If a required env var is missing, the worker exits with a readable message and does not poll broken.

## Confirm Heartbeat in Claipper UI

1. Open `https://claipper.com/app/content-lab`.
2. Check the worker status card.
3. It should show `Worker connected`.
4. `Last seen` should be under 60 seconds.

If it shows:

```text
Processing worker is not connected. Uploaded videos will wait in queue.
```

check Railway logs and env vars.

## Test With a Short MP4

1. Open `https://claipper.com/app/content-lab`.
2. Upload a short MP4.
3. Confirm upload completes directly to Supabase Storage.
4. Open the video detail page.
5. Watch the job progress through:
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
6. Confirm clip ideas appear on the video detail page.

## Production Verification Checklist

- [ ] Railway worker service starts successfully.
- [ ] Startup report shows required env vars present.
- [ ] FFmpeg shows `available`.
- [ ] yt-dlp shows `available`.
- [ ] Worker heartbeat appears in Content Lab.
- [ ] Upload a short MP4.
- [ ] Video job becomes `running`.
- [ ] Job progresses through `extracting_audio`.
- [ ] Job progresses through `transcribing`.
- [ ] Job progresses through `analyzing_segments`.
- [ ] Job progresses through `ranking_candidates`.
- [ ] Job reaches `ready`.
- [ ] Clip ideas appear on the video detail page.

## Common Failures

### Missing env vars

Railway logs show the exact missing keys. Add them to the worker service variables and redeploy.

### FFmpeg unavailable

Confirm Railway is building from `Dockerfile`, not Nixpacks.

### yt-dlp unavailable

Confirm Railway is building from `Dockerfile`. The Dockerfile installs `yt-dlp` with pip.

### Supabase permission denied

Use `SUPABASE_SERVICE_ROLE_KEY`, not the anon key, for the Railway worker.

### Worker heartbeat missing

Check that migration `004_worker_observability.sql` has been applied and that the worker can write to `worker_heartbeats`.

### Job stuck queued

The worker is not polling or cannot claim jobs. Check Railway logs for startup errors, missing env vars, or failed Supabase connection.
