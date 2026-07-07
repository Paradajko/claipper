import { notFound } from "next/navigation";
import { MomentReviewClient, type MomentReviewSnapshot } from "@/components/moment-review-client";
import { createStorageSignedUrl, getLatestWorkerHeartbeat, getStreamVideo } from "@/lib/supabase";

const reviewStepLabels = ["Uploaded", "Audio", "Transcript", "Analysis", "Ranked", "Ready"];

export const dynamic = "force-dynamic";

export default async function StreamVideoDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [video, workerHeartbeat] = await Promise.all([getStreamVideo(id), getLatestWorkerHeartbeat()]);
  if (!video) notFound();

  const clips = await Promise.all((video.clips ?? []).map(async (clip) => ({ clip, previewUrl: await createStorageSignedUrl(clip.storage_bucket, clip.storage_path) })));
  const snapshot: MomentReviewSnapshot = { video, workerHeartbeat, clips };

  return (
    <MomentReviewClient
      error={query.error}
      initialSnapshot={snapshot}
      stepLabels={reviewStepLabels}
      title="Moment Review"
    />
  );
}
