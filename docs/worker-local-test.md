# Claipper Local Manual Test

Codex runs automated tests and starts the services, but does not upload or process real media. Use this checklist for the first manual CZ/SK video test.

## 1. Prepare

1. Fill `.env.local` using `.env.example`.
2. Set a random `CLAIPPER_LOCAL_AGENT_TOKEN`.
3. Ensure Supabase migrations `001_claipper_core.sql` through `007_atomic_ready_clip_queue.sql` are applied.
4. Install the caption-capable FFmpeg build with `brew install ffmpeg-full` if needed.
5. Keep the Railway worker deployment removed so it cannot claim local jobs. `npm run dev:local` reads its existing API credentials through `railway run`, but all media processing remains on the Mac.

## 2. Start

```bash
mkdir -p /Users/paradajko/ClaipperStorage
npm run dev:local
```

Open `http://127.0.0.1:3000/app/content-lab`. The agent health endpoint is `http://127.0.0.1:43120/health`.

## 3. Upload

1. Choose one CZ/SK MP4, MOV, MKV, or WEBM file.
2. Optionally choose the Kick chat JSON export. The supplied `vip_rewards_on_touken.ggtoukengg_messages.json` format is supported.
3. Leave chat offset at `0` when the first chat timestamp matches the start of the video. Adjust it only when the exports use different starts.
4. Enter the same local agent token as `.env.local`.
5. Select `Start analysis`.

The browser streams both files directly to the Mac. Supabase receives only records, timestamps, transcript data, chat aggregates, job progress, clip ideas, and render metadata.

## 4. Expected analysis

The worker should:

1. Probe exact duration.
2. Extract sequential 10-minute, 48 kbps mono audio chunks with a 5-second overlap.
3. Transcribe each chunk and merge absolute word/segment timestamps without overlap duplicates.
4. Build 5-10 minute analysis windows.
5. Add anonymous Kick activity summaries as a bounded supporting signal.
6. Find, ground, rank, refine, and verify multiple 20-60 second moments.
7. Show timestamps, source quote, hook, caption, recommendation, edit difficulty, and chat signal in Moment Review.

## 5. Export checks

For at least one strong moment, test:

- Natural timeline
- Cold open with a grounded 1-3 second hook moved first
- Center, left, and right framing
- Crop and blur background
- Creator captions inside the lower-platform safe area
- Creator Enhance

The ready output should be a playable 1080x1920 H.264/AAC MP4. The UI should offer it after FFprobe QA passes. Files are stored under:

```text
/Users/paradajko/ClaipperStorage/<video-id>/clips/<clip-id>/ready.mp4
```

## 6. Failure checks

- Agent offline: start `npm run dev:local` and retry.
- Invalid token: make the browser token match `CLAIPPER_LOCAL_AGENT_TOKEN`.
- Worker offline: inspect the `worker` process in the combined terminal output.
- FFmpeg/FFprobe missing: install FFmpeg or set absolute binary paths.
- Moment analysis failure: verify `GEMINI_API_KEY` and `GEMINI_MODEL`, then inspect `processing_jobs.technical_error`.
- Transcription failure: verify `OPENAI_API_KEY` and `OPENAI_TRANSCRIBE_MODEL`, then inspect `processing_jobs.technical_error`.
- No moments: inspect the saved transcript before changing ranking thresholds.

## Current manual scope

The operator still approves moments, adjusts edit controls, downloads the final clip, and publishes it. MyLaura integration, public registration, automatic social upload, account generation, payouts, and platform-link importing are not part of this local MVP.
