# Campaign Analyzer operations

Campaign Analyzer extends the existing Claipper app, Supabase database, and Railway worker. It needs no new worker, queue, or runtime secret.

## Before deployment

After separate approval:

1. Apply `supabase/migrations/008_campaign_analyzer.sql`.
2. Deploy this branch to the existing Railway worker.
3. Deploy the app from the same branch.

It reuses these existing environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YTDLP_PATH`
- existing worker variables such as `WORKER_ID` and `WORKER_POLL_INTERVAL_MS`

The worker invokes yt-dlp with `--skip-download` for YouTube sources. Kick channel VOD metadata comes from the public API v2 through the worker image's `curl_cffi` TLS impersonation. Campaign Analyzer downloads no video, audio, subtitles, or thumbnails.

## Manual verification

1. Open `/app/campaign-analyzer`.
2. Create and save an analysis.
3. Run metadata analysis.
4. Verify independent statuses for YouTube, Kick, and clipper.
5. Edit an automatically discovered value and verify immediate recalculation.
6. Clear the override and verify that the automatic value returns.
7. Reopen the saved analysis.
8. If one source fails, verify that other results remain available and earlier successful source data is preserved as stale.

Automated verification does not fetch a real creator URL and does not download media. A live metadata test remains a separate manual step after migration and deployment approval.
