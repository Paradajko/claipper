import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("workers/stream-scan-worker.mjs", "utf8");
const aiProvider = readFileSync("workers/ai-provider.mjs", "utf8");
const atomicRenderMigration = readFileSync("supabase/migrations/007_atomic_ready_clip_queue.sql", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

describe("ready render worker contract", () => {
  it("uses Gemini for Moment Finder text and OpenAI only for transcription", () => {
    expect(worker).toContain("resolveMomentAiConfig");
    expect(worker).toContain("momentAi.chat.completions.create");
    expect(aiProvider).toContain("GEMINI_MODEL");
    expect(worker).toContain("GEMINI_API_KEY");
    expect(worker).toContain("https://api.openai.com/v1/audio/transcriptions");
    expect(worker).toContain("OPENAI_TRANSCRIBE_MODEL");
    expect(worker).not.toContain("OPENAI_MODEL");
    expect(worker).not.toContain("openai.chat.completions.create");
  });

  it("uses the deterministic production module and FFprobe before upload", () => {
    for (const symbol of [
      "normalizeEditPlan",
      "buildRenderTimeline",
      "buildAssDocument",
      "buildReadyRenderCommand",
      "validateProbeResult"
    ]) {
      expect(worker).toContain(symbol);
    }
    expect(worker).toContain("FFPROBE_PATH");
    expect(worker).toContain('"-show_streams"');
    expect(worker).toContain('"-show_format"');
    expect(worker).toContain('"json"');
    const validationCall = worker.indexOf("const validation = validateProbeResult(");
    const uploadCall = worker.indexOf("await uploadFile(buckets.clips");
    expect(validationCall).toBeGreaterThan(-1);
    expect(uploadCall).toBeGreaterThan(-1);
    expect(validationCall).toBeLessThan(uploadCall);
  });

  it("persists passed QA and exposes clear job errors on failure", () => {
    expect(worker).toContain('render_version: 2');
    expect(worker).toContain('status: "passed"');
    expect(worker).toContain("ffprobe_error");
    expect(worker).toContain("quality_check");
    expect(atomicRenderMigration).toContain("render_status = 'failed'");
    expect(atomicRenderMigration).toContain("status = 'editing'");
    expect(atomicRenderMigration).toContain("error_message = p_user_error");
    expect(atomicRenderMigration).toContain("technical_error = p_technical_error");
    expect(worker).toContain("renderFailureRawData");
    expect(worker).not.toContain("saveFailedQualityCheck");
    expect(worker).toContain("render_failure");
    expect(worker).toContain('p_clip_raw_data: error?.renderFailureRawData ?? null');
  });

  it("accepts new word timestamps and legacy transcript arrays", () => {
    expect(worker).toContain("Array.isArray(value)");
    expect(worker).toContain("value?.segments");
    expect(worker).toContain("value?.words");
    expect(worker).toContain("loadTranscriptTiming");
    expect(worker).toContain("toTranscriptWords(transcript)");
    expect(worker).toContain("groundVerifiedCandidate");
    expect(worker).toContain("groundColdOpenHook");
    expect(worker).toContain("normalizeVerifiedHookBounds");
  });

  it("keeps ready render state durable when a database update fails", () => {
    expect(worker).toContain("const { data: updatedJob, error: jobUpdateError }");
    expect(worker).toContain("if (jobUpdateError) throw new Error");
    expect(worker).toContain("retryOperation");
    expect(worker).toContain("attempts: 3");
    expect(worker).toContain("if (failureOwned && !isRenderJob && job.video_id)");
    expect(worker).toContain("JOB_LEASE_TIMEOUT_MS = 120000");
    expect(worker).toContain("await recoverStaleWorkerJobs()");
    expect(worker).toContain('.lt("locked_at", staleBefore)');
    expect(worker).toContain("refreshJobLease(currentJobId)");
    expect(worker).toContain('.eq("id", jobId)');
    expect(worker).toContain('status: "queued"');
    expect(worker).not.toContain("recoverInterruptedWorkerJobs(workerStartedAt)");
    expect(worker).toContain("const workerProcessToken = randomUUID()");
    expect(worker).toContain("const workerProcessId = `${workerId}:${workerProcessToken}`");
    expect(worker).toContain("worker_id: workerProcessId");
    expect(worker).toContain('.eq("worker_id", workerProcessId)');
    expect(worker).toContain("assertJobLease(job.id)");
    expect(worker).toContain("if (!updatedJob) throw new Error");
    expect(worker).toContain("`${video.id}/${clip.id}/${workerProcessToken}.mp4`");
    expect(worker).toContain('.rpc("complete_render_job"');
    expect(worker).toContain('.rpc("fail_processing_job"');
  });

  it("uses strict validation for current edit plans and legacy fallback only for old data", () => {
    expect(worker).toContain("const storedEditPlan = renderClip.raw_data?.edit_plan");
    expect(worker).toContain("legacy: !storedEditPlan || storedEditPlan.version !== 1");
  });

  it("installs and verifies yt-dlp Chrome impersonation in the Railway image", () => {
    expect(dockerfile).toContain('"yt-dlp[default,curl-cffi]"');
    expect(dockerfile).toContain("yt-dlp --version");
    expect(dockerfile).toContain("yt-dlp --list-impersonate-targets");
    expect(dockerfile).toContain("unavailable");
    expect(worker).toContain('"--list-impersonate-targets"');
    expect(worker).toContain("findAvailableChromeImpersonationTarget");
    expect(worker).toContain("yt-dlp Chrome impersonation unavailable");
    expect(worker).toContain('await updateVideo(job.video_id, "failed", 100, userError, userError)');
  });

  it("streams platform originals to object storage and reuses the local download", () => {
    expect(worker).toContain("uploadOriginalVideo");
    expect(worker).toContain("processAnalyzeVideo(job, { localSourcePath: downloadedPath, workDir })");
    expect(worker).toContain("source_storage_provider: originalProvider");
    expect(worker).toContain("source_storage_path: storagePath");
  });

  it("cleans the large platform-import work directory after completion or failure", () => {
    expect(worker).toContain("await rm(workDir, { recursive: true, force: true })");
  });

  it("uses local source paths directly and disables platform imports in local mode", () => {
    expect(worker).toContain("CLAIPPER_STORAGE_MODE");
    expect(worker).toContain("resolveLocalMediaPath");
    expect(worker).toContain("sourcePathForVideo");
    expect(worker).toContain('throw new Error("Platform imports are disabled in local mode.")');
    expect(worker).toContain("if (!localSourcePath && !storedLocalSourcePath)");
  });

  it("persists local renders without a cloud media upload", () => {
    expect(worker).toContain('const renderStorageBucket = localMode ? "local" : buckets.clips');
    expect(worker).toContain("const renderStoragePath = localMode");
    expect(worker).toContain("if (!localMode)");
    expect(worker).toContain('rendered_by: localMode ? "local_worker" : "railway_worker"');
    expect(worker).toContain("p_storage_bucket: renderStorageBucket");
    expect(worker).toContain("p_storage_path: renderStoragePath");
  });

  it("transcribes long source videos as bounded sequential audio chunks", () => {
    expect(worker).toContain("buildAudioChunkPlan");
    expect(worker).toContain("mergeVerboseTranscripts");
    expect(worker).toContain("probeMediaDuration");
    expect(worker).toContain("for (const chunk of chunkPlan)");
    expect(worker).toContain('"-b:a", "48k"');
    expect(worker).toContain("await transcribeAudio(chunkPath)");
    expect(worker).toContain("await rm(chunkPath, { force: true })");
    expect(worker).not.toContain("const transcript = await transcribeAudio(audioPath)");
  });

  it("uses anonymized Kick chat only as a bounded grounded ranking signal", () => {
    expect(worker).toContain("buildChatWindows");
    expect(worker).toContain("loadNormalizedChatWindows");
    expect(worker).toContain("normalized_chat_storage_path");
    expect(worker).toContain("applyChatSignalsToCandidate");
    expect(worker).toContain("supporting signal only");
    expect(worker).toContain("chat_activity_score");
    expect(worker).toContain("chat_message_count");
    expect(worker).toContain("chat_unique_users");
    expect(worker).toContain("chat_emote_spike");
    expect(worker).toContain("chat_signal_reason");
    expect(worker).not.toContain("chat username");
  });
});
