import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("workers/stream-scan-worker.mjs", "utf8");
const atomicRenderMigration = readFileSync("supabase/migrations/007_atomic_ready_clip_queue.sql", "utf8");

describe("ready render worker contract", () => {
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
});
