import { describe, expect, it } from "vitest";
import { formatLastSeen, formatStartupReport, hasFfmpegSubtitleFilter, isHeartbeatConnected, retryOperation, userFriendlyWorkerError, validateWorkerEnv } from "./worker-utils.mjs";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  GEMINI_API_KEY: "gemini",
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
    expect(result.missing).toContain("GEMINI_API_KEY");
    expect(result.missing).toContain("OPENAI_API_KEY");
    expect(result.missing).toContain("WORKER_ID");
  });

  it("accepts a complete worker environment", () => {
    const result = validateWorkerEnv(validEnv);

    expect(result.ok).toBe(true);
    expect(result.pollIntervalMs).toBe(3000);
  });

  it("accepts local mode without cloud media buckets", () => {
    const result = validateWorkerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      GEMINI_API_KEY: "gemini",
      OPENAI_API_KEY: "openai",
      WORKER_ID: "mac-worker",
      WORKER_POLL_INTERVAL_MS: "3000",
      CLAIPPER_STORAGE_MODE: "local",
      CLAIPPER_LOCAL_STORAGE_DIR: "/Users/operator/ClaipperStorage"
    });

    expect(result.ok).toBe(true);
    expect(result.missing).not.toContain("STORAGE_BUCKET_ORIGINALS");
    expect(result.missing).not.toContain("STORAGE_BUCKET_AUDIO");
    expect(result.missing).not.toContain("STORAGE_BUCKET_CLIPS");
    expect(result.storageMode).toBe("local");
  });

  it("requires an absolute local storage directory in local mode", () => {
    const result = validateWorkerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      GEMINI_API_KEY: "gemini",
      OPENAI_API_KEY: "openai",
      WORKER_ID: "mac-worker",
      WORKER_POLL_INTERVAL_MS: "3000",
      CLAIPPER_STORAGE_MODE: "local",
      CLAIPPER_LOCAL_STORAGE_DIR: "relative/storage"
    });

    expect(result.ok).toBe(false);
    expect(result.invalid).toContain("CLAIPPER_LOCAL_STORAGE_DIR must be an absolute path");
  });

  it("formats a readable startup report", () => {
    const report = formatStartupReport({
      workerId: "local-worker",
      supabaseConnected: true,
      geminiPresent: true,
      geminiModel: "gemini-3.6-flash",
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
    expect(report).toContain("Gemini text AI: present (gemini-3.6-flash)");
    expect(report).toContain("OpenAI transcription key: present");
    expect(report).toContain("FFmpeg: available");
    expect(report).toContain("FFprobe: available");
    expect(report).toContain("yt-dlp: missing (yt-dlp)");
    expect(report).toContain("Polling every 3000ms");
  });

  it("detects whether FFmpeg was built with subtitle rendering", () => {
    expect(hasFfmpegSubtitleFilter(" .. subtitles        V->V       Render text subtitles using libass")).toBe(true);
    expect(hasFfmpegSubtitleFilter(" .. overlay          VV->V      Overlay video")).toBe(false);
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

  it("retries transient persistence failures a bounded number of times", async () => {
    let attempts = 0;
    await expect(retryOperation(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary database outage");
      return "saved";
    }, { attempts: 3, delayMs: 0 })).resolves.toBe("saved");
    expect(attempts).toBe(3);

    await expect(retryOperation(async () => {
      throw new Error("still unavailable");
    }, { attempts: 2, delayMs: 0 })).rejects.toThrow("still unavailable");
  });
});
