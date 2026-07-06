import { NextResponse } from "next/server";
import { createStorageSignedUrl, getLatestWorkerHeartbeat, getStreamVideo } from "@/lib/supabase";
import type { MomentReviewSnapshot } from "@/components/moment-review-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [video, workerHeartbeat] = await Promise.all([getStreamVideo(id), getLatestWorkerHeartbeat()]);

  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const clips = await Promise.all((video.clips ?? []).map(async (clip) => ({ clip, previewUrl: await createStorageSignedUrl(clip.storage_bucket, clip.storage_path) })));
  const snapshot: MomentReviewSnapshot = { video, workerHeartbeat, clips };

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
