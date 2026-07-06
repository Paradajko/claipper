import Link from "next/link";
import { ArrowRight, ExternalLink, Radio, Sparkles, UploadCloud } from "lucide-react";
import { ContentLabIngest } from "@/components/content-lab-ingest";
import { AppShell, Badge, Card, EmptyNotice } from "@/components/ui";
import { getLatestWorkerHeartbeat, getSourceVideos, getStreamVideos, isSupabaseConfigured } from "@/lib/supabase";
import { describeVideoProcessingState, formatStep, formatWorkerLastSeen, isWorkerConnected } from "@/lib/worker-health";
import type { ProcessingJob, StreamVideo, WorkerHeartbeat } from "@/lib/types";

export default async function ContentLabPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const [sources, streamVideos, workerHeartbeat] = await Promise.all([getSourceVideos(), getStreamVideos(), getLatestWorkerHeartbeat()]);
  const workerConnected = isWorkerConnected(workerHeartbeat);

  return (
    <AppShell title="Content Lab" eyebrow="AI analysis">
      <div className="space-y-6">
        <WorkerStatusStrip heartbeat={workerHeartbeat} connected={workerConnected} />

        <section className="content-lab-upload-shell dashboard-ambient rounded-lg border border-white/10 bg-slate-950/55 p-4 backdrop-blur-xl md:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Badge className="mb-3 border-emerald-300/25 bg-emerald-300/10 text-emerald-100">Content Lab</Badge>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">Analyze long-form content</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Upload directly to Supabase Storage or queue a YouTube, Kick or Twitch import for the worker.
                  </p>
                </div>
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 sm:flex">
                  <UploadCloud className="h-5 w-5" />
                </div>
              </div>
              {query.error ? (
                <p className="mb-4 rounded-md border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">
                  {query.error}
                </p>
              ) : null}
              {!isSupabaseConfigured ? (
                <p className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  Demo mode: AI analysis will start saving after Supabase and AI environment variables are configured.
                </p>
              ) : null}
              <ContentLabIngest />
            </div>

            <aside className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-semibold text-white">What happens next</h3>
              </div>
              <div className="mt-4 grid gap-3">
                {["Upload or import", "Worker transcribes", "AI ranks moments", "Review clip ideas"].map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-xs font-semibold text-emerald-100">{index + 1}</span>
                    <span className="text-sm text-slate-300">{step}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Recent analyses</h2>
              <p className="mt-1 text-sm text-slate-400">Uploads, imports and completed scans.</p>
            </div>
            <Badge className="w-fit border-white/10 bg-white/5 text-slate-300">{streamVideos.length || sources.length} items</Badge>
          </div>
          {streamVideos.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {streamVideos.map((video) => <StreamVideoCard key={video.id} video={video} workerConnected={workerConnected} />)}
            </div>
          ) : sources.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {sources.map((source) => (
                <Card key={source.id} className="premium-hover border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Analyzed</Badge>
                        {source.mylaura_campaign_name ? <Badge className="border-white/10 bg-white/5 text-slate-200">MyLaura context</Badge> : null}
                      </div>
                      <h2 className="text-lg font-semibold text-white">{source.title}</h2>
                      <p className="mt-2 text-sm text-slate-400">{source.notes ?? "Strong moments and clip ideas will appear after analysis."}</p>
                    </div>
                    {source.source_url ? (
                      <a href={source.source_url} target="_blank" className="inline-flex items-center gap-2 text-sm text-emerald-300" rel="noreferrer">
                        Open content <ExternalLink size={15} />
                      </a>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyNotice>Add a video link or upload long-form content. Claipper will analyze it and turn it into clip ideas.</EmptyNotice>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function WorkerStatusStrip({ heartbeat, connected }: { heartbeat: WorkerHeartbeat | null; connected: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-300/15 bg-emerald-300/10 text-emerald-300">
            <Radio className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Processing worker</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {connected
                ? heartbeat?.current_job_id
                  ? `Current job: ${formatStep(heartbeat.current_step)}`
                  : "Online and polling for queued jobs."
                : "Offline. Uploaded videos wait in queue."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Badge className={connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}>
              {connected ? "Worker connected" : "Worker not connected"}
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-200">Last seen {formatWorkerLastSeen(heartbeat)}</Badge>
        </div>
      </div>
    </div>
  );
}

function StreamVideoCard({ video, workerConnected }: { video: StreamVideo; workerConnected: boolean }) {
  const latestJob = latestProcessingJob(video.processing_jobs);
  const progress = Math.max(0, Math.min(100, latestJob?.progress_percent ?? video.progress_percent ?? statusProgress(video.status)));
  const stateText =
    describeVideoProcessingState({
      videoStatus: video.status,
      jobStatus: latestJob?.status,
      currentStep: latestJob?.current_step ?? latestJob?.step,
      workerConnected
    }) ?? video.progress_text ?? "Ready for Stream Scan.";

  return (
    <Card className="premium-hover border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <VideoStateBadge state={video.status} />
            {latestJob ? <Badge className="border-white/10 bg-white/5 text-slate-200">Job {latestJob.status}</Badge> : null}
            <Badge className="border-white/10 bg-white/5 text-slate-200">{formatSourceType(video.source_type)}</Badge>
          </div>
          <h2 className="truncate text-lg font-semibold text-white">{video.title}</h2>
          {video.original_filename ? <p className="mt-1 truncate text-xs text-slate-500">{video.original_filename}</p> : null}
          <p className="mt-2 text-sm text-slate-400">{stateText}</p>
          {latestJob?.current_step ? <p className="mt-1 text-xs text-slate-500">Current step: {formatStep(latestJob.current_step)}</p> : null}
          <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">{progress}%</p>
          {video.error_message ? <p className="mt-2 text-sm text-rose-200">{video.error_message}</p> : null}
          {latestJob?.error_message ? <p className="mt-2 text-sm text-rose-200">{latestJob.error_message}</p> : null}
        </div>
        <Link href={`/app/content-lab/${video.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15">
          Open scan <ArrowRight size={15} />
        </Link>
      </div>
    </Card>
  );
}

function latestProcessingJob(jobs: ProcessingJob[] | undefined) {
  return [...(jobs ?? [])].sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];
}

function VideoStateBadge({ state }: { state: StreamVideo["status"] }) {
  const ready = state === "ready";
  const failed = state === "failed";
  return (
    <Badge className={failed ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : ready ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}>
      {state.replaceAll("_", " ")}
    </Badge>
  );
}

function statusProgress(status: StreamVideo["status"]) {
  const map: Record<StreamVideo["status"], number> = {
    created: 0,
    uploading: 10,
    uploaded: 20,
    import_queued: 10,
    downloading: 20,
    queued: 25,
    extracting_audio: 40,
    transcribing: 55,
    segmenting: 68,
    analyzing: 78,
    ranking: 90,
    ready: 100,
    failed: 100
  };
  return map[status] ?? 0;
}

function formatSourceType(sourceType: StreamVideo["source_type"]) {
  if (sourceType === "platform_import") return "Platform import";
  if (sourceType === "live") return "Live";
  return "Direct upload";
}
