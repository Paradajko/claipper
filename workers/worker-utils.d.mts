export const requiredWorkerEnv: string[];

export function loadWorkerDotEnv(cwd?: string): void;

export function validateWorkerEnv(env?: Record<string, string | undefined>): {
  ok: boolean;
  missing: string[];
  invalid: string[];
  pollIntervalMs: number | null;
};

export function assertValidWorkerEnv(env?: Record<string, string | undefined>): {
  ok: boolean;
  missing: string[];
  invalid: string[];
  pollIntervalMs: number | null;
};

export function checkBinaryAvailability(binary: string, args?: string[]): Promise<{
  ok: boolean;
  binary: string;
  error?: string;
}>;

export function formatStartupReport(input: {
  workerId: string;
  supabaseConnected: boolean;
  openAiPresent: boolean;
  ffmpeg: { ok: boolean; binary: string };
  ffprobe: { ok: boolean; binary: string };
  ytdlp: { ok: boolean; binary: string };
  buckets: { originals: string; audio: string; clips: string };
  pollIntervalMs: number;
  environment: string;
}): string;

export function isHeartbeatConnected(heartbeat: { last_seen_at?: string } | null, now?: Date, timeoutMs?: number): boolean;

export function formatLastSeen(heartbeat: { last_seen_at?: string } | null, now?: Date): string;

export function userFriendlyWorkerError(error: unknown): string;

export function retryOperation<T>(
  operation: (attempt: number) => Promise<T>,
  options?: { attempts?: number; delayMs?: number }
): Promise<T>;
