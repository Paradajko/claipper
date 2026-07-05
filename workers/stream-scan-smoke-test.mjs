import { createClient } from "@supabase/supabase-js";
import { assertValidWorkerEnv, checkBinaryAvailability, loadWorkerDotEnv } from "./worker-utils.mjs";

loadWorkerDotEnv();

const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  try {
    assertValidWorkerEnv();
    record("required worker env vars", true);
  } catch (error) {
    record("required worker env vars", false, error instanceof Error ? error.message.replaceAll("\n", " ") : "invalid env");
    finish();
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const { error: connectionError } = await supabase.from("processing_jobs").select("id").limit(1);
  record("Supabase connection", !connectionError, connectionError?.message);

  for (const bucket of [process.env.STORAGE_BUCKET_ORIGINALS, process.env.STORAGE_BUCKET_AUDIO, process.env.STORAGE_BUCKET_CLIPS]) {
    const { data, error } = await supabase.storage.getBucket(bucket);
    record(`bucket ${bucket}`, Boolean(data && !error), error?.message);
  }

  for (const table of ["videos", "processing_jobs", "worker_heartbeats", "transcripts", "transcript_segments", "clip_ideas", "clips"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    record(`table ${table}`, !error, error?.message);
  }

  const { data: job, error: insertError } = await supabase
    .from("processing_jobs")
    .insert({
      job_type: "smoke_test",
      status: "queued",
      current_step: "smoke_test",
      step: "smoke_test",
      progress_percent: 0,
      raw_data: { smoke_test: true, created_by: "worker:smoke-test" }
    })
    .select("id")
    .single();
  record("create test processing job", Boolean(job && !insertError), insertError?.message);

  if (job) {
    const { error: updateError } = await supabase
      .from("processing_jobs")
      .update({ status: "completed", progress_percent: 100, completed_at: new Date().toISOString() })
      .eq("id", job.id);
    record("update test processing job", !updateError, updateError?.message);

    const { error: deleteError } = await supabase.from("processing_jobs").delete().eq("id", job.id);
    record("delete test processing job", !deleteError, deleteError?.message);
  }

  const ffmpeg = await checkBinaryAvailability(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"]);
  record("ffmpeg available", ffmpeg.ok, ffmpeg.error);

  const ytdlp = await checkBinaryAvailability(process.env.YTDLP_PATH ?? "yt-dlp", ["--version"]);
  record("yt-dlp available", ytdlp.ok, ytdlp.error);

  record("OpenAI key present", Boolean(process.env.OPENAI_API_KEY));
  finish();
}

function finish() {
  const failed = checks.filter((check) => !check.ok);
  console.log("");
  console.log(`${failed.length === 0 ? "PASS" : "FAIL"} worker smoke test: ${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  record("worker smoke test crashed", false, error instanceof Error ? error.message : "unknown error");
  finish();
});
