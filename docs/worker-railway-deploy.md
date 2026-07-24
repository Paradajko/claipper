# Deploy Claipper Stream Scan Worker to Railway

The Claipper web app stays on Vercel. The Stream Scan worker must run as a separate long-running Railway service.

The worker command is:

```bash
npm run worker:stream-scan
```

Do not run FFmpeg, yt-dlp, platform imports, transcription, AI analysis, or draft rendering in Vercel API routes.

## Files Used

- `Dockerfile` installs Node.js runtime dependencies, FFmpeg, Python, pip, and `yt-dlp[default,curl-cffi]`.
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

Before deployment, apply these migrations in order:

1. `supabase/migrations/006_r2_original_video_storage.sql` adds the source provider/path fields used by R2 originals.
2. `supabase/migrations/007_atomic_ready_clip_queue.sql` adds decimal clip timing and atomically creates ready clips with their render jobs.

Set these on the Railway worker service:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
OPENAI_API_KEY=...
OPENAI_TRANSCRIBE_MODEL=whisper-1
STORAGE_BUCKET_ORIGINALS=original-videos
STORAGE_BUCKET_AUDIO=extracted-audio
STORAGE_BUCKET_CLIPS=rendered-clips
WORKER_ID=railway-stream-worker-1
WORKER_POLL_INTERVAL_MS=3000
OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_ENDPOINT=...
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_ACCESS_KEY_ID=...
OBJECT_STORAGE_SECRET_ACCESS_KEY=...
```

`WORKER_ID` identifies the Railway service in logs. Each process adds a unique claim token; active jobs refresh their fenced lease every 15 seconds, and jobs with no live lease for two minutes are safely returned to the queue.

When originals are stored in R2, Railway must receive the same `OBJECT_STORAGE_*` values as Vercel. Keep access keys secret and never expose them to browser code.

Optional:

```bash
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
WORKER_SECRET=...
```

Security rule: `SUPABASE_SERVICE_ROLE_KEY` belongs only on the Railway worker service. Do not expose it to browser code.

## Verify FFmpeg, FFprobe and yt-dlp

The Dockerfile installs both:

```bash
ffmpeg -version
ffprobe -version
yt-dlp --version
yt-dlp --list-impersonate-targets
```

The worker startup report also checks both binaries:

```text
FFmpeg: available
FFprobe: available
yt-dlp: available
yt-dlp Chrome impersonation: available
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
yt-dlp Chrome impersonation: available
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

## User-owned manual video test

No real video was tested by Codex. The user owns visual and end-to-end validation after the technical checks and deployment finish.

### Test With a Short MP4

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
7. Export one Natural clip and one Cold open clip.
8. Confirm Creator captions remain inside the social safe area.
9. Toggle Creator Enhance and compare the output.
10. Change framing and background mode, rerender, and download the final MP4.

## Production Verification Checklist

- [ ] Railway worker service starts successfully.
- [ ] Startup report shows required env vars present.
- [ ] FFmpeg shows `available`.
- [ ] FFprobe shows `available`.
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
- [ ] Natural and Cold open exports are visually reviewed by the user.
- [ ] Creator captions and Creator Enhance are visually reviewed by the user.

## Common Failures

### Missing env vars

Railway logs show the exact missing keys. Add them to the worker service variables and redeploy.

### FFmpeg unavailable

Confirm Railway is building from `Dockerfile`, not Nixpacks.

### yt-dlp unavailable

Confirm Railway is building from `Dockerfile`. The Dockerfile installs `yt-dlp[default,curl-cffi]` with pip and fails the build unless `yt-dlp --list-impersonate-targets` reports an available Chrome target.

### Supabase permission denied

Use `SUPABASE_SERVICE_ROLE_KEY`, not the anon key, for the Railway worker.

### Worker heartbeat missing

Check that migration `004_worker_observability.sql` has been applied and that the worker can write to `worker_heartbeats`.

### Job stuck queued

The worker is not polling or cannot claim jobs. Check Railway logs for startup errors, missing env vars, or failed Supabase connection.
