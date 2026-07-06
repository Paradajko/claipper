import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft, Download, FileVideo, Play, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import { AppShell, Badge, Card, EmptyNotice } from "@/components/ui";
import { createStorageSignedUrl, getLatestWorkerHeartbeat, getStreamVideo } from "@/lib/supabase";
import { formatStep, formatWorkerLastSeen, isWorkerConnected } from "@/lib/worker-health";
import type { Clip, ClipIdea, ProcessingJob, StreamVideo, StreamVideoDetail, WorkerHeartbeat } from "@/lib/types";

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

  const ideas = [...(video.clip_ideas ?? [])].sort((first, second) => second.score - first.score);
  const clips = await Promise.all((video.clips ?? []).map(async (clip) => ({ clip, previewUrl: await createStorageSignedUrl(clip.storage_bucket, clip.storage_path) })));
  const transcriptReady = (video.transcripts ?? []).some((transcript) => transcript.status === "ready");
  const latestJob = [...(video.processing_jobs ?? [])].sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];
  const workerConnected = isWorkerConnected(workerHeartbeat);
  const ready = video.status === "ready";
  const failed = video.status === "failed";
  const processing = isVideoProcessing(video.status, latestJob);
  const progress = Math.max(0, Math.min(100, latestJob?.progress_percent ?? video.progress_percent ?? statusProgress(video.status)));

  return (
    <AppShell title="Clip Review" eyebrow="Content Lab">
      <div className="space-y-5">
        <Link href="/app/content-lab" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200">
          <ArrowLeft size={16} /> Back to Content Lab
        </Link>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-4 shadow-[0_24px_90px_-60px_rgba(16,185,129,.55)] sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Clip Review</p>
              <h2 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-white md:text-3xl">{video.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{video.original_filename ?? "Uploaded video"}{video.duration_seconds ? ` · ${formatDuration(video.duration_seconds)}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <VideoStatusBadge status={video.status} />
              <Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">{ideas.length} Found moments</Badge>
              <WorkerStatusBadge connected={workerConnected} />
            </div>
          </div>
        </section>

        {query.error ? (
          <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
            {query.error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <aside className={clsx("space-y-4", video.status === "ready" ? "order-2" : "order-1", "lg:order-1")}>
            <ProcessingSummary
              failed={failed}
              latestJob={latestJob}
              processing={processing}
              progress={progress}
              ready={ready}
              transcriptReady={transcriptReady}
              video={video}
              workerHeartbeat={workerHeartbeat}
            />

            <FileInfoCard video={video} clipsCount={clips.length} />

            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Actions</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Re-run analysis if this upload needs a fresh pass.</p>
                </div>
              </div>
              <form action={`/api/stream-scan/videos/${video.id}/process`} method="post" className="mt-4">
                <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15">
                  <RefreshCw className="h-4 w-4" />
                  {video.status === "uploaded" || failed ? "Start Stream Scan" : "Run Stream Scan again"}
                </button>
              </form>
            </Card>

            <RenderedClipsCard clips={clips} />

            {process.env.NODE_ENV !== "production" ? (
              <DeveloperDebugPanel video={video} job={latestJob} worker={workerHeartbeat} />
            ) : null}
          </aside>

          <section className={clsx("space-y-4", video.status === "ready" ? "order-1" : "order-2", "lg:order-2")}>
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.045] p-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Ranked moments</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">AI-selected clip ideas</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Review the strongest timestamps, hooks and captions before generating drafts.</p>
              </div>
              <Badge className="w-fit border-white/10 bg-black/20 text-slate-200">{ideas.length} results</Badge>
            </div>

            {failed ? (
              <StateNotice tone="error" title="Processing failed">
                {latestJob?.error_message ?? video.error_message ?? "The scan failed. Re-run Stream Scan when the source file is ready."}
              </StateNotice>
            ) : null}

            {!failed && processing && ideas.length === 0 ? (
              <StateNotice title="Scan in progress">
                Claipper is still extracting the transcript and ranking moments. Clip ideas will appear here when analysis is complete.
              </StateNotice>
            ) : null}

            <div className="grid gap-4">
              {ideas.length > 0 ? (
                ideas.map((idea, index) => <ClipIdeaCard key={idea.id} idea={idea} index={index} />)
              ) : !failed && !processing ? (
                <EmptyNotice>No clip ideas yet. Run Stream Scan to extract ranked moments, hooks and captions.</EmptyNotice>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ProcessingSummary({
  failed,
  latestJob,
  processing,
  progress,
  ready,
  transcriptReady,
  video,
  workerHeartbeat
}: {
  failed: boolean;
  latestJob?: ProcessingJob;
  processing: boolean;
  progress: number;
  ready: boolean;
  transcriptReady: boolean;
  video: StreamVideo;
  workerHeartbeat: WorkerHeartbeat | null;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Processing summary</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{ready ? "Ready for review" : failed ? "Needs attention" : "Preparing moments"}</h3>
        </div>
        <p className="text-sm font-semibold text-emerald-200">{progress}%</p>
      </div>

      <CompactStepper status={video.status} />

      {ready ? (
        <p className="mt-4 text-sm leading-6 text-slate-400">Analysis is complete. Review ranked moments and generate a draft from the best candidate.</p>
      ) : null}

      {processing ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.45)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{latestJob ? formatJobStep(latestJob) : video.progress_text ?? "Waiting for worker"}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Worker last seen {formatWorkerLastSeen(workerHeartbeat)}.</p>
        </div>
      ) : null}

      {failed ? (
        <div className="mt-4 rounded-md border border-rose-300/20 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
          {latestJob?.error_message ?? video.error_message ?? "Processing failed. Re-run the scan when ready."}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <SummaryPill label="Transcript" value={transcriptReady ? "Ready" : "Pending"} />
        <SummaryPill label="Latest job" value={latestJob?.status ?? "None"} />
      </div>
    </Card>
  );
}

function CompactStepper({ status }: { status: StreamVideo["status"] }) {
  const steps = [
    { key: "uploaded", label: "Uploaded" },
    { key: "extracting_audio", label: "Audio" },
    { key: "transcribing", label: "Transcript" },
    { key: "analyzing", label: "Analysis" },
    { key: "ranking", label: "Ranked" },
    { key: "ready", label: "Ready" }
  ];
  const activeIndex = activeStepIndex(status);

  return (
    <div className="mt-4">
      <div className="grid grid-cols-6 gap-1.5">
        {steps.map((step, index) => {
          const complete = index <= activeIndex;
          return (
            <div key={step.key} className="min-w-0">
              <div className={clsx("h-1.5 rounded-full", complete ? "bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,.35)]" : "bg-white/10")} />
              <p className={clsx("mt-2 truncate text-[10px] font-medium", complete ? "text-emerald-100" : "text-slate-600")}>{step.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileInfoCard({ video, clipsCount }: { video: StreamVideoDetail; clipsCount: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <FileVideo className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Uploaded file</h3>
          <p className="mt-1 truncate text-sm text-slate-400">{video.original_filename ?? "Video source"}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SummaryPill label="Size" value={formatFileSize(video.file_size ?? video.size_bytes)} />
        <SummaryPill label="Duration" value={video.duration_seconds ? formatDuration(video.duration_seconds) : "Unknown"} />
        <SummaryPill label="Segments" value={String(video.transcript_segments?.length ?? 0)} />
        <SummaryPill label="Renders" value={String(clipsCount)} />
      </div>
    </Card>
  );
}

function RenderedClipsCard({ clips }: { clips: Array<{ clip: Clip; previewUrl: string | null }> }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Rendered clips</h3>
          <p className="mt-1 text-xs text-slate-500">Drafts and ready MP4s from selected moments.</p>
        </div>
        <Badge className="border-white/10 bg-white/5 text-slate-300">{clips.length}</Badge>
      </div>
      {clips.length > 0 ? (
        <div className="mt-4 space-y-2">
          {clips.map(({ clip, previewUrl }) => (
            <DraftClipCard key={clip.id} clip={clip} previewUrl={previewUrl} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-400">Generated drafts will appear here after you choose a ranked moment.</p>
      )}
    </Card>
  );
}

function ClipIdeaCard({ idea, index }: { idea: ClipIdea; index: number }) {
  return (
    <Card className="border-emerald-300/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_-55px_rgba(16,185,129,.5)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-sm font-bold text-emerald-100">
            #{index + 1}
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold leading-tight tracking-tight text-white">{idea.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">{formatRange(idea.start_time, idea.end_time)}</Badge>
              <Badge className="border-lime-300/30 bg-lime-300/10 text-lime-100">Score {idea.score}</Badge>
              <Badge className="border-white/10 bg-white/5 text-slate-200">{idea.difficulty}</Badge>
              <Badge className="border-white/10 bg-white/5 text-slate-200">{idea.clip_type}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <LabeledText label="Why it works">{idea.reason}</LabeledText>
        <LabeledText label="Hook">{idea.hook}</LabeledText>
        <LabeledText label="Caption">{idea.caption}</LabeledText>
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
        <form action={`/api/stream-scan/clip-ideas/${idea.id}/draft`} method="post" className="sm:w-auto">
          <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(16,185,129,.25)] hover:bg-emerald-300 sm:w-auto">
            <Play className="h-4 w-4" />
            Generate Draft
          </button>
        </form>
        <form action={`/api/stream-scan/clip-ideas/${idea.id}/ready-clip`} method="post" className="sm:w-auto">
          <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-300/40 hover:bg-emerald-400/10 sm:w-auto">
            <WandSparkles className="h-4 w-4 text-emerald-200" />
            Generate Ready Clip
          </button>
        </form>
      </div>
    </Card>
  );
}

function DraftClipCard({ clip, previewUrl }: { clip: Clip; previewUrl: string | null }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{clip.title ?? (clip.type === "ready" ? "Ready clip" : "Draft clip")}</p>
          <p className="mt-1 text-xs text-slate-500">{formatRange(clip.start_seconds, clip.end_seconds)} · {clip.render_status ?? clip.status}</p>
        </div>
        {previewUrl || clip.exported_video_url ? (
          <a href={previewUrl ?? clip.exported_video_url ?? "#"} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        ) : null}
      </div>
    </div>
  );
}

function StateNotice({ children, title, tone = "default" }: { children: React.ReactNode; title: string; tone?: "default" | "error" }) {
  return (
    <div className={clsx("rounded-lg border p-4", tone === "error" ? "border-rose-300/20 bg-rose-300/10" : "border-cyan-300/20 bg-cyan-300/10")}>
      <div className="flex items-start gap-3">
        <Sparkles className={clsx("mt-0.5 h-4 w-4", tone === "error" ? "text-rose-200" : "text-cyan-200")} />
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className={clsx("mt-1 text-sm leading-6", tone === "error" ? "text-rose-100" : "text-slate-300")}>{children}</p>
        </div>
      </div>
    </div>
  );
}

function LabeledText({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{children}</p>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function VideoStatusBadge({ status }: { status: StreamVideo["status"] }) {
  const failed = status === "failed";
  const ready = status === "ready";
  return (
    <Badge className={failed ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : ready ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function WorkerStatusBadge({ connected }: { connected: boolean }) {
  return (
    <Badge className={connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}>
      {connected ? "Worker online" : "Worker offline"}
    </Badge>
  );
}

function isVideoProcessing(status: StreamVideo["status"], job?: ProcessingJob) {
  if (status === "ready" || status === "failed") return false;
  if (job?.status === "queued" || job?.status === "running") return true;
  return ["uploading", "import_queued", "downloading", "queued", "extracting_audio", "transcribing", "segmenting", "analyzing", "ranking"].includes(status);
}

function activeStepIndex(status: StreamVideo["status"]) {
  if (status === "ready") return 5;
  if (status === "ranking") return 4;
  if (status === "analyzing" || status === "segmenting") return 3;
  if (status === "transcribing") return 2;
  if (status === "extracting_audio") return 1;
  if (["uploaded", "queued", "downloading", "import_queued"].includes(status)) return 0;
  return -1;
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

function formatJobStep(job: ProcessingJob) {
  return formatStep(job.current_step ?? job.step ?? job.status);
}

function formatRange(start: number | null, end: number | null) {
  if (start == null || end == null) return "pending";
  return `${formatSeconds(start)}-${formatSeconds(end)}`;
}

function formatSeconds(value: number) {
  const safeValue = Math.max(0, Math.floor(value));
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const seconds = safeValue % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  return formatSeconds(seconds);
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "Unknown";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function DeveloperDebugPanel({ video, job, worker }: { video: StreamVideo & { transcripts?: unknown[]; transcript_segments?: unknown[]; clip_ideas?: unknown[] }; job?: ProcessingJob; worker: WorkerHeartbeat | null }) {
  const rows = [
    ["video id", video.id],
    ["storage bucket", video.storage_bucket ?? "missing"],
    ["storage path", video.storage_path ?? "missing"],
    ["processing job id", job?.id ?? "none"],
    ["worker id", job?.worker_id ?? worker?.worker_id ?? "none"],
    ["current step", job?.current_step ?? job?.step ?? worker?.current_step ?? "none"],
    ["progress", `${job?.progress_percent ?? video.progress_percent ?? 0}%`],
    ["last error", job?.technical_error ?? job?.error_message ?? video.error_message ?? "none"],
    ["transcript count", String(video.transcripts?.length ?? 0)],
    ["transcript segment count", String(video.transcript_segments?.length ?? 0)],
    ["clip ideas count", String(video.clip_ideas?.length ?? 0)]
  ];

  return (
    <Card className="p-4">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">Developer debug</summary>
        <div className="mt-3 grid gap-2 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 rounded-md border border-white/10 bg-black/20 p-2 sm:grid-cols-[140px_1fr]">
              <span className="uppercase tracking-[0.14em] text-slate-500">{label}</span>
              <span className="break-all font-mono text-slate-200">{value}</span>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}
