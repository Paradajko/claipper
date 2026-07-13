import { createClient } from "@supabase/supabase-js";
import { buildLocalAgent } from "./local-agent-server.mjs";
import { checkBinaryAvailability, checkFfmpegAvailability, loadWorkerDotEnv } from "./worker-utils.mjs";

loadWorkerDotEnv();

const storageRoot = process.env.CLAIPPER_LOCAL_STORAGE_DIR;
const agentToken = process.env.CLAIPPER_LOCAL_AGENT_TOKEN;
const port = Number(process.env.CLAIPPER_LOCAL_AGENT_PORT ?? 43120);
const maxUploadBytes = Number(process.env.CLAIPPER_LOCAL_MAX_UPLOAD_SIZE_MB ?? 20000) * 1024 * 1024;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!storageRoot || !agentToken || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Local agent requires CLAIPPER_LOCAL_STORAGE_DIR, CLAIPPER_LOCAL_AGENT_TOKEN, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CLAIPPER_LOCAL_AGENT_PORT must be a valid port.");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const app = await buildLocalAgent({
  storageRoot,
  agentToken,
  maxUploadBytes,
  allowedOrigins: String(process.env.CLAIPPER_LOCAL_ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  createUploadRecords,
  async toolChecks() {
    const [ffmpeg, ffprobe] = await Promise.all([
      checkFfmpegAvailability(process.env.FFMPEG_PATH ?? "ffmpeg"),
      checkBinaryAvailability(process.env.FFPROBE_PATH ?? "ffprobe", ["-version"])
    ]);
    return { ffmpeg: ffmpeg.ok, ffprobe: ffprobe.ok, openai: Boolean(process.env.OPENAI_API_KEY) };
  }
});

await app.listen({ host: "127.0.0.1", port });
console.log(`[claipper-local-agent] listening on http://127.0.0.1:${port}`);

async function createUploadRecords(record) {
  const rawData = {
    upload_source: "local_agent",
    source_storage_provider: "local",
    source_storage_path: record.sourceStoragePath,
    chat_storage_path: record.chatStoragePath,
    normalized_chat_storage_path: record.normalizedChatStoragePath,
    chat_message_count: record.chatMessageCount,
    chat_offset_seconds: record.chatOffsetSeconds
  };
  const { error: videoError } = await supabase.from("videos").insert({
    id: record.videoId,
    title: record.title,
    original_filename: record.originalFilename,
    mime_type: record.mimeType,
    size_bytes: record.sizeBytes,
    file_size: record.sizeBytes,
    file_path: record.sourceStoragePath,
    storage_bucket: "local",
    storage_path: record.sourceStoragePath,
    source_storage_provider: "local",
    source_storage_path: record.sourceStoragePath,
    source_type: "direct_upload",
    status: "queued",
    progress_percent: 5,
    progress_text: "Local upload complete. Waiting for analysis.",
    raw_data: rawData
  });
  if (videoError) throw new Error(`Could not create local video record: ${videoError.message}`);

  const { error: jobError } = await supabase.from("processing_jobs").insert({
    video_id: record.videoId,
    job_type: "analyze_video",
    status: "queued",
    step: "queued",
    current_step: "queued",
    progress_percent: 5,
    raw_data: { source: "local_agent" }
  });
  if (jobError) {
    await supabase.from("videos").delete().eq("id", record.videoId);
    throw new Error(`Could not queue local analysis: ${jobError.message}`);
  }
}
