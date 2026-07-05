import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Play, WandSparkles } from "lucide-react";
import { AppShell, Badge, Card, EmptyNotice } from "@/components/ui";
import { createStorageSignedUrl, getStreamVideo } from "@/lib/supabase";
import type { Clip, ClipIdea, ProcessingJob, StreamVideo } from "@/lib/types";

export default async function StreamVideoDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const video = await getStreamVideo(id);
  if (!video) notFound();

  const ideas = [...(video.clip_ideas ?? [])].sort((first, second) => second.score - first.score);
  const clips = await Promise.all((video.clips ?? []).map(async (clip) => ({ clip, previewUrl: await createStorageSignedUrl(clip.storage_bucket, clip.storage_path) })));
  const transcriptReady = (video.transcripts ?? []).some((transcript) => transcript.status === "ready");
  const latestJob = [...(video.processing_jobs ?? [])].sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];

  return (
    <AppShell title={video.title} eyebrow="Stream Scan">
      <div className="mb-5">
        <Link href="/app/content-lab" className="inline-flex items-center gap-2 text-sm text-emerald-300">
          <ArrowLeft size={16} /> Back to Content Lab
        </Link>
      </div>

      {query.error ? (
        <div className="mb-5 rounded-lg border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
          {query.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <VideoStatusBadge status={video.status} />
              <Badge className="border-white/10 bg-white/5 text-slate-200">Transcript {transcriptReady ? "ready" : "pending"}</Badge>
              <Badge className="border-white/10 bg-white/5 text-slate-200">{ideas.length} ideas</Badge>
            </div>
            <h2 className="text-xl font-semibold text-white">{video.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{video.progress_text ?? "Ready to process."}</p>
            {video.error_message ? <p className="mt-3 text-sm leading-6 text-rose-200">{video.error_message}</p> : null}
            <div className="mt-5">
              <ProcessingTimeline status={video.status} />
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current progress</p>
                  <p className="mt-1 text-sm font-semibold text-white">{latestJob ? formatJobStep(latestJob) : video.progress_text ?? "Waiting"}</p>
                </div>
                <p className="text-lg font-semibold text-emerald-200">{Math.max(0, Math.min(100, latestJob?.progress_percent ?? video.progress_percent ?? statusProgress(video.status)))}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.45)]"
                  style={{ width: `${Math.max(0, Math.min(100, latestJob?.progress_percent ?? video.progress_percent ?? statusProgress(video.status)))}%` }}
                />
              </div>
              {latestJob?.updated_at ? <p className="mt-2 text-xs text-slate-500">Last updated {formatDate(latestJob.updated_at)}</p> : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Uploaded file" value={video.original_filename ?? "video"} />
              <Metric label="Segments" value={String(video.transcript_segments?.length ?? 0)} />
              <Metric label="Drafts" value={String(clips.length)} />
            </div>
            <form action={`/api/stream-scan/videos/${video.id}/process`} method="post" className="mt-5">
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 sm:w-auto">
                <WandSparkles className="h-4 w-4" />
                {video.status === "uploaded" || video.status === "failed" ? "Start Stream Scan" : "Run Stream Scan again"}
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Draft clips</h2>
            {clips.length > 0 ? (
              <div className="space-y-3">
                {clips.map(({ clip, previewUrl }) => (
                  <DraftClipCard key={clip.id} clip={clip} previewUrl={previewUrl} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Generate a draft from a clip idea to preview or download the MP4.</p>
            )}
          </Card>
        </div>

        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Ranked clip ideas</h2>
              <p className="mt-2 text-sm text-slate-400">Each idea is generated from transcript chunks and ranked for beginner-friendly short-form editing.</p>
            </div>
          </div>

          <div className="grid gap-4">
            {ideas.length > 0 ? (
              ideas.map((idea) => <ClipIdeaCard key={idea.id} idea={idea} />)
            ) : (
              <EmptyNotice>Run Stream Scan to extract timestamps, hooks, captions and ranked clip ideas.</EmptyNotice>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ClipIdeaCard({ idea }: { idea: ClipIdea }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{formatRange(idea.start_time, idea.end_time)}</Badge>
        <Badge className="border-lime-300/30 bg-lime-300/10 text-lime-100">Score {idea.score}</Badge>
        <Badge className="border-white/10 bg-white/5 text-slate-200">{idea.difficulty}</Badge>
        <Badge className="border-white/10 bg-white/5 text-slate-200">{idea.clip_type}</Badge>
      </div>
      <h3 className="text-lg font-semibold text-white">{idea.title}</h3>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
        <p><span className="font-semibold text-white">Reason:</span> {idea.reason}</p>
        <p><span className="font-semibold text-white">Hook:</span> {idea.hook}</p>
        <p><span className="font-semibold text-white">Caption:</span> {idea.caption}</p>
      </div>
      <form action={`/api/stream-scan/clip-ideas/${idea.id}/draft`} method="post" className="mt-5">
        <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 sm:w-auto">
          <Play className="h-3.5 w-3.5" />
          Generate Draft
        </button>
      </form>
    </Card>
  );
}

function DraftClipCard({ clip, previewUrl }: { clip: Clip; previewUrl: string | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">{clip.title ?? "Draft clip"}</h3>
          <p className="mt-1 text-sm text-slate-400">{formatRange(clip.start_seconds, clip.end_seconds)}</p>
          <p className="mt-1 text-xs text-slate-500">Render status: {clip.render_status ?? clip.status}</p>
        </div>
        {previewUrl || clip.exported_video_url ? (
          <a href={previewUrl ?? clip.exported_video_url ?? "#"} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
            <Download className="h-3.5 w-3.5" />
            Preview / download
          </a>
        ) : null}
      </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ProcessingTimeline({ status }: { status: StreamVideo["status"] }) {
  const steps = [
    { key: "uploaded", label: "Uploaded" },
    { key: "extracting_audio", label: "Audio extracted" },
    { key: "transcribing", label: "Transcribed" },
    { key: "analyzing", label: "Analyzed" },
    { key: "ranking", label: "Ranked" },
    { key: "ready", label: "Ready" }
  ];
  const activeIndex = activeStepIndex(status);

  return (
    <div className="grid gap-2">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Processing timeline</p>
      <div className="grid gap-2 sm:grid-cols-6">
        {steps.map((step, index) => {
          const active = index <= activeIndex;
          return (
            <div key={step.key} className={active ? "rounded-md border border-emerald-400/20 bg-emerald-400/10 p-2 text-xs text-emerald-100" : "rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs text-slate-500"}>
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  return (job.current_step ?? job.step ?? job.status).replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatRange(start: number | null, end: number | null) {
  if (start == null || end == null) return "pending";
  return `${formatSeconds(start)}-${formatSeconds(end)}`;
}

function formatSeconds(value: number) {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}
