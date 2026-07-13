import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const requiredWorkerEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "STORAGE_BUCKET_ORIGINALS",
  "STORAGE_BUCKET_AUDIO",
  "STORAGE_BUCKET_CLIPS",
  "WORKER_ID",
  "WORKER_POLL_INTERVAL_MS"
];

export function loadWorkerDotEnv(cwd = process.cwd()) {
  for (const filename of [".env.local", ".env"]) {
    loadDotEnvFile(`${cwd}/${filename}`);
  }
}

export function validateWorkerEnv(env = process.env) {
  const missing = requiredWorkerEnv.filter((key) => !String(env[key] ?? "").trim());
  const pollInterval = Number(env.WORKER_POLL_INTERVAL_MS);
  const invalid = [];
  if (env.WORKER_POLL_INTERVAL_MS && (!Number.isFinite(pollInterval) || pollInterval < 500)) {
    invalid.push("WORKER_POLL_INTERVAL_MS must be a number >= 500");
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    pollIntervalMs: Number.isFinite(pollInterval) ? pollInterval : null
  };
}

export function assertValidWorkerEnv(env = process.env) {
  const validation = validateWorkerEnv(env);
  if (validation.ok) return validation;

  const lines = ["Claipper Stream Scan Worker cannot start."];
  if (validation.missing.length > 0) {
    lines.push(`Missing env vars: ${validation.missing.join(", ")}`);
  }
  if (validation.invalid.length > 0) {
    lines.push(`Invalid env vars: ${validation.invalid.join(", ")}`);
  }
  throw new Error(lines.join("\n"));
}

export async function checkBinaryAvailability(binary, args = ["-version"]) {
  try {
    await execFileAsync(binary, args, { timeout: 8000 });
    return { ok: true, binary };
  } catch (error) {
    return {
      ok: false,
      binary,
      error: error instanceof Error ? error.message : "Unknown binary check failure."
    };
  }
}

export function formatStartupReport({ workerId, supabaseConnected, openAiPresent, ffmpeg, ffprobe, ytdlp, buckets, pollIntervalMs, environment }) {
  return [
    "Claipper Stream Scan Worker",
    `Worker ID: ${workerId}`,
    `Supabase: ${supabaseConnected ? "connected" : "missing"}`,
    `OpenAI key: ${openAiPresent ? "present" : "missing"}`,
    `FFmpeg: ${ffmpeg.ok ? "available" : `missing (${ffmpeg.binary})`}`,
    `FFprobe: ${ffprobe.ok ? "available" : `missing (${ffprobe.binary})`}`,
    `yt-dlp: ${ytdlp.ok ? "available" : `missing (${ytdlp.binary})`}`,
    "Buckets:",
    `- ${buckets.originals}`,
    `- ${buckets.audio}`,
    `- ${buckets.clips}`,
    `Polling every ${pollIntervalMs}ms`,
    `Environment: ${environment}`
  ].join("\n");
}

export function isHeartbeatConnected(heartbeat, now = new Date(), timeoutMs = 60000) {
  if (!heartbeat?.last_seen_at) return false;
  const seen = new Date(heartbeat.last_seen_at).getTime();
  if (!Number.isFinite(seen)) return false;
  return now.getTime() - seen <= timeoutMs;
}

export function formatLastSeen(heartbeat, now = new Date()) {
  if (!heartbeat?.last_seen_at) return "never";
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(heartbeat.last_seen_at).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

export function userFriendlyWorkerError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/quality|\bqa\b|ffprobe|wrong_dimensions|duration_mismatch/i.test(message)) {
    return "Rendered clip failed quality checks. Retry the render or review the source.";
  }
  if (/ffmpeg/i.test(message)) return "Video processing failed. Try another file or format.";
  if (/openai|transcrib/i.test(message)) return "Transcription failed. Try another file or check the AI configuration.";
  if (/storage|bucket|download/i.test(message)) return "Video storage failed. Check Supabase Storage configuration.";
  if (/yt-dlp|downloader|private|login|age/i.test(message)) return "Could not import this link. Upload the video file directly.";
  return "Video processing failed. Try another file or format.";
}

export async function retryOperation(operation, options = {}) {
  const attempts = Math.max(1, Math.floor(Number(options.attempts ?? 3)));
  const delayMs = Math.max(0, Number(options.delayMs ?? 250));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function loadDotEnvFile(filepath) {
  if (!existsSync(filepath)) return;
  const content = readFileSync(filepath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rawValue] = trimmed.split("=");
    const key = rawKey.trim();
    if (process.env[key]) continue;
    process.env[key] = rawValue.join("=").trim().replace(/^["']|["']$/g, "");
  }
}
