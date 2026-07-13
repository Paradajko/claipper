import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { downloadOriginalVideo, normalizeOriginalStorageProvider, uploadOriginalVideo } from "./object-storage.mjs";
import {
  buildYtDlpDownloadArgs,
  createPlatformImportError,
  findAvailableChromeImpersonationTarget
} from "./platform-import.mjs";
import {
  buildAssDocument,
  buildReadyRenderCommand,
  buildRenderTimeline,
  groundColdOpenHook,
  normalizeEditPlan,
  validateProbeResult
} from "./video-production.mjs";
import {
  assertValidWorkerEnv,
  checkBinaryAvailability,
  formatStartupReport,
  loadWorkerDotEnv,
  retryOperation,
  userFriendlyWorkerError
} from "./worker-utils.mjs";

const execFileAsync = promisify(execFile);

loadWorkerDotEnv();
try {
  assertValidWorkerEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Claipper Stream Scan Worker cannot start.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId = process.env.WORKER_ID;
const workerProcessToken = randomUUID();
const workerProcessId = `${workerId}:${workerProcessToken}`;
const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS);
const ffmpegBinary = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobeBinary = process.env.FFPROBE_PATH ?? "ffprobe";
const ytDlpBinary = process.env.YTDLP_PATH ?? "yt-dlp";
const READY_CLIP_MIN_SECONDS = 20;
const READY_CLIP_MAX_SECONDS = 60;
const JOB_LEASE_TIMEOUT_MS = 120000;
const MOMENT_FINDER_VERSION = "v3";
const CLIP_DIFFICULTIES = ["easy", "medium", "hard"];
const CLIP_TYPES = ["funny", "reaction", "opinion", "educational", "hype", "story", "other"];
const CLIP_RECOMMENDATIONS = ["export", "needs_recut", "maybe", "skip"];
const buckets = {
  originals: process.env.STORAGE_BUCKET_ORIGINALS,
  audio: process.env.STORAGE_BUCKET_AUDIO,
  clips: process.env.STORAGE_BUCKET_CLIPS
};

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let activeJobId = null;
let activeStep = "idle";

await startupChecks();
pollForever().catch((error) => {
  console.error("[claipper-worker] fatal", error);
  process.exit(1);
});

async function pollForever() {
  await updateHeartbeat("online", null, "idle");
  const heartbeatTimer = setInterval(() => {
    void updateHeartbeat("online", activeJobId, activeStep);
  }, 15000);

  process.on("SIGINT", () => shutdown(heartbeatTimer));
  process.on("SIGTERM", () => shutdown(heartbeatTimer));

  while (true) {
    await updateHeartbeat("online", activeJobId, activeStep);
    await recoverStaleWorkerJobs();
    const claimed = await claimNextJob();
    if (claimed) {
      activeJobId = claimed.id;
      activeStep = "claimed";
      await updateHeartbeat("busy", claimed.id, activeStep);
      await runJob(claimed).catch((error) => failJob(claimed, error));
      activeJobId = null;
      activeStep = "idle";
      await updateHeartbeat("online", null, "idle");
    } else {
      await sleep(pollIntervalMs);
    }
  }
}

async function claimNextJob() {
  const { data: queued, error } = await supabase
    .from("processing_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !queued) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("processing_jobs")
    .update({
      status: "running",
      worker_id: workerProcessId,
      locked_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      attempts: (queued.attempts ?? 0) + 1,
      current_step: "claimed",
      step: "claimed",
      updated_at: new Date().toISOString()
    })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError || !claimed) return null;
  return claimed;
}

async function recoverStaleWorkerJobs() {
  const staleBefore = new Date(Date.now() - JOB_LEASE_TIMEOUT_MS).toISOString();
  const { data: recovered, error } = await supabase
    .from("processing_jobs")
    .update({
      status: "queued",
      current_step: "recovered_after_worker_restart",
      step: "recovered_after_worker_restart",
      worker_id: null,
      locked_at: null,
      started_at: null,
      error_message: null,
      technical_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("status", "running")
    .lt("locked_at", staleBefore)
    .select("id");
  if (error) {
    console.error("[claipper-worker] stale job recovery failed", error.message);
    return;
  }
  if (recovered?.length > 0) {
    console.log(`[claipper-worker] recovered ${recovered.length} interrupted job(s)`);
  }
}

async function runJob(job) {
  if (job.job_type === "platform_import") {
    await processPlatformImport(job);
    return;
  }
  if (job.job_type === "analyze_video") {
    await processAnalyzeVideo(job);
    return;
  }
  if (job.job_type === "render_draft") {
    await processRenderDraft(job);
    return;
  }
  if (job.job_type === "render_ready_clip") {
    await processRenderReadyClip(job);
    return;
  }
  throw new Error(`Unsupported job type: ${job.job_type}`);
}

async function processPlatformImport(job) {
  const video = await loadVideo(job.video_id);
  if (!video.source_url) throw new Error("Platform import is missing source URL.");

  const workDir = await makeWorkDir(job.video_id);
  const outputTemplate = path.join(workDir, "source.%(ext)s");

  try {
    await updateJob(job.id, "running", "downloading_source", 10);
    await updateVideo(video.id, "downloading", 10, "Downloading platform video with processing worker.");

    const downloadArgs = buildYtDlpDownloadArgs({ sourceUrl: video.source_url, outputTemplate });
    let stdout;
    try {
      ({ stdout } = await execFileAsync(ytDlpBinary, downloadArgs));
    } catch (error) {
      const failure = createPlatformImportError(error, { sourceUrl: video.source_url, args: downloadArgs });
      console.error("[claipper-worker] yt-dlp verbose failure", failure.technicalError);
      throw failure;
    }

    const downloadedPath = stdout.trim().split("\n").filter(Boolean).at(-1);
    if (!downloadedPath) throw new Error("Downloader finished without returning a video file path.");

    const extension = path.extname(downloadedPath).toLowerCase() || ".mp4";
    const storagePath = `default/${video.id}/source${extension}`;
    const originalProvider = normalizeOriginalStorageProvider(process.env.OBJECT_STORAGE_PROVIDER);
    const originalBucket = originalProvider === "supabase" ? buckets.originals : process.env.OBJECT_STORAGE_BUCKET;

    await updateJob(job.id, "running", "uploading_source", 20);
    if (originalProvider === "supabase") {
      await uploadFile(buckets.originals, storagePath, downloadedPath, "video/mp4");
    } else {
      await uploadOriginalVideo({
        provider: originalProvider,
        storagePath,
        inputPath: downloadedPath,
        contentType: "video/mp4"
      });
    }

    await supabase
      .from("videos")
      .update({
        storage_bucket: originalBucket,
        storage_path: storagePath,
        file_path: storagePath,
        source_storage_provider: originalProvider,
        source_storage_path: storagePath,
        raw_data: {
          ...(video.raw_data ?? {}),
          source_storage_provider: originalProvider,
          source_storage_path: storagePath
        },
        status: "queued",
        progress_percent: 25,
        progress_text: "Platform video imported. Starting analysis.",
        updated_at: new Date().toISOString()
      })
      .eq("id", video.id);

    await supabase.from("video_imports").update({ status: "completed", updated_at: new Date().toISOString() }).eq("video_id", video.id);
    await processAnalyzeVideo(job, { localSourcePath: downloadedPath, workDir });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function processAnalyzeVideo(job, { localSourcePath = null, workDir: existingWorkDir = null } = {}) {
  const video = await loadVideo(job.video_id);
  const sourceStoragePath = getVideoSourceStoragePath(video);
  if (!sourceStoragePath) throw new Error("Video is missing source storage path.");

  const workDir = existingWorkDir ?? await makeWorkDir(job.video_id);
  const sourcePath = localSourcePath ?? path.join(workDir, `source${path.extname(sourceStoragePath) || ".mp4"}`);
  const audioPath = path.join(workDir, "audio.mp3");

  if (!localSourcePath) {
    await updateJob(job.id, "running", "downloading_source", 15);
    await downloadSourceVideo(video, sourcePath);
  }

  await updateJob(job.id, "running", "extracting_audio", 35);
  await updateVideo(video.id, "extracting_audio", 35, "Extracting audio with FFmpeg.");
  await execFileAsync(ffmpegBinary, ["-y", "-i", sourcePath, "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", audioPath]);

  const audioStoragePath = `${video.id}/audio.mp3`;
  await updateJob(job.id, "running", "uploading_audio", 43);
  await uploadFile(buckets.audio, audioStoragePath, audioPath, "audio/mpeg");
  await supabase.from("videos").update({ audio_path: audioStoragePath }).eq("id", video.id);

  await updateJob(job.id, "running", "transcribing", 50);
  await updateVideo(video.id, "transcribing", 50, "Transcribing audio with timestamps.");
  const transcript = await transcribeAudio(audioPath);

  await updateJob(job.id, "running", "saving_transcript", 58);
  const transcriptId = await saveTranscript(video.id, transcript);

  await updateJob(job.id, "running", "segmenting", 62);
  await updateVideo(video.id, "segmenting", 62, "Splitting transcript into 5-10 minute chunks.");
  const transcriptItems = toTranscriptItems(transcript);
  const transcriptWords = toTranscriptWords(transcript);
  const segments = buildOverlappingTranscriptSegments(transcriptItems, 600, 120);
  await saveTranscriptSegments(video.id, transcriptId, segments);

  await updateJob(job.id, "running", "analyzing_segments", 75);
  await updateVideo(video.id, "analyzing", 75, "Analyzing transcript chunks for clip candidates.");
  const candidates = [];
  for (const segment of segments) {
    candidates.push(...(await analyzeTranscriptSegment(segment)));
  }
  console.log(`[claipper-worker] moment_finder_version=${MOMENT_FINDER_VERSION} local candidates found: ${candidates.length}`);

  await updateJob(job.id, "running", "ranking_candidates", 90);
  await updateVideo(video.id, "ranking", 90, "Ranking the strongest moments.");
  const ranked = await rankCandidatesWithAi(candidates);
  const grounded = ranked.map((candidate) => groundClipCandidate(candidate, transcriptItems));
  const refined = grounded.map((candidate) => refineFinalMomentTiming(candidate, transcriptItems));
  const verified = [];
  for (const candidate of refined) verified.push(await verifyCandidateTiming(candidate, transcriptItems, transcriptWords));
  console.log(`[claipper-worker] moment_finder_version=${MOMENT_FINDER_VERSION} final ranked candidates: ${verified.length}`);
  for (const [index, moment] of verified.entries()) {
    const overlappingPreview = extractSourceQuote(transcriptItems, moment.start_time, moment.end_time).slice(0, 260);
    console.log(
      `[claipper-worker] final moment ${index + 1}: title="${moment.title}" start_time=${secondsToTimestamp(moment.start_time)} end_time=${secondsToTimestamp(moment.end_time)} source_quote="${moment.source_quote}" overlapping transcript preview="${overlappingPreview}"`
    );
  }
  await updateJob(job.id, "running", "saving_clip_ideas", 95);
  await saveClipIdeas(video.id, verified);

  await updateVideo(video.id, "ready", 100, `Ready with ${verified.length} ranked clip ideas.`);
  await updateJob(job.id, "completed", "ready", 100);
}

async function processRenderDraft(job) {
  await processRenderClip(job, { ready: false });
}

async function processRenderReadyClip(job) {
  await processRenderClip(job, { ready: true });
}

async function processRenderClip(job, { ready }) {
  if (!job.clip_id) throw new Error("Draft render job is missing clip_id.");

  const { data: clip, error: clipError } = await supabase.from("clips").select("*").eq("id", job.clip_id).single();
  if (clipError || !clip) throw new Error(clipError?.message ?? "Clip not found.");
  const video = await loadVideo(clip.video_id);
  const sourceStoragePath = getVideoSourceStoragePath(video);
  if (!sourceStoragePath) throw new Error("Video is missing source storage path.");
  const hasEditPlan = Boolean(clip.raw_data?.edit_plan);
  const renderClip = ready && !hasEditPlan ? await refineReadyClipTiming(video.id, clip) : clip;

  const workDir = await makeWorkDir(video.id);
  const sourcePath = path.join(workDir, `source${path.extname(sourceStoragePath) || ".mp4"}`);
  const outputPath = path.join(workDir, `${renderClip.id}.mp4`);
  const duration = Math.max(1, Number(renderClip.end_seconds ?? 0) - Number(renderClip.start_seconds ?? 0));
  const renderLabel = ready ? "ready clip" : "draft";
  let qualityCheck = null;

  await updateJob(job.id, "running", "downloading_source", 20);
  await supabase.from("clips").update({ render_status: "running" }).eq("id", renderClip.id);
  await downloadSourceVideo(video, sourcePath);

  await updateJob(job.id, "running", ready ? "rendering_ready_clip" : "rendering_draft", 65);
  if (ready) {
    const storedEditPlan = renderClip.raw_data?.edit_plan;
    const editPlan = normalizeEditPlan(
      storedEditPlan ?? legacyEditPlan(renderClip, job),
      { legacy: !storedEditPlan || storedEditPlan.version !== 1 }
    );
    const timeline = buildRenderTimeline(editPlan);
    const timing = editPlan.add_captions
      ? await loadTranscriptTiming(video.id, editPlan.start_seconds, editPlan.end_seconds)
      : { words: [], segments: [] };
    const captionItems = timing.words.length > 0 ? timing.words : timing.segments;
    const assPath = captionItems.length > 0 ? path.join(workDir, `${renderClip.id}.ass`) : null;
    if (assPath) {
      const ass = buildAssDocument(captionItems, timeline, { width: 1080, height: 1920, preset: "creator" });
      await writeFile(assPath, ass, "utf8");
    }
    const command = buildReadyRenderCommand({
      inputPath: sourcePath,
      outputPath,
      editPlan,
      timeline,
      assPath
    });
    await execFileAsync(ffmpegBinary, command.args);

    await updateJob(job.id, "running", "validating_ready_clip", 85);
    let probe;
    try {
      const { stdout } = await execFileAsync(ffprobeBinary, [
        "-v", "error", "-show_streams", "-show_format", "-of", "json", outputPath
      ]);
      probe = JSON.parse(stdout);
    } catch (error) {
      qualityCheck = {
        status: "failed",
        checked_at: new Date().toISOString(),
        details: { errors: ["ffprobe_error"], technical_error: cleanError(error) }
      };
      throw renderFailureError(
        new Error(`Ready clip QA failed: ffprobe_error: ${cleanError(error)}`),
        renderClip,
        qualityCheck
      );
    }
    const validation = validateProbeResult(probe, { width: 1080, height: 1920, duration: command.expectedDuration });
    const details = summarizeProbeResult(probe, command.expectedDuration, validation.errors);
    if (!validation.ok) {
      qualityCheck = { status: "failed", checked_at: new Date().toISOString(), details };
      throw renderFailureError(
        new Error(`Ready clip QA failed: ${validation.errors.join(", ")}`),
        renderClip,
        qualityCheck
      );
    }
    qualityCheck = { status: "passed", checked_at: new Date().toISOString(), details };
  } else {
    try {
      await execFileAsync(ffmpegBinary, [
        "-y",
        "-ss",
        String(renderClip.start_seconds ?? 0),
        "-i",
        sourcePath,
        "-t",
        String(duration),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        outputPath
      ]);
    } catch {
      await execFileAsync(ffmpegBinary, [
        "-y",
        "-ss",
        String(renderClip.start_seconds ?? 0),
        "-i",
        sourcePath,
        "-t",
        String(duration),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        outputPath
      ]);
    }
  }

  const storagePath = `${video.id}/${clip.id}/${workerProcessToken}.mp4`;
  await assertJobLease(job.id);
  try {
    await uploadFile(buckets.clips, storagePath, outputPath, "video/mp4");
  } catch (error) {
    if (ready && qualityCheck) {
      throw renderFailureError(error, renderClip, qualityCheck, error);
    }
    throw error;
  }
  await assertJobLease(job.id);

  const { data: completed, error: completionError } = await supabase.rpc("complete_render_job", {
    p_job_id: job.id,
    p_worker_process_id: workerProcessId,
    p_clip_id: renderClip.id,
    p_clip_idea_id: renderClip.clip_idea_id ?? null,
    p_storage_bucket: buckets.clips,
    p_storage_path: storagePath,
    p_clip_status: ready ? "ready" : renderClip.status,
    p_clip_raw_data: {
      ...(renderClip.raw_data ?? {}),
      render_type: ready ? "ready" : "draft",
      rendered_by: "railway_worker",
      ...(ready ? { render_version: 2, quality_check: qualityCheck } : {})
    },
    p_idea_status: ready ? "rendered" : "drafted",
    p_job_step: `${renderLabel}_completed`
  });
  if (completionError) throw new Error(`Could not complete render job: ${completionError.message}`);
  if (!completed) throw new Error(`Worker lease lost for job ${job.id}.`);
}

function renderFailureError(error, clip, qualityCheck, renderError = null) {
  const failure = error instanceof Error ? error : new Error(cleanError(error));
  const renderFailure = renderError
    ? {
        stage: "uploading_render",
        error_message: userFriendlyWorkerError(renderError),
        technical_error: cleanError(renderError),
        failed_at: new Date().toISOString()
      }
    : null;
  failure.renderFailureRawData = {
    ...(clip.raw_data ?? {}),
    render_version: 2,
    quality_check: qualityCheck,
    ...(renderFailure ? { render_failure: renderFailure } : {})
  };
  return failure;
}

async function refineReadyClipTiming(videoId, clip) {
  const originalStart = Number(clip.start_seconds ?? 0);
  const originalEnd = Number(clip.end_seconds ?? originalStart + READY_CLIP_MIN_SECONDS);
  const contextStart = Math.max(0, originalStart - 20);
  const contextEnd = originalEnd + 20;
  const contextSegments = await loadFineTranscriptSegments(videoId, contextStart, contextEnd);
  if (contextSegments.length === 0) return clip;

  const refined = await refineTimingWithAi(clip, contextSegments, contextStart, contextEnd).catch((error) => {
    console.warn("[claipper-worker] ready clip timing refinement skipped", cleanError(error));
    return null;
  });
  const fallback = refined ?? refineTimingFromTranscriptBounds(clip, contextSegments);
  if (!fallback) return clip;

  const nextStart = roundSeconds(fallback.start_seconds);
  const nextEnd = roundSeconds(fallback.end_seconds);
  if (Math.abs(nextStart - originalStart) < 0.1 && Math.abs(nextEnd - originalEnd) < 0.1) return clip;

  const rawData = {
    ...(clip.raw_data ?? {}),
    timing_refined_by: refined ? "ai_ready_clip_worker" : "transcript_bounds",
    timing_refined_at: new Date().toISOString(),
    original_start_seconds: originalStart,
    original_end_seconds: originalEnd,
    timing_refinement_reason: fallback.reason ?? null
  };

  const { data, error } = await supabase
    .from("clips")
    .update({
      start_seconds: nextStart,
      end_seconds: nextEnd,
      duration_seconds: nextEnd - nextStart,
      raw_data: rawData,
      updated_at: new Date().toISOString()
    })
    .eq("id", clip.id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[claipper-worker] ready clip timing refinement save failed", error?.message ?? "missing updated clip");
    return { ...clip, start_seconds: nextStart, end_seconds: nextEnd, duration_seconds: nextEnd - nextStart, raw_data: rawData };
  }

  return data;
}

async function refineTimingWithAi(clip, contextSegments, contextStart, contextEnd) {
  const originalStart = Number(clip.start_seconds ?? contextStart);
  const originalEnd = Number(clip.end_seconds ?? originalStart + READY_CLIP_MIN_SECONDS);
  const context = contextSegments
    .map((segment) => `${segment.start.toFixed(1)}-${segment.end.toFixed(1)}: ${segment.text}`)
    .join("\n")
    .slice(0, 9000);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Refine short-form clip timing for TikTok/Reels. Return only JSON. Choose exact absolute seconds. Keep clips 20-60 seconds. Start close to the strongest moment; avoid irrelevant intro. End after a clear sentence/payoff, not mid-thought."
      },
      {
        role: "user",
        content: [
          `Original clip: ${originalStart.toFixed(1)}-${originalEnd.toFixed(1)}`,
          `Allowed context: ${contextStart.toFixed(1)}-${contextEnd.toFixed(1)}`,
          "Return {\"start_seconds\":number,\"end_seconds\":number,\"reason\":\"short explanation\"}.",
          "Prefer 20-60 seconds, avoid irrelevant intro, and end after a clear sentence/payoff.",
          "Transcript context:",
          context
        ].join("\n\n")
      }
    ],
    temperature: 0.1,
    max_tokens: 300
  });

  const parsed = JSON.parse(completion.choices[0]?.message.content ?? "{}");
  return constrainReadyClipTiming(
    {
      start_seconds: Number(parsed.start_seconds),
      end_seconds: Number(parsed.end_seconds),
      reason: String(parsed.reason ?? "AI timing refinement")
    },
    { contextStart, contextEnd, originalStart, originalEnd }
  );
}

function refineTimingFromTranscriptBounds(clip, contextSegments) {
  const originalStart = Number(clip.start_seconds ?? 0);
  const originalEnd = Number(clip.end_seconds ?? originalStart + READY_CLIP_MIN_SECONDS);
  const overlapping = contextSegments.filter((segment) => segment.end > originalStart && segment.start < originalEnd);
  if (overlapping.length === 0) return null;
  return constrainReadyClipTiming(
    {
      start_seconds: Math.max(originalStart, overlapping[0].start),
      end_seconds: Math.min(originalEnd, overlapping[overlapping.length - 1].end),
      reason: "Trimmed to transcript segment boundaries"
    },
    { contextStart: Math.max(0, originalStart - 20), contextEnd: originalEnd + 20, originalStart, originalEnd }
  );
}

function constrainReadyClipTiming(candidate, bounds) {
  if (!Number.isFinite(candidate.start_seconds) || !Number.isFinite(candidate.end_seconds)) return null;
  let start = Math.max(bounds.contextStart, Math.min(candidate.start_seconds, bounds.contextEnd - READY_CLIP_MIN_SECONDS));
  let end = Math.max(start + READY_CLIP_MIN_SECONDS, Math.min(candidate.end_seconds, bounds.contextEnd));
  if (end - start > READY_CLIP_MAX_SECONDS) end = start + READY_CLIP_MAX_SECONDS;
  if (end > bounds.contextEnd) {
    end = bounds.contextEnd;
    start = Math.max(bounds.contextStart, end - READY_CLIP_MAX_SECONDS);
  }
  if (end <= start) return null;
  return { start_seconds: start, end_seconds: end, reason: candidate.reason };
}

function roundSeconds(value) {
  return Math.round(value * 10) / 10;
}

function legacyEditPlan(clip, job) {
  return {
    start_seconds: Number(clip.start_seconds ?? 0),
    end_seconds: Number(clip.end_seconds ?? clip.start_seconds ?? 0) + (clip.end_seconds == null ? 1 : 0),
    hook_mode: "natural",
    hook_start_seconds: null,
    hook_end_seconds: null,
    framing_mode: "center",
    background_mode: "crop",
    subtitle_preset: "creator",
    add_captions: clip.raw_data?.add_captions === true || job.raw_data?.add_captions === true,
    enhance_enabled: false
  };
}

function summarizeProbeResult(probe, expectedDuration, errors) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video") ?? null;
  const audio = streams.find((stream) => stream.codec_type === "audio") ?? null;
  return {
    video_codec: video?.codec_name ?? null,
    audio_codec: audio?.codec_name ?? null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    duration_seconds: Number(probe?.format?.duration ?? 0),
    expected_duration_seconds: expectedDuration,
    errors
  };
}

async function loadTranscriptTiming(videoId, clipStart, clipEnd) {
  const { data, error } = await supabase
    .from("transcripts")
    .select("segments_json")
    .eq("video_id", videoId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);

  const values = (data ?? []).map((transcript) => transcript.segments_json);
  const parsedSegments = values
    .flatMap(parseTranscriptJsonSegments)
    .filter((segment) => segment.end > clipStart && segment.start < clipEnd)
    .sort((first, second) => first.start - second.start);
  const segments = parsedSegments.length > 0
    ? parsedSegments
    : (await loadTranscriptSegments(videoId, clipStart, clipEnd)).map((segment) => ({
        start: Number(segment.start_time ?? clipStart),
        end: Number(segment.end_time ?? clipEnd),
        text: String(segment.text ?? "")
      }));
  const words = values
    .flatMap(parseTranscriptJsonWords)
    .filter((word) => word.end > clipStart && word.start < clipEnd)
    .sort((first, second) => first.start - second.start);
  return { segments, words };
}

async function loadFineTranscriptSegments(videoId, clipStart, clipEnd) {
  const { data, error } = await supabase
    .from("transcripts")
    .select("segments_json")
    .eq("video_id", videoId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .flatMap((transcript) => parseTranscriptJsonSegments(transcript.segments_json))
    .filter((segment) => segment.end > clipStart && segment.start < clipEnd)
    .sort((first, second) => first.start - second.start);
}

function parseTranscriptJsonSegments(value) {
  const segments = Array.isArray(value) ? value : value?.segments ?? [];
  return segments
    .map((segment) => ({
      start: Number(segment?.start ?? segment?.start_time ?? 0),
      end: Number(segment?.end ?? segment?.end_time ?? segment?.start ?? 0),
      text: String(segment?.text ?? "").replace(/\s+/g, " ").trim()
    }))
    .filter((segment) => segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start);
}

function parseTranscriptJsonWords(value) {
  const words = Array.isArray(value) ? [] : value?.words ?? [];
  return words
    .map((word) => ({
      start: Number(word?.start ?? 0),
      end: Number(word?.end ?? word?.start ?? 0),
      text: String(word?.word ?? word?.text ?? "").replace(/\s+/g, " ").trim()
    }))
    .filter((word) => word.text && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start);
}

async function loadTranscriptSegments(videoId, clipStart, clipEnd) {
  const { data, error } = await supabase
    .from("transcript_segments")
    .select("start_time, end_time, text")
    .eq("video_id", videoId)
    .lt("start_time", clipEnd)
    .gt("end_time", clipStart)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadVideo(videoId) {
  const { data, error } = await supabase.from("videos").select("*").eq("id", videoId).single();
  if (error || !data) throw new Error(error?.message ?? "Video not found.");
  return data;
}

async function updateVideo(videoId, status, progressPercent, progressText, errorMessage = null) {
  await supabase
    .from("videos")
    .update({
      status,
      progress_percent: progressPercent,
      progress_text: progressText,
      error_message: errorMessage,
      updated_at: new Date().toISOString()
    })
    .eq("id", videoId);
}

async function updateJob(jobId, status, step, progressPercent, errorMessage = null) {
  activeStep = step;
  console.log(`[claipper-worker] job ${jobId} ${status}: ${step} (${progressPercent}%)`);
  await updateHeartbeat(status === "running" ? "busy" : "online", activeJobId, step);

  const timestamps = {};
  if (status === "completed") timestamps.completed_at = new Date().toISOString();
  if (status === "failed") timestamps.failed_at = new Date().toISOString();

  const { data: updatedJob, error: jobUpdateError } = await supabase
    .from("processing_jobs")
    .update({
      status,
      current_step: step,
      step,
      progress_percent: progressPercent,
      error_message: errorMessage,
      ...timestamps,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .eq("status", "running")
    .eq("worker_id", workerProcessId)
    .select("id")
    .maybeSingle();
  if (jobUpdateError) throw new Error(`Could not update processing job: ${jobUpdateError.message}`);
  if (!updatedJob) throw new Error(`Worker lease lost for job ${jobId}.`);
}

async function failJob(job, error) {
  const technicalError = typeof error?.technicalError === "string" ? error.technicalError : cleanError(error);
  const userError = typeof error?.userMessage === "string" ? error.userMessage : userFriendlyWorkerError(error);
  console.error(`[claipper-worker] job ${job.id} failed`, technicalError);
  activeStep = "failed";
  const isRenderJob = job.job_type === "render_draft" || job.job_type === "render_ready_clip";
  let failureOwned = false;
  try {
    failureOwned = await retryOperation(() => persistFailedJobState(job, userError, technicalError, error), { attempts: 3, delayMs: 1000 });
  } catch (persistenceError) {
    console.error(`[claipper-worker] job ${job.id} failure state could not be persisted after retries`, cleanError(persistenceError));
  }
  if (failureOwned && !isRenderJob && job.video_id) {
    await updateVideo(job.video_id, "failed", 100, userError, userError);
  }
  await updateHeartbeat("online", null, "failed");
}

async function persistFailedJobState(job, userError, technicalError, error) {
  const { data: failed, error: failureError } = await supabase.rpc("fail_processing_job", {
    p_job_id: job.id,
    p_worker_process_id: workerProcessId,
    p_clip_id: job.clip_id ?? null,
    p_clip_idea_id: job.clip_idea_id ?? null,
    p_user_error: userError,
    p_technical_error: technicalError,
    p_progress_percent: job.progress_percent ?? 0,
    p_clip_raw_data: error?.renderFailureRawData ?? null
  });
  if (failureError) throw new Error(`Could not persist failed job state: ${failureError.message}`);
  return Boolean(failed);
}

async function refreshJobLease(jobId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("processing_jobs")
    .update({ locked_at: now, updated_at: now })
    .eq("id", jobId)
    .eq("status", "running")
    .eq("worker_id", workerProcessId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not refresh worker lease: ${error.message}`);
  return Boolean(data);
}

async function assertJobLease(jobId) {
  if (!(await refreshJobLease(jobId))) throw new Error(`Worker lease lost for job ${jobId}.`);
}

async function makeWorkDir(id) {
  const dir = path.join(os.tmpdir(), "claipper-worker", id, randomUUID());
  await mkdir(dir, { recursive: true });
  return dir;
}

async function downloadSourceVideo(video, outputPath) {
  const provider = getVideoSourceStorageProvider(video);
  const storagePath = getVideoSourceStoragePath(video);
  if (!storagePath) throw new Error("Video is missing source storage path.");

  if (provider !== "supabase") {
    await downloadOriginalVideo({ provider, storagePath, outputPath });
    return;
  }

  if (!video.storage_bucket || !video.storage_path) throw new Error("Video is missing Supabase Storage source path.");
  await downloadFile(video.storage_bucket, video.storage_path, outputPath);
}

function getVideoSourceStorageProvider(video) {
  return normalizeOriginalStorageProvider(video.source_storage_provider ?? video.raw_data?.source_storage_provider);
}

function getVideoSourceStoragePath(video) {
  if (typeof video.source_storage_path === "string" && video.source_storage_path.length > 0) return video.source_storage_path;
  if (typeof video.raw_data?.source_storage_path === "string" && video.raw_data.source_storage_path.length > 0) return video.raw_data.source_storage_path;
  return video.storage_path;
}

async function downloadFile(bucket, storagePath, outputPath) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Storage download failed.");
  const bytes = Buffer.from(await data.arrayBuffer());
  await writeFile(outputPath, bytes);
}

async function uploadFile(bucket, storagePath, inputPath, contentType) {
  const bytes = await readFile(inputPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

async function saveTranscript(videoId, transcript) {
  const { data, error } = await supabase
    .from("transcripts")
    .insert({
      video_id: videoId,
      status: "ready",
      language: transcript.language ?? null,
      text: transcript.text ?? null,
      full_text: transcript.text ?? null,
      segments_json: {
        segments: transcript.segments ?? [],
        words: transcript.words ?? []
      },
      raw_data: transcript
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function saveTranscriptSegments(videoId, transcriptId, segments) {
  if (segments.length === 0) throw new Error("Transcription returned no usable transcript segments.");
  const { error } = await supabase.from("transcript_segments").insert(
    segments.map((segment) => ({
      video_id: videoId,
      transcript_id: transcriptId,
      segment_index: segment.segment_index,
      start_time: segment.start_time,
      end_time: segment.end_time,
      text: segment.text,
      status: "ready"
    }))
  );
  if (error) throw new Error(error.message);
}

async function saveClipIdeas(videoId, ideas) {
  const { error: deleteError } = await supabase.from("clip_ideas").delete().eq("video_id", videoId);
  if (deleteError) throw new Error(deleteError.message);
  if (ideas.length === 0) return;
  const { error } = await supabase.from("clip_ideas").insert(ideas.map((idea) => clipIdeaInsertPayload(videoId, idea, "stream_scan_worker")));
  if (error) throw new Error(error.message);
}

async function transcribeAudio(audioPath) {
  const form = new FormData();
  const audioBytes = await readFile(audioPath);
  form.append("file", new Blob([audioBytes], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("timestamp_granularities[]", "word");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI transcription failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return JSON.parse(body);
}

async function analyzeTranscriptSegment(segment) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are Claipper's Moment Finder v3 producer for Czech and Slovak short-form clips. Return only structured JSON and favor recall: find 3-5 genuine moments per segment when available, not summaries. Never invent a quote. Every hook and timestamp must overlap words present in the supplied transcript. A cold-open interval must be 1-3 seconds and remain inside the candidate interval. Use natural when no self-contained cold open exists. Keep title, hook, caption and recut_suggestion in Czech or Slovak to match the transcript. Prefer emotion, conflict, strong opinion, surprise, funny reactions, tension, a clear payoff and a scroll-stopping first sentence. Penalize generic gratitude, calm explanations, intros, outros and context-heavy moments."
      },
      {
        role: "user",
        content: [
          `Segment index: ${segment.segment_index}`,
          `Segment time: ${secondsToTimestamp(segment.start_time)}-${secondsToTimestamp(segment.end_time)}`,
          "Choose start_time close to the first strong line/reaction. Do not include generic setup unless it is required. Choose end_time after a clear payoff, laugh, answer, reversal or punchline; never end mid-thought.",
          "Return JSON as {\"candidates\":[{\"title\":\"CZ/SK string\",\"start_time\":\"HH:MM:SS\",\"end_time\":\"HH:MM:SS\",\"score\":0-100,\"reason\":\"why this can stop the scroll\",\"hook\":\"exact grounded CZ/SK hook\",\"caption\":\"CZ/SK social caption\",\"difficulty\":\"easy|medium|hard\",\"clip_type\":\"funny|reaction|opinion|educational|hype|story|other\",\"attention_score\":0-100,\"emotion_spike\":0-100,\"hook_strength\":0-100,\"payoff_score\":0-100,\"context_needed\":0-100,\"retention_risk\":0-100,\"edit_difficulty\":0-100,\"recommendation\":\"export|needs_recut|maybe|skip\",\"recut_suggestion\":\"CZ/SK note or empty string\",\"source_quote\":\"exact transcript quote\",\"hook_mode\":\"natural|cold_open\",\"hook_start_time\":\"HH:MM:SS or omitted\",\"hook_end_time\":\"HH:MM:SS or omitted\"}]}. Keep each candidate 20-60 seconds.",
          "Transcript:",
          segment.text
        ].join("\n\n")
      }
    ],
    temperature: 0.35,
    max_tokens: 1200
  });
  return parseCandidatesJson(completion.choices[0]?.message.content ?? "");
}

async function rankCandidatesWithAi(candidates) {
  const locallyRanked = rankClipCandidates(candidates, 8);
  if (locallyRanked.length <= 1 || !openai) return locallyRanked;
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Rank and deduplicate Claipper Moment Finder v3 candidates. Return only structured JSON. Keep the strongest 5-10 non-skip CZ/SK moments when available. Never invent a quote. Every hook and timestamp must overlap words present in the supplied transcript. A cold-open interval must be 1-3 seconds and remain inside the candidate interval. Use natural when no self-contained cold open exists. Prefer low context_needed, low retention_risk, strong first seconds and a clear payoff."
      },
      {
        role: "user",
        content: `Return JSON as {"candidates":[...same candidate objects...]}. Candidates:\n${JSON.stringify(locallyRanked, null, 2)}`
      }
    ],
    temperature: 0.2,
    max_tokens: 3000
  });
  const aiRanked = parseCandidatesJson(completion.choices[0]?.message.content ?? "");
  const rankedAi = aiRanked.length > 0 ? rankClipCandidates(aiRanked, 8) : [];
  if (rankedAi.length >= Math.min(3, locallyRanked.length)) return rankedAi;
  return locallyRanked;
}

async function verifyCandidateTiming(candidate, transcriptItems, transcriptWords = []) {
  const fallback = { ...candidate, hook_mode: "natural", hook_start_time: null, hook_end_time: null };
  const context = transcriptItems.filter(
    (item) => item.end > candidate.start_time - 20 && item.start < candidate.end_time + 20
  );
  if (context.length === 0) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Verify one CZ/SK short-form moment against transcript timing. Never invent a quote. Return only JSON. Start and end must land on supplied transcript segments, keep the clip 20-60 seconds, and never cut a complete thought. A cold-open must be a self-contained 1-3 second interval inside the clip; otherwise use natural."
        },
        {
          role: "user",
          content: [
            `Candidate: ${JSON.stringify(candidate)}`,
            'Return {"start_seconds":120,"end_seconds":158,"hook_mode":"natural|cold_open","hook_start_seconds":null,"hook_end_seconds":null,"reason":"grounded timing reason"}.',
            `Transcript context: ${JSON.stringify(context)}`
          ].join("\n\n")
        }
      ],
      temperature: 0,
      max_tokens: 300
    });
    const value = JSON.parse(completion.choices[0]?.message.content ?? "{}");
    const start = nearestTranscriptBoundary(Number(value.start_seconds), context.map((item) => item.start));
    const end = nearestTranscriptBoundary(Number(value.end_seconds), context.map((item) => item.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 20 || end - start > 60) return fallback;

    const hook = normalizeVerifiedHookBounds(value, start, end, transcriptWords);
    const grounded = groundVerifiedCandidate({
      ...candidate,
      start_time: start,
      end_time: end,
      ...hook
    }, transcriptItems);
    return groundColdOpenHook(grounded, transcriptWords);
  } catch {
    return fallback;
  }
}

function nearestTranscriptBoundary(value, boundaries) {
  if (!Number.isFinite(value) || boundaries.length === 0) return Number.NaN;
  return boundaries.reduce((nearest, boundary) =>
    Math.abs(boundary - value) < Math.abs(nearest - value) ? boundary : nearest
  );
}

function toTranscriptItems(transcript) {
  const segments = transcript.segments ?? [];
  if (segments.length > 0) {
    return segments
      .map((segment) => ({
        start: Math.max(0, Math.floor(segment.start ?? 0)),
        end: Math.max(0, Math.ceil(segment.end ?? segment.start ?? 0)),
        text: String(segment.text ?? "").trim()
      }))
      .filter((segment) => segment.text.length > 0 && segment.end > segment.start);
  }
  const text = String(transcript.text ?? "").trim();
  return text ? [{ start: 0, end: 600, text }] : [];
}

function toTranscriptWords(transcript) {
  return (transcript.words ?? [])
    .map((word) => ({
      start: Number(word.start ?? 0),
      end: Number(word.end ?? word.start ?? 0),
      text: String(word.word ?? word.text ?? "").trim()
    }))
    .filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start && word.text.length > 0);
}

function buildOverlappingTranscriptSegments(items, windowSeconds = 600, overlapSeconds = 120) {
  if (items.length === 0) return [];
  if (windowSeconds <= 0 || overlapSeconds < 0 || overlapSeconds >= windowSeconds) {
    throw new Error("Transcript window must be positive and larger than its overlap.");
  }
  const segments = [];
  const finalEnd = Math.max(...items.map((item) => item.end));
  const step = windowSeconds - overlapSeconds;
  for (let windowStart = 0; windowStart < finalEnd; windowStart += step) {
    const selected = items.filter((item) => item.end > windowStart && item.start < windowStart + windowSeconds);
    if (selected.length > 0) segments.push(toSegment(segments.length, selected));
  }
  return segments;
}

function toSegment(segmentIndex, items) {
  return {
    segment_index: segmentIndex,
    start_time: items[0].start,
    end_time: items[items.length - 1].end,
    text: items.map((item) => item.text.trim()).filter(Boolean).join(" ")
  };
}

function parseCandidatesJson(content) {
  try {
    const parsed = JSON.parse(content);
    const values = Array.isArray(parsed) ? parsed : parsed.candidates;
    if (!Array.isArray(values)) return [];
    return values.map(normalizeClipCandidate).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeClipCandidate(value) {
  const difficulty = CLIP_DIFFICULTIES.includes(value?.difficulty) ? value.difficulty : null;
  const clipType = CLIP_TYPES.includes(value?.clip_type) ? value.clip_type : null;
  const start = parseTimestampToSeconds(String(value?.start_time ?? ""));
  const end = parseTimestampToSeconds(String(value?.end_time ?? ""));
  if (!difficulty || !clipType || end <= start) return null;
  const score = normalizeScore(value.score, 0);
  const hook = normalizeHookBounds(value, start, end);
  return {
    title: String(value.title ?? "").slice(0, 180) || "Untitled clip idea",
    start_time: start,
    end_time: end,
    score,
    reason: String(value.reason ?? ""),
    hook: String(value.hook ?? ""),
    caption: String(value.caption ?? ""),
    difficulty,
    clip_type: clipType,
    attention_score: normalizeScore(value.attention_score, score),
    emotion_spike: normalizeScore(value.emotion_spike, 50),
    hook_strength: normalizeScore(value.hook_strength, score),
    payoff_score: normalizeScore(value.payoff_score, 50),
    context_needed: normalizeScore(value.context_needed, 50),
    retention_risk: normalizeScore(value.retention_risk, 50),
    edit_difficulty: normalizeScore(value.edit_difficulty, 50),
    recommendation: CLIP_RECOMMENDATIONS.includes(value?.recommendation) ? value.recommendation : "maybe",
    recut_suggestion: String(value.recut_suggestion ?? "").trim(),
    source_quote: String(value.source_quote ?? "").trim(),
    ...hook
  };
}

function rankClipCandidates(candidates, limit = 20) {
  const eligible = candidates
    .filter((candidate) => {
      const duration = candidate.end_time - candidate.start_time;
      return duration >= READY_CLIP_MIN_SECONDS && duration <= READY_CLIP_MAX_SECONDS && candidate.recommendation !== "skip";
    });
  return dedupeClipCandidates(eligible)
    .slice(0, limit);
}

function dedupeClipCandidates(candidates, threshold = 0.7) {
  return [...candidates]
    .sort((first, second) => v3MomentScore(second) - v3MomentScore(first))
    .filter((candidate, index, ranked) =>
      ranked.slice(0, index).every((kept) => overlapRatio(candidate, kept) < threshold)
    );
}

function clipIdeaInsertPayload(videoId, idea, source) {
  return {
    video_id: videoId,
    title: idea.title,
    start_time: idea.start_time,
    end_time: idea.end_time,
    score: idea.score,
    reason: idea.reason,
    hook: idea.hook,
    caption: idea.caption,
    difficulty: idea.difficulty,
    clip_type: idea.clip_type,
    status: "idea",
    raw_data: {
      source,
      moment_finder_version: MOMENT_FINDER_VERSION,
      moment_v3: {
        attention_score: idea.attention_score,
        emotion_spike: idea.emotion_spike,
        hook_strength: idea.hook_strength,
        payoff_score: idea.payoff_score,
        context_needed: idea.context_needed,
        retention_risk: idea.retention_risk,
        edit_difficulty: idea.edit_difficulty,
        recommendation: idea.recommendation,
        recut_suggestion: idea.recut_suggestion,
        source_quote: idea.source_quote,
        hook_mode: idea.hook_mode ?? "natural",
        hook_start_seconds: idea.hook_start_time ?? null,
        hook_end_seconds: idea.hook_end_time ?? null
      }
    }
  };
}

function extractSourceQuote(items, startTime, endTime) {
  return items
    .filter((item) => item.end > startTime && item.start < endTime)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function groundClipCandidate(candidate, items) {
  const selectedQuote = extractSourceQuote(items, candidate.start_time, candidate.end_time);
  if (metadataMatchesQuote(candidate, selectedQuote)) {
    return { ...candidate, source_quote: selectedQuote };
  }

  const nearbyRange = findBestQuoteRange(candidate, items);
  if (nearbyRange) {
    const movedQuote = extractSourceQuote(items, nearbyRange.start, nearbyRange.end);
    if (metadataMatchesQuote(candidate, movedQuote)) {
      return { ...candidate, start_time: nearbyRange.start, end_time: nearbyRange.end, source_quote: movedQuote };
    }
  }

  const fallbackQuote = selectedQuote || candidate.hook;
  const groundedText = fallbackQuote.slice(0, 180);
  return {
    ...candidate,
    title: titleFromQuote(fallbackQuote),
    reason: "Selected timestamp was grounded to the overlapping transcript text.",
    hook: groundedText,
    caption: groundedText,
    recommendation: candidate.recommendation === "skip" ? "skip" : "maybe",
    recut_suggestion: fallbackQuote ? "Metadata was rewritten to match the selected timestamp." : candidate.recut_suggestion,
    source_quote: fallbackQuote
  };
}

function groundVerifiedCandidate(candidate, items) {
  const sourceQuote = extractSourceQuote(items, candidate.start_time, candidate.end_time) || candidate.source_quote;
  if (metadataMatchesQuote(candidate, sourceQuote)) {
    return { ...candidate, source_quote: sourceQuote };
  }

  const groundedText = sourceQuote.slice(0, 180);
  return {
    ...candidate,
    title: titleFromQuote(sourceQuote),
    reason: "Verified timing was grounded to the overlapping transcript text.",
    hook: groundedText,
    caption: groundedText,
    recommendation: candidate.recommendation === "export" ? "maybe" : candidate.recommendation,
    recut_suggestion: sourceQuote ? "Metadata was rewritten to match the verified timestamp." : candidate.recut_suggestion,
    source_quote: sourceQuote
  };
}

function refineFinalMomentTiming(candidate, items) {
  if (candidate.recommendation === "skip") return candidate;

  const selectedItems = items.filter((item) => item.end > candidate.start_time && item.start < candidate.end_time);
  if (selectedItems.length === 0) {
    return { ...candidate, source_quote: extractSourceQuote(items, candidate.start_time, candidate.end_time) || candidate.source_quote };
  }

  const metadataTokenSet = new Set(contentTokens([candidate.title, candidate.hook, candidate.caption].join(" ")));
  const minimumDuration = isVeryStrongMoment(candidate) ? 12 : READY_CLIP_MIN_SECONDS;
  let startIndex = findFirstStrongItemIndex(selectedItems, metadataTokenSet);
  let endIndex = selectedItems.length - 1;

  while (
    endIndex > startIndex &&
    isBoringTrailingText(selectedItems[endIndex].text) &&
    selectedItems[endIndex - 1].end - selectedItems[startIndex].start >= minimumDuration
  ) {
    endIndex -= 1;
  }

  if (selectedItems[endIndex].end - selectedItems[startIndex].start < minimumDuration) {
    for (let index = startIndex - 1; index >= 0; index -= 1) {
      startIndex = index;
      if (selectedItems[endIndex].end - selectedItems[startIndex].start >= minimumDuration) break;
    }
  }

  if (selectedItems[endIndex].end - selectedItems[startIndex].start > 45) {
    endIndex = findNaturalEndIndex(selectedItems, startIndex, endIndex, minimumDuration, 45);
  }

  const start = selectedItems[startIndex].start;
  const end = selectedItems[endIndex].end;
  const sourceQuote = extractSourceQuote(items, start, end) || candidate.source_quote;
  const refined = { ...candidate, start_time: start, end_time: end, source_quote: sourceQuote };

  if (metadataMatchesQuote(refined, sourceQuote)) return refined;

  const groundedText = sourceQuote.slice(0, 180);
  return {
    ...refined,
    title: titleFromQuote(sourceQuote),
    reason: "Final trim was grounded to the selected transcript text.",
    hook: groundedText,
    caption: groundedText,
    recommendation: candidate.recommendation === "export" ? "maybe" : candidate.recommendation,
    recut_suggestion: sourceQuote ? "Metadata was rewritten to match the final trimmed timestamp." : candidate.recut_suggestion
  };
}

function metadataMatchesQuote(candidate, quote) {
  const metadataTokens = contentTokens([candidate.title, candidate.hook, candidate.caption].join(" "));
  if (metadataTokens.length === 0) return Boolean(String(quote ?? "").trim());
  const quoteTokens = new Set(contentTokens(quote));
  const matches = metadataTokens.filter((token) => quoteTokens.has(token)).length;
  return matches >= Math.min(2, metadataTokens.length);
}

function findBestQuoteRange(candidate, items) {
  const metadataTokens = contentTokens([candidate.title, candidate.hook, candidate.caption].join(" "));
  if (metadataTokens.length === 0) return null;

  let best = null;
  for (const [index, item] of items.entries()) {
    const quoteTokens = new Set(contentTokens(item.text));
    const score = metadataTokens.filter((token) => quoteTokens.has(token)).length;
    if (score > 0 && (!best || score > best.score)) best = { index, score };
  }
  if (!best) return null;

  const start = items[best.index].start;
  let end = items[best.index].end;
  for (let index = best.index + 1; index < items.length && end - start < 20; index += 1) {
    if (items[index].start - end > 5) break;
    end = items[index].end;
  }
  return { start, end };
}

function findFirstStrongItemIndex(items, metadataTokens) {
  let firstNonBoring = 0;
  for (const [index, item] of items.entries()) {
    if (index === firstNonBoring && isBoringLeadText(item.text)) firstNonBoring = index + 1;
    if (isBoringLeadText(item.text)) continue;

    const itemTokens = contentTokens(item.text);
    const metadataMatches = itemTokens.filter((token) => metadataTokens.has(token)).length;
    if (metadataMatches >= Math.min(2, metadataTokens.size || 2)) return index;
    if (itemStrengthScore(item.text) >= 2) return index;
  }
  return Math.min(firstNonBoring, items.length - 1);
}

function findNaturalEndIndex(items, startIndex, currentEndIndex, minimumDuration, targetMaxDuration) {
  const start = items[startIndex].start;
  let fallback = currentEndIndex;
  let bestPayoff = -1;

  for (let index = startIndex; index <= currentEndIndex; index += 1) {
    const duration = items[index].end - start;
    if (duration < minimumDuration) continue;
    if (duration > targetMaxDuration) break;
    fallback = index;
    if (itemStrengthScore(items[index].text) >= 2 || endsCompleteThought(items[index].text)) bestPayoff = index;
  }

  if (bestPayoff >= startIndex) return bestPayoff;
  return fallback;
}

function isVeryStrongMoment(candidate) {
  return candidate.score >= 90 || (candidate.attention_score >= 90 && candidate.hook_strength >= 85 && candidate.payoff_score >= 80);
}

function itemStrengthScore(text) {
  const normalized = normalizeText(text);
  let score = /[!?]/.test(text) ? 1 : 0;
  if (hasAnyPhrase(normalized, strongPhrases)) score += 2;
  if (endsCompleteThought(text)) score += 1;
  return score;
}

function isBoringLeadText(text) {
  const normalized = normalizeText(text);
  return hasAnyPhrase(normalized, boringLeadPhrases);
}

function isBoringTrailingText(text) {
  const normalized = normalizeText(text);
  return hasAnyPhrase(normalized, boringTrailingPhrases);
}

function endsCompleteThought(text) {
  return /[.!?]["')\]]?\s*$/.test(String(text ?? "").trim());
}

function hasAnyPhrase(value, phrases) {
  return phrases.some((phrase) => value.includes(phrase));
}

function titleFromQuote(quote) {
  const compact = String(quote ?? "").replace(/\s+/g, " ").trim();
  if (!compact) return "Grounded moment";
  const sentence = compact.split(/[.!?]/)[0]?.trim() || compact;
  return sentence.slice(0, 80);
}

function contentTokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const stopWords = new Set([
  "toto",
  "tato",
  "tento",
  "kedy",
  "ked",
  "potom",
  "este",
  "bolo",
  "bude",
  "som",
  "sme",
  "ste",
  "they",
  "this",
  "that",
  "with",
  "from",
  "about",
  "when",
  "then"
]);

const boringLeadPhrases = [
  "ahoj",
  "ahojte",
  "vitajte",
  "dobry den",
  "dnes sa budeme",
  "dnes si povieme",
  "v tomto videu",
  "na zaciatok",
  "najprv len",
  "najskor len",
  "rychly kontext",
  "este predtym",
  "podme sa",
  "welcome",
  "thanks for joining",
  "today we are",
  "in this video",
  "before we start",
  "first a quick context",
  "quick context"
];

const boringTrailingPhrases = [
  "dakujem",
  "vdaka za pozornost",
  "odoberajte",
  "subscribe",
  "like",
  "komentar",
  "to je vsetko",
  "see you",
  "thanks for watching",
  "thank you"
];

const strongPhrases = [
  "povedal",
  "povedala",
  "nikdy",
  "problem",
  "konflikt",
  "ticho",
  "smial",
  "smiali",
  "smiech",
  "absurd",
  "pravda",
  "reakcia",
  "never",
  "problem",
  "conflict",
  "silence",
  "laughed",
  "laughing",
  "truth",
  "reaction"
];

function normalizeScore(value, fallback) {
  return Math.max(0, Math.min(100, Math.round(Number(value ?? fallback))));
}

function v3MomentScore(candidate) {
  const signal =
    candidate.attention_score * 0.26 +
    candidate.emotion_spike * 0.18 +
    candidate.hook_strength * 0.2 +
    candidate.payoff_score * 0.18 +
    candidate.score * 0.12;
  const penalty = candidate.context_needed * 0.14 + candidate.retention_risk * 0.18 + candidate.edit_difficulty * 0.06;
  const recommendationBoost = candidate.recommendation === "export" ? 8 : candidate.recommendation === "needs_recut" ? -3 : 0;
  return signal - penalty + recommendationBoost;
}

function overlapRatio(first, second) {
  const intersection = Math.max(0, Math.min(first.end_time, second.end_time) - Math.max(first.start_time, second.start_time));
  const shorterDuration = Math.min(first.end_time - first.start_time, second.end_time - second.start_time);
  return shorterDuration > 0 ? intersection / shorterDuration : 0;
}

function normalizeHookBounds(value, candidateStart, candidateEnd) {
  if (value?.hook_mode !== "cold_open") {
    return { hook_mode: "natural", hook_start_time: null, hook_end_time: null };
  }
  return normalizeNumericHookBounds(
    {
      hook_mode: value.hook_mode,
      hook_start_seconds: parseTimestampToSeconds(String(value.hook_start_time ?? "")),
      hook_end_seconds: parseTimestampToSeconds(String(value.hook_end_time ?? ""))
    },
    candidateStart,
    candidateEnd
  );
}

function normalizeNumericHookBounds(value, candidateStart, candidateEnd) {
  const hookStart = Number(value?.hook_start_seconds);
  const hookEnd = Number(value?.hook_end_seconds);
  const duration = hookEnd - hookStart;
  if (
    value?.hook_mode !== "cold_open" ||
    !Number.isFinite(hookStart) ||
    !Number.isFinite(hookEnd) ||
    hookStart < candidateStart ||
    hookEnd > candidateEnd ||
    duration < 1 ||
    duration > 3
  ) {
    return { hook_mode: "natural", hook_start_time: null, hook_end_time: null };
  }
  return { hook_mode: "cold_open", hook_start_time: hookStart, hook_end_time: hookEnd };
}

function normalizeVerifiedHookBounds(value, candidateStart, candidateEnd, transcriptWords) {
  const numeric = normalizeNumericHookBounds(value, candidateStart, candidateEnd);
  if (numeric.hook_mode !== "cold_open") return numeric;

  const overlappingWords = transcriptWords.filter(
    (word) => word.end > numeric.hook_start_time && word.start < numeric.hook_end_time &&
      word.end > candidateStart && word.start < candidateEnd
  );
  if (overlappingWords.length === 0) {
    return { hook_mode: "natural", hook_start_time: null, hook_end_time: null };
  }

  const hookStart = Math.max(candidateStart, overlappingWords[0].start);
  const hookEnd = Math.min(candidateEnd, overlappingWords.at(-1).end);
  const duration = hookEnd - hookStart;
  if (duration < 1 || duration > 3) {
    return { hook_mode: "natural", hook_start_time: null, hook_end_time: null };
  }
  return { hook_mode: "cold_open", hook_start_time: hookStart, hook_end_time: hookEnd };
}

function parseTimestampToSeconds(timestamp) {
  const parts = timestamp.split(":").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) return 0;
  const [hours, minutes, seconds] = parts;
  if (minutes > 59 || seconds > 59) return 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function secondsToTimestamp(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function cleanError(error) {
  return error instanceof Error ? error.message : "Unknown worker failure.";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startupChecks() {
  const [ffmpeg, ffprobe, ytdlp, supabaseConnected] = await Promise.all([
    checkBinaryAvailability(ffmpegBinary, ["-version"]),
    checkBinaryAvailability(ffprobeBinary, ["-version"]),
    checkYtDlpRuntime(),
    checkSupabaseConnection()
  ]);

  console.log(
    formatStartupReport({
      workerId,
      supabaseConnected,
      openAiPresent: Boolean(process.env.OPENAI_API_KEY),
      ffmpeg,
      ffprobe,
      ytdlp,
      buckets,
      pollIntervalMs,
      environment: process.env.NODE_ENV ?? "development"
    })
  );

  const missingRuntime = [];
  if (!supabaseConnected) missingRuntime.push("Supabase connection failed");
  if (!ffmpeg.ok) missingRuntime.push(`FFmpeg unavailable at ${ffmpeg.binary}`);
  if (!ffprobe.ok) missingRuntime.push(`FFprobe unavailable at ${ffprobe.binary}`);
  if (!ytdlp.ok) missingRuntime.push(`yt-dlp unavailable at ${ytdlp.binary}`);
  else if (!ytdlp.chromeTarget) missingRuntime.push("yt-dlp Chrome impersonation unavailable");
  if (missingRuntime.length > 0) {
    throw new Error(`Worker startup checks failed:\n${missingRuntime.join("\n")}`);
  }
}

async function checkYtDlpRuntime() {
  try {
    const [{ stdout: versionOutput }, { stdout: targetsOutput }] = await Promise.all([
      execFileAsync(ytDlpBinary, ["--version"]),
      execFileAsync(ytDlpBinary, ["--list-impersonate-targets"])
    ]);
    return {
      ok: true,
      binary: ytDlpBinary,
      version: versionOutput.trim(),
      chromeTarget: findAvailableChromeImpersonationTarget(targetsOutput)
    };
  } catch (error) {
    return { ok: false, binary: ytDlpBinary, error: cleanError(error), version: null, chromeTarget: null };
  }
}

async function checkSupabaseConnection() {
  const { error } = await supabase.from("processing_jobs").select("id").limit(1);
  return !error;
}

async function updateHeartbeat(status, currentJobId, currentStep) {
  const now = new Date().toISOString();
  if (currentJobId) {
    try {
      if (!(await refreshJobLease(currentJobId))) {
        console.error(`[claipper-worker] job lease lost for ${currentJobId}`);
      }
    } catch (leaseError) {
      console.error("[claipper-worker] job lease refresh failed", cleanError(leaseError));
    }
  }
  const { error } = await supabase.from("worker_heartbeats").upsert(
    {
      worker_id: workerId,
      status,
      last_seen_at: now,
      current_job_id: currentJobId,
      current_step: currentStep,
      metadata_json: {
        ffmpeg: ffmpegBinary,
        ffprobe: ffprobeBinary,
        ytdlp: ytDlpBinary,
        poll_interval_ms: pollIntervalMs,
        environment: process.env.NODE_ENV ?? "development"
      },
      updated_at: now
    },
    { onConflict: "worker_id" }
  );

  if (error) {
    console.error("[claipper-worker] heartbeat update failed", error.message);
  }
}

async function shutdown(heartbeatTimer) {
  clearInterval(heartbeatTimer);
  await updateHeartbeat("offline", null, "shutdown");
  process.exit(0);
}
