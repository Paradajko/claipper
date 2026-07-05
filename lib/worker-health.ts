import type { WorkerHeartbeat } from "@/lib/types";

export function isWorkerConnected(heartbeat: WorkerHeartbeat | null, now = new Date(), timeoutMs = 60000) {
  if (!heartbeat?.last_seen_at) return false;
  const lastSeen = new Date(heartbeat.last_seen_at).getTime();
  if (!Number.isFinite(lastSeen)) return false;
  return now.getTime() - lastSeen <= timeoutMs;
}

export function formatWorkerLastSeen(heartbeat: WorkerHeartbeat | null, now = new Date()) {
  if (!heartbeat?.last_seen_at) return "never";
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(heartbeat.last_seen_at).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function describeVideoProcessingState({
  videoStatus,
  jobStatus,
  currentStep,
  workerConnected
}: {
  videoStatus: string;
  jobStatus?: string | null;
  currentStep?: string | null;
  workerConnected: boolean;
}) {
  if ((videoStatus === "queued" || jobStatus === "queued") && !workerConnected) {
    return "Video is uploaded and waiting for the processing worker.";
  }
  if (jobStatus === "queued") return "Video is queued for processing.";
  if (jobStatus === "running") return `Processing: ${formatStep(currentStep ?? "running")}`;
  if (videoStatus === "failed" || jobStatus === "failed") return "Processing failed.";
  if (videoStatus === "ready") return "Ready with ranked clip ideas.";
  return null;
}

export function formatStep(step: string | null | undefined) {
  return (step ?? "waiting").replaceAll("_", " ");
}
