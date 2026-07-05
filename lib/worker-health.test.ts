import { describe, expect, it } from "vitest";
import { describeVideoProcessingState, formatWorkerLastSeen, isWorkerConnected } from "@/lib/worker-health";
import type { WorkerHeartbeat } from "@/lib/types";

const heartbeat: WorkerHeartbeat = {
  id: "heartbeat-id",
  worker_id: "local-worker",
  status: "online",
  last_seen_at: "2026-07-05T11:59:20.000Z",
  current_job_id: null,
  current_step: "idle",
  metadata_json: null,
  created_at: "2026-07-05T11:59:20.000Z",
  updated_at: "2026-07-05T11:59:20.000Z"
};

describe("worker health", () => {
  it("marks a fresh heartbeat as connected", () => {
    expect(isWorkerConnected(heartbeat, new Date("2026-07-05T12:00:00.000Z"))).toBe(true);
    expect(formatWorkerLastSeen(heartbeat, new Date("2026-07-05T12:00:00.000Z"))).toBe("40s ago");
  });

  it("marks a stale heartbeat as disconnected", () => {
    expect(isWorkerConnected(heartbeat, new Date("2026-07-05T12:01:01.000Z"))).toBe(false);
  });

  it("explains queued videos differently when the worker is offline", () => {
    expect(
      describeVideoProcessingState({
        videoStatus: "queued",
        jobStatus: "queued",
        currentStep: "queued",
        workerConnected: false
      })
    ).toBe("Video is uploaded and waiting for the processing worker.");
  });

  it("shows the current step while processing", () => {
    expect(
      describeVideoProcessingState({
        videoStatus: "analyzing",
        jobStatus: "running",
        currentStep: "analyzing_segments",
        workerConnected: true
      })
    ).toBe("Processing: analyzing segments");
  });
});
