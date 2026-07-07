"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ArrowLeft, Download, Play, RefreshCw, Sparkles } from "lucide-react";
import { AppShell, Badge, Card, EmptyNotice } from "@/components/ui";
import { formatStep, formatWorkerLastSeen, isWorkerConnected } from "@/lib/worker-health";
import type { Clip, ClipIdea, ProcessingJob, StreamVideo, StreamVideoDetail, WorkerHeartbeat } from "@/lib/types";

export type MomentReviewSnapshot = {
  video: StreamVideoDetail;
  workerHeartbeat: WorkerHeartbeat | null;
  clips: Array<{ clip: Clip; previewUrl: string | null }>;
};

type ExportStatus = {
  active: boolean;
  label: string | null;
  tone?: "default" | "error";
};

type MomentRecommendation = "export" | "needs_recut" | "maybe" | "skip";

export function MomentReviewClient({
  error,
  initialSnapshot,
  stepLabels,
  title
}: {
  error?: string;
  initialSnapshot: MomentReviewSnapshot;
  stepLabels: string[];
  title: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pollError, setPollError] = useState<string | null>(null);
  const [optimisticExportIdeaIds, setOptimisticExportIdeaIds] = useState<Set<string>>(new Set());
  const [optimisticAnalysis, setOptimisticAnalysis] = useState(false);
  const video = snapshot.video;
  const workerHeartbeat = snapshot.workerHeartbeat;
  const ideas = useMemo(() => [...(video.clip_ideas ?? [])].filter((idea) => momentV2Scores(idea).recommendation !== "skip").sort((first, second) => second.score - first.score), [video.clip_ideas]);
  const analysisJob = useMemo(() => latestJobByType(video.processing_jobs, "analyze_video"), [video.processing_jobs]);
  const renderJobs = useMemo(() => (video.processing_jobs ?? []).filter((job) => job.job_type === "render_ready_clip"), [video.processing_jobs]);
  const hasActiveAnalysis = optimisticAnalysis || isActiveJob(analysisJob) || isVideoProcessing(video.status, analysisJob);
  const hasActiveExport = optimisticExportIdeaIds.size > 0 || renderJobs.some(isActiveJob);
  const shouldPoll = hasActiveAnalysis || hasActiveExport;
  const progress = analysisProgress(video, analysisJob);
  const workerConnected = isWorkerConnected(workerHeartbeat);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const refreshSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`/api/stream-scan/videos/${snapshot.video.id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not refresh analysis status.");
      setSnapshot(payload as MomentReviewSnapshot);
      setPollError(null);
    } catch (caught) {
      setPollError(caught instanceof Error ? caught.message : "Could not refresh analysis status.");
    }
  }, [snapshot.video.id]);

  useEffect(() => {
    if (!shouldPoll) return;

    const interval = window.setInterval(refreshSnapshot, 2500);
    void refreshSnapshot();
    return () => window.clearInterval(interval);
  }, [refreshSnapshot, shouldPoll]);

  useEffect(() => {
    if (optimisticAnalysis && analysisJob) setOptimisticAnalysis(false);
  }, [analysisJob, optimisticAnalysis]);

  useEffect(() => {
    if (optimisticExportIdeaIds.size === 0) return;
    setOptimisticExportIdeaIds((current) => {
      const next = new Set(current);
      for (const ideaId of current) {
        if (hasExportRecord(ideaId, renderJobs, snapshot.clips)) next.delete(ideaId);
      }
      return next.size === current.size ? current : next;
    });
  }, [optimisticExportIdeaIds.size, renderJobs, snapshot.clips]);

  async function handleAnalyzeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasActiveAnalysis) return;
    setOptimisticAnalysis(true);
    setPollError(null);

    try {
      const response = await fetch(event.currentTarget.action, { method: "POST" });
      if (!response.ok) throw new Error("Could not start analysis.");
      await refreshSnapshot();
    } catch (caught) {
      setOptimisticAnalysis(false);
      setPollError(caught instanceof Error ? caught.message : "Could not start analysis.");
    }
  }

  async function handleExportSubmit(event: FormEvent<HTMLFormElement>, idea: ClipIdea) {
    event.preventDefault();
    const status = exportStatus(idea, renderJobs, snapshot.clips, optimisticExportIdeaIds);
    if (status.active) return;

    setOptimisticExportIdeaIds((current) => new Set(current).add(idea.id));
    setPollError(null);

    try {
      const form = event.currentTarget;
      const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
      if (!response.ok) throw new Error("Could not queue export.");
      await refreshSnapshot();
    } catch (caught) {
      setOptimisticExportIdeaIds((current) => {
        const next = new Set(current);
        next.delete(idea.id);
        return next;
      });
      setPollError(caught instanceof Error ? caught.message : "Could not queue export.");
    }
  }

  return (
    <AppShell title={title} eyebrow="Content Lab">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link href="/app/content-lab" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200">
          <ArrowLeft size={16} /> Back to Content Lab
        </Link>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Moment Review</p>
              <h2 className="mt-2 max-w-4xl text-2xl font-semibold tracking-tight text-white md:text-3xl">{video.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{video.original_filename ?? "Uploaded video"}{video.duration_seconds ? ` · ${formatDuration(video.duration_seconds)}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <VideoStatusBadge status={video.status} />
              <Badge className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100">{ideas.length} Found moments</Badge>
              <WorkerStatusBadge connected={workerConnected} />
            </div>
          </div>
        </section>

        {error ? <StateNotice tone="error" title="Action failed">{error}</StateNotice> : null}
        {pollError ? <StateNotice tone="error" title="Live update paused">{pollError}</StateNotice> : null}

        <StatusProgressPanel
          latestJob={analysisJob}
          processing={hasActiveAnalysis}
          progress={progress}
          stepLabels={stepLabels}
          video={video}
          workerHeartbeat={workerHeartbeat}
        />

        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Best moments</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Best moments</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Review the strongest timestamps, hooks and captions, then export the best vertical clip.</p>
            </div>
            <Badge className="w-fit border-white/10 bg-black/20 text-slate-200">{ideas.length} results</Badge>
          </div>

          {video.status === "failed" ? (
            <StateNotice tone="error" title="Analysis failed">
              {analysisJob?.error_message ?? video.error_message ?? "The analysis failed. Run Analysis Again when the source file is ready."}
            </StateNotice>
          ) : null}

          {hasActiveAnalysis && ideas.length === 0 ? (
            <StateNotice title="Analysis in progress">
              Claipper is finding the best moments. Progress and results update here automatically.
            </StateNotice>
          ) : null}

          <div className="grid gap-4">
            {ideas.length > 0 ? (
              ideas.map((idea, index) => (
                <MomentCard
                  key={idea.id}
                  exportStatus={exportStatus(idea, renderJobs, snapshot.clips, optimisticExportIdeaIds)}
                  idea={idea}
                  index={index}
                  onExportSubmit={handleExportSubmit}
                />
              ))
            ) : video.status !== "failed" && !hasActiveAnalysis ? (
              <EmptyNotice>No moments yet. Run Analysis Again to find hooks, timestamps and captions.</EmptyNotice>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
          <Card className="border-white/10 bg-white/[0.035] p-4">
            <h3 className="text-sm font-semibold text-white">Analysis</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use this when you want Claipper to look for moments again.</p>
            <form action={`/api/stream-scan/videos/${video.id}/process`} method="post" className="mt-4" onSubmit={handleAnalyzeSubmit}>
              <button
                disabled={hasActiveAnalysis}
                className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400/30 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                {hasActiveAnalysis ? "Analysis running..." : "Run Analysis Again"}
              </button>
            </form>
          </Card>

          <RenderedClipsCard clips={snapshot.clips} />
        </section>
      </div>
    </AppShell>
  );
}

function StatusProgressPanel({
  latestJob,
  processing,
  progress,
  stepLabels,
  video,
  workerHeartbeat
}: {
  latestJob?: ProcessingJob;
  processing: boolean;
  progress: number;
  stepLabels: string[];
  video: StreamVideo;
  workerHeartbeat: WorkerHeartbeat | null;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{statusTitle(video.status)}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {processing ? (latestJob ? formatJobStep(latestJob) : video.progress_text ?? "Preparing analysis") : video.status === "ready" ? "Analysis is ready. Review the best moments." : video.status === "failed" ? "Something stopped the analysis." : "Ready when you run analysis."}
          </p>
        </div>
        <p className="text-sm font-semibold text-emerald-200">{progress}%</p>
      </div>

      <CompactStepper status={video.status} steps={stepLabels} />

      {processing ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.45)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Last update {formatWorkerLastSeen(workerHeartbeat)}.</p>
        </div>
      ) : null}
    </Card>
  );
}

function CompactStepper({ status, steps }: { status: StreamVideo["status"]; steps: string[] }) {
  const activeIndex = activeStepIndex(status);

  return (
    <div className="mt-4">
      <div className="grid grid-cols-6 gap-1.5">
        {steps.map((step, index) => {
          const complete = index <= activeIndex;
          return (
            <div key={step} className="min-w-0">
              <div className={clsx("h-1.5 rounded-full", complete ? "bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,.35)]" : "bg-white/10")} />
              <p className={clsx("mt-2 truncate text-[10px] font-medium", complete ? "text-emerald-100" : "text-slate-600")}>{step}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RenderedClipsCard({ clips }: { clips: Array<{ clip: Clip; previewUrl: string | null }> }) {
  return (
    <Card className="border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Downloads</h3>
        <Badge className="border-white/10 bg-white/5 text-slate-300">{clips.length}</Badge>
      </div>
      {clips.length > 0 ? (
        <div className="mt-4 space-y-2">
          {clips.map(({ clip, previewUrl }) => (
            <DraftClipCard key={clip.id} clip={clip} previewUrl={previewUrl} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-400">Exports will appear here when they are ready.</p>
      )}
    </Card>
  );
}

function MomentCard({
  exportStatus,
  idea,
  index,
  onExportSubmit
}: {
  exportStatus: ExportStatus;
  idea: ClipIdea;
  index: number;
  onExportSubmit: (event: FormEvent<HTMLFormElement>, idea: ClipIdea) => void;
}) {
  const scores = momentV2Scores(idea);

  return (
    <Card className="border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-sm font-bold text-emerald-100">
            #{index + 1}
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold leading-tight tracking-tight text-white">{idea.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100">{formatRange(idea.start_time, idea.end_time)}</Badge>
              <Badge className="border-lime-300/30 bg-lime-300/10 text-lime-100">Score {idea.score}</Badge>
              <Badge className={recommendationClass(scores.recommendation)}>{formatRecommendation(scores.recommendation)}</Badge>
              <Badge className="border-white/10 bg-white/5 text-slate-300">{formatMomentVersion(scores.moment_finder_version)}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <MomentV2ScoreStrip idea={idea} />
        <LabeledText label="Why it works">{idea.reason}</LabeledText>
        <LabeledText label="Hook">{idea.hook}</LabeledText>
        <LabeledText label="Caption">{idea.caption}</LabeledText>
        {scores.recut_suggestion ? <p className="-mt-1 text-xs leading-5 text-slate-400">{scores.recut_suggestion}</p> : null}
        {scores.source_quote ? <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-400">Source quote: {scores.source_quote}</p> : null}
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
        <form action={`/api/stream-scan/clip-ideas/${idea.id}/ready-clip`} method="post" className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={(event) => onExportSubmit(event, idea)}>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium text-slate-200">
            <input
              type="checkbox"
              name="addCaptions"
              value="true"
              disabled={exportStatus.active}
              className="h-4 w-4 rounded border-white/20 bg-black accent-emerald-400"
            />
            Add captions
          </label>
          <button disabled={exportStatus.active} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(16,185,129,.25)] hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            <Play className="h-4 w-4" />
            {exportStatus.active ? "Exporting..." : "Export 9:16 Clip"}
          </button>
        </form>
        {exportStatus.label ? <p className={clsx("text-sm", exportStatus.tone === "error" ? "text-rose-200" : "text-slate-400")}>{exportStatus.label}</p> : null}
      </div>
    </Card>
  );
}

function MomentV2ScoreStrip({ idea }: { idea: ClipIdea }) {
  const scores = momentV2Scores(idea);

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CompactScore label="Attention" value={scores.attention_score} />
        <CompactScore label="Emotion" value={scores.emotion_spike} />
        <CompactScore label="Hook" value={scores.hook_strength} />
        <CompactScore label="Payoff" value={scores.payoff_score} />
        <CompactScore label="Context" value={scores.context_needed} inverse />
        <CompactScore label="Risk" value={scores.retention_risk} inverse />
        <CompactScore label="Edit" value={scores.edit_difficulty} inverse />
      </div>
    </div>
  );
}

function CompactScore({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const tone = inverse ? 100 - value : value;
  return (
    <span className={clsx("inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium", tone >= 75 ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : tone >= 50 ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100")}>
      <span className="text-slate-400">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}

function DraftClipCard({ clip, previewUrl }: { clip: Clip; previewUrl: string | null }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{clip.title ?? (clip.type === "ready" ? "Ready clip" : "Draft clip")}</p>
          <p className="mt-1 text-xs text-slate-500">{formatRange(clip.start_seconds, clip.end_seconds)} · {formatCaptionMode(clip)} · {clip.render_status ?? clip.status}</p>
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

function formatCaptionMode(clip: Clip) {
  return clip.raw_data?.add_captions === true ? "Captions" : "Clean";
}

function momentV2Scores(idea: ClipIdea) {
  const rawScores: Record<string, unknown> = isRecord(idea.raw_data?.moment_v2) ? idea.raw_data.moment_v2 : {};
  return {
    moment_finder_version: typeof idea.raw_data?.moment_finder_version === "string" ? idea.raw_data.moment_finder_version : null,
    attention_score: scoreFromRaw(rawScores.attention_score, idea.score),
    emotion_spike: scoreFromRaw(rawScores.emotion_spike, 50),
    hook_strength: scoreFromRaw(rawScores.hook_strength, idea.score),
    payoff_score: scoreFromRaw(rawScores.payoff_score, 50),
    context_needed: scoreFromRaw(rawScores.context_needed, 50),
    retention_risk: scoreFromRaw(rawScores.retention_risk, 50),
    edit_difficulty: scoreFromRaw(rawScores.edit_difficulty, 50),
    recommendation: recommendationFromRaw(rawScores.recommendation),
    recut_suggestion: typeof rawScores.recut_suggestion === "string" ? rawScores.recut_suggestion.trim() : "",
    source_quote: typeof rawScores.source_quote === "string" ? rawScores.source_quote.trim() : ""
  };
}

function scoreFromRaw(value: unknown, fallback: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value ?? fallback))));
}

function recommendationFromRaw(value: unknown): MomentRecommendation {
  return value === "export" || value === "needs_recut" || value === "maybe" || value === "skip" ? value : "maybe";
}

function formatRecommendation(value: MomentRecommendation) {
  if (value === "export") return "Export";
  if (value === "needs_recut") return "Needs recut";
  if (value === "skip") return "Skip";
  return "Maybe";
}

function formatMomentVersion(value: string | null) {
  return value ?? "legacy";
}

function recommendationClass(value: MomentRecommendation) {
  if (value === "export") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (value === "needs_recut") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  if (value === "skip") return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/5 text-slate-200";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function StateNotice({ children, title, tone = "default" }: { children: React.ReactNode; title: string; tone?: "default" | "error" }) {
  return (
    <div className={clsx("rounded-lg border p-4", tone === "error" ? "border-rose-300/20 bg-rose-300/10" : "border-emerald-300/20 bg-emerald-300/10")}>
      <div className="flex items-start gap-3">
        <Sparkles className={clsx("mt-0.5 h-4 w-4", tone === "error" ? "text-rose-200" : "text-emerald-200")} />
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
    <div className="rounded-md bg-black/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{children}</p>
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
      {connected ? "Online" : "Offline"}
    </Badge>
  );
}

function latestJobByType(jobs: ProcessingJob[] | undefined, jobType: string) {
  return [...(jobs ?? [])]
    .filter((job) => job.job_type === jobType)
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];
}

function isActiveJob(job: ProcessingJob | undefined) {
  return job?.status === "queued" || job?.status === "running";
}

function hasExportRecord(ideaId: string, renderJobs: ProcessingJob[], clips: Array<{ clip: Clip; previewUrl: string | null }>) {
  return renderJobs.some((job) => job.clip_idea_id === ideaId) || clips.some(({ clip }) => clip.clip_idea_id === ideaId);
}

function exportStatus(idea: ClipIdea, renderJobs: ProcessingJob[], clips: Array<{ clip: Clip; previewUrl: string | null }>, optimisticExportIdeaIds: Set<string>): ExportStatus {
  const job = [...renderJobs]
    .filter((candidate) => candidate.clip_idea_id === idea.id)
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];
  const clip = [...clips]
    .map((entry) => entry.clip)
    .filter((candidate) => candidate.clip_idea_id === idea.id)
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];

  if (optimisticExportIdeaIds.has(idea.id)) {
    return { active: true, label: "queued" };
  }

  if (isActiveJob(job)) {
    return { active: true, label: formatExportStep(job.current_step ?? job.step ?? job.status) };
  }

  if (clip?.render_status === "queued" || clip?.render_status === "running") {
    return { active: true, label: formatExportStep(clip.render_status) };
  }

  if (job?.status === "failed" || clip?.render_status === "failed") {
    return { active: false, label: job?.error_message ?? "Export failed. Try again.", tone: "error" };
  }

  if (clip?.render_status === "completed" || job?.status === "completed") {
    return { active: false, label: "completed" };
  }

  return { active: false, label: null };
}

function formatExportStep(value: string | null | undefined) {
  const normalized = String(value ?? "queued").replaceAll("_", " ");
  if (normalized.includes("upload")) return "uploading";
  if (normalized.includes("render")) return "rendering";
  return normalized;
}

function isVideoProcessing(status: StreamVideo["status"], job?: ProcessingJob) {
  if (status === "ready" || status === "failed") return false;
  if (job?.status === "queued" || job?.status === "running") return true;
  return ["uploading", "import_queued", "downloading", "queued", "extracting_audio", "transcribing", "segmenting", "analyzing", "ranking"].includes(status);
}

function analysisProgress(video: StreamVideo, job?: ProcessingJob) {
  if (video.status === "ready" || video.status === "failed" || job?.status === "completed") return 100;
  return Math.max(0, Math.min(100, job?.progress_percent ?? video.progress_percent ?? statusProgress(video.status)));
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

function statusTitle(status: StreamVideo["status"]) {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Needs attention";
  if (status === "created" || status === "uploaded") return "Ready to analyze";
  return "Analyzing";
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
