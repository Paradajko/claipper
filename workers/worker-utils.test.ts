import { describe, expect, it } from "vitest";
import { formatLastSeen, formatStartupReport, isHeartbeatConnected, userFriendlyWorkerError, validateWorkerEnv } from "./worker-utils.mjs";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  OPENAI_API_KEY: "openai",
  STORAGE_BUCKET_ORIGINALS: "original-videos",
  STORAGE_BUCKET_AUDIO: "extracted-audio",
  STORAGE_BUCKET_CLIPS: "rendered-clips",
  WORKER_ID: "local-worker",
  WORKER_POLL_INTERVAL_MS: "3000"
};

describe("worker utils", () => {
  it("lists every missing required worker env var", () => {
    const result = validateWorkerEnv({});

    expect(result.ok).toBe(false);
    expect(result.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(result.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(result.missing).toContain("OPENAI_API_KEY");
    expect(result.missing).toContain("WORKER_ID");
  });

  it("accepts a complete worker environment", () => {
    const result = validateWorkerEnv(validEnv);

    expect(result.ok).toBe(true);
    expect(result.pollIntervalMs).toBe(3000);
  });

  it("formats a readable startup report", () => {
    const report = formatStartupReport({
      workerId: "local-worker",
      supabaseConnected: true,
      openAiPresent: true,
      ffmpeg: { ok: true, binary: "ffmpeg" },
      ffprobe: { ok: true, binary: "ffprobe" },
      ytdlp: { ok: false, binary: "yt-dlp" },
      buckets: { originals: "original-videos", audio: "extracted-audio", clips: "rendered-clips" },
      pollIntervalMs: 3000,
      environment: "development"
    });

    expect(report).toContain("Claipper Stream Scan Worker");
    expect(report).toContain("Worker ID: local-worker");
    expect(report).toContain("Supabase: connected");
    expect(report).toContain("FFmpeg: available");
    expect(report).toContain("FFprobe: available");
    expect(report).toContain("yt-dlp: missing (yt-dlp)");
    expect(report).toContain("Polling every 3000ms");
  });

  it("treats heartbeats older than 60 seconds as disconnected", () => {
    const now = new Date("2026-07-05T12:00:00.000Z");

    expect(isHeartbeatConnected({ last_seen_at: "2026-07-05T11:59:20.000Z" }, now)).toBe(true);
    expect(isHeartbeatConnected({ last_seen_at: "2026-07-05T11:58:59.000Z" }, now)).toBe(false);
    expect(formatLastSeen({ last_seen_at: "2026-07-05T11:59:20.000Z" }, now)).toBe("40s ago");
  });

  it("separates user-facing worker errors from technical details", () => {
    expect(userFriendlyWorkerError(new Error("spawn ffmpeg ENOENT"))).toBe("Video processing failed. Try another file or format.");
    expect(userFriendlyWorkerError(new Error("yt-dlp login required"))).toBe("Could not import this link. Upload the video file directly.");
    expect(userFriendlyWorkerError(new Error("Ready clip QA failed: wrong_dimensions"))).toBe(
      "Rendered clip failed quality checks. Retry the render or review the source."
    );
  });
});
