import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import {
  assertValidWorkerEnv,
  checkBinaryAvailability,
  formatStartupReport,
  loadWorkerDotEnv,
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
const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS);
const ffmpegBinary = process.env.FFMPEG_PATH ?? "ffmpeg";
const ytDlpBinary = process.env.YTDLP_PATH ?? "yt-dlp";
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
      worker_id: workerId,
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

  await updateJob(job.id, "running", "downloading_source", 10);
  await updateVideo(video.id, "downloading", 10, "Downloading platform video with processing worker.");

  const { stdout } = await execFileAsync(ytDlpBinary, [
    video.source_url,
    "--no-playlist",
    "--restrict-filenames",
    "--merge-output-format",
    "mp4",
    "--print",
    "after_move:filepath",
    "--format",
    "bv*+ba/b",
    "--output",
    outputTemplate
  ]);

  const downloadedPath = stdout.trim().split("\n").filter(Boolean).at(-1);
  if (!downloadedPath) throw new Error("Downloader finished without returning a video file path.");

  const storagePath = `default/${video.id}/source${path.extname(downloadedPath).toLowerCase() || ".mp4"}`;
  await uploadFile(buckets.originals, storagePath, downloadedPath, "video/mp4");

  await supabase
    .from("videos")
    .update({
      storage_bucket: buckets.originals,
      storage_path: storagePath,
      file_path: storagePath,
      status: "queued",
      progress_percent: 25,
      progress_text: "Platform video imported. Starting analysis.",
      updated_at: new Date().toISOString()
    })
    .eq("id", video.id);

  await supabase.from("video_imports").update({ status: "completed", updated_at: new Date().toISOString() }).eq("video_id", video.id);
  await processAnalyzeVideo(job);
}

async function processAnalyzeVideo(job) {
  const video = await loadVideo(job.video_id);
  if (!video.storage_bucket || !video.storage_path) throw new Error("Video is missing Supabase Storage source path.");

  const workDir = await makeWorkDir(job.video_id);
  const sourcePath = path.join(workDir, `source${path.extname(video.storage_path) || ".mp4"}`);
  const audioPath = path.join(workDir, "audio.mp3");

  await updateJob(job.id, "running", "downloading_source", 15);
  await downloadFile(video.storage_bucket, video.storage_path, sourcePath);

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
  const segments = buildTranscriptSegments(transcriptItems, 600);
  await saveTranscriptSegments(video.id, transcriptId, segments);

  await updateJob(job.id, "running", "analyzing_segments", 75);
  await updateVideo(video.id, "analyzing", 75, "Analyzing transcript chunks for clip candidates.");
  const candidates = [];
  for (const segment of segments) {
    candidates.push(...(await analyzeTranscriptSegment(segment)));
  }

  await updateJob(job.id, "running", "ranking_candidates", 90);
  await updateVideo(video.id, "ranking", 90, "Ranking the strongest moments.");
  const ranked = await rankCandidatesWithAi(candidates);
  await updateJob(job.id, "running", "saving_clip_ideas", 95);
  await saveClipIdeas(video.id, ranked);

  await updateVideo(video.id, "ready", 100, `Ready with ${ranked.length} ranked clip ideas.`);
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
  if (!video.storage_bucket || !video.storage_path) throw new Error("Video is missing Supabase Storage source path.");

  const workDir = await makeWorkDir(video.id);
  const sourcePath = path.join(workDir, `source${path.extname(video.storage_path) || ".mp4"}`);
  const outputPath = path.join(workDir, `${clip.id}.mp4`);
  const duration = Math.max(1, Number(clip.end_seconds ?? 0) - Number(clip.start_seconds ?? 0));
  const renderLabel = ready ? "ready clip" : "draft";

  await updateJob(job.id, "running", "downloading_source", 20);
  await supabase.from("clips").update({ render_status: "running" }).eq("id", clip.id);
  await downloadFile(video.storage_bucket, video.storage_path, sourcePath);

  await updateJob(job.id, "running", ready ? "rendering_ready_clip" : "rendering_draft", 65);
  if (ready) {
    const segments = await loadTranscriptSegments(video.id, Number(clip.start_seconds ?? 0), Number(clip.end_seconds ?? 0));
    const subtitlePath = segments.length > 0 ? await buildSubtitleFile(workDir, clip, segments) : null;
    const videoFilters = buildReadyClipFilters(clip, subtitlePath);

    await execFileAsync(ffmpegBinary, [
      "-y",
      "-ss",
      String(clip.start_seconds ?? 0),
      "-i",
      sourcePath,
      "-t",
      String(duration),
      "-vf",
      videoFilters,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath
    ]);
  } else {
    try {
      await execFileAsync(ffmpegBinary, [
        "-y",
        "-ss",
        String(clip.start_seconds ?? 0),
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
        String(clip.start_seconds ?? 0),
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

  const storagePath = `${video.id}/${clip.id}.mp4`;
  await uploadFile(buckets.clips, storagePath, outputPath, "video/mp4");
  await supabase
    .from("clips")
    .update({
      storage_bucket: buckets.clips,
      storage_path: storagePath,
      file_path: storagePath,
      render_status: "completed",
      status: ready ? "ready" : clip.status,
      exported_video_url: null,
      raw_data: { ...(clip.raw_data ?? {}), render_type: ready ? "ready" : "draft", rendered_by: "railway_worker" },
      updated_at: new Date().toISOString()
    })
    .eq("id", clip.id);

  if (clip.clip_idea_id) {
    await supabase.from("clip_ideas").update({ status: ready ? "rendered" : "drafted" }).eq("id", clip.clip_idea_id);
  }
  await updateJob(job.id, "completed", `${renderLabel}_completed`, 100);
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

async function buildSubtitleFile(workDir, clip, segments) {
  const clipStart = Number(clip.start_seconds ?? 0);
  const clipEnd = Number(clip.end_seconds ?? clipStart + 1);
  const entries = segments
    .map((segment) => {
      const start = Math.max(0, Number(segment.start_time ?? 0) - clipStart);
      const end = Math.min(clipEnd - clipStart, Number(segment.end_time ?? 0) - clipStart);
      const text = normalizeSubtitleText(segment.text);
      if (!text || end <= start) return null;
      return { start, end, text };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  const srt = entries
    .map((entry, index) => [String(index + 1), `${formatSrtTime(entry.start)} --> ${formatSrtTime(entry.end)}`, entry.text].join("\n"))
    .join("\n\n");
  const subtitlePath = path.join(workDir, `${clip.id}.srt`);
  await writeFile(subtitlePath, `${srt}\n`, "utf8");
  return subtitlePath;
}

function buildReadyClipFilters(clip, subtitlePath) {
  const hookText = String(clip.hook || clip.title || "Watch this").trim().slice(0, 120);
  const filters = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    `drawtext=text='${escapeDrawtextValue(hookText)}':fontcolor=white:fontsize=56:box=1:boxcolor=black@0.58:boxborderw=24:x=(w-text_w)/2:y=h*0.12:enable='between(t,0,3)'`
  ];

  if (subtitlePath) {
    filters.push(`subtitles=filename='${escapeFilterQuotedValue(subtitlePath)}':force_style='FontName=Arial,FontSize=18,Alignment=2,MarginV=130,Outline=2,Shadow=1'`);
  }

  return filters.join(",");
}

function normalizeSubtitleText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 42 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).join("\n");
}

function formatSrtTime(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const wholeSeconds = Math.floor((milliseconds % 60000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function escapeDrawtextValue(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll("%", "\\%")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeFilterQuotedValue(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
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

  await supabase
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
    .eq("id", jobId);
}

async function failJob(job, error) {
  const technicalError = cleanError(error);
  const userError = userFriendlyWorkerError(error);
  console.error(`[claipper-worker] job ${job.id} failed`, technicalError);
  activeStep = "failed";
  await supabase
    .from("processing_jobs")
    .update({
      status: "failed",
      current_step: "failed",
      step: "failed",
      progress_percent: job.progress_percent ?? 0,
      error_message: userError,
      technical_error: technicalError,
      failed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id);
  if (job.video_id) {
    await updateVideo(job.video_id, "failed", 100, userError, technicalError);
  }
  if (job.clip_id) {
    await supabase.from("clips").update({ render_status: "failed", updated_at: new Date().toISOString() }).eq("id", job.clip_id);
  }
  await updateHeartbeat("online", null, "failed");
}

async function makeWorkDir(id) {
  const dir = path.join(os.tmpdir(), "claipper-worker", id, randomUUID());
  await mkdir(dir, { recursive: true });
  return dir;
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
      segments_json: transcript.segments ?? null,
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
  await supabase.from("clip_ideas").delete().eq("video_id", videoId);
  if (ideas.length === 0) return;
  const { error } = await supabase.from("clip_ideas").insert(
    ideas.map((idea) => ({
      video_id: videoId,
      ...idea,
      status: "idea",
      raw_data: { source: "stream_scan_worker" }
    }))
  );
  if (error) throw new Error(error.message);
}

async function transcribeAudio(audioPath) {
  const form = new FormData();
  const audioBytes = await readFile(audioPath);
  form.append("file", new Blob([audioBytes], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

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
          "You are Claipper's stream scan producer. Return only structured JSON. Find 0-3 short-form clip candidates from the transcript segment. Prefer understandable moments with strong first 3 seconds, emotion, opinion, conflict, humor, payoff, and beginner-friendly edits."
      },
      {
        role: "user",
        content: [
          `Segment index: ${segment.segment_index}`,
          `Segment time: ${secondsToTimestamp(segment.start_time)}-${secondsToTimestamp(segment.end_time)}`,
          "Return JSON as {\"candidates\":[{\"title\":\"string\",\"start_time\":\"HH:MM:SS\",\"end_time\":\"HH:MM:SS\",\"score\":0-100,\"reason\":\"why this could work as a short-form clip\",\"hook\":\"short hook text\",\"caption\":\"social caption\",\"difficulty\":\"easy|medium|hard\",\"clip_type\":\"funny|reaction|opinion|educational|hype|story|other\"}]}.",
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
  const locallyRanked = rankClipCandidates(candidates, 20);
  if (locallyRanked.length <= 1 || !openai) return locallyRanked;
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Rank Claipper clip candidates. Return only structured JSON. Keep the best 10-20 moments. Prefer clips that work without full context, start strong, have emotion/opinion/conflict/humor/payoff, are not too long, work on TikTok/Reels/Shorts, and are easy for beginner editors."
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
  return aiRanked.length > 0 ? rankClipCandidates(aiRanked, 20) : locallyRanked;
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

function buildTranscriptSegments(items, segmentLengthSeconds = 600) {
  if (items.length === 0) return [];
  const segments = [];
  let currentItems = [];
  let currentStart = Math.floor(items[0].start / segmentLengthSeconds) * segmentLengthSeconds;
  let currentEnd = currentStart + segmentLengthSeconds;

  for (const item of items) {
    if (item.start >= currentEnd && currentItems.length > 0) {
      segments.push(toSegment(segments.length, currentItems));
      currentItems = [];
      currentStart = Math.floor(item.start / segmentLengthSeconds) * segmentLengthSeconds;
      currentEnd = currentStart + segmentLengthSeconds;
    }
    currentItems.push(item);
  }
  if (currentItems.length > 0) segments.push(toSegment(segments.length, currentItems));
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
  const difficulty = ["easy", "medium", "hard"].includes(value?.difficulty) ? value.difficulty : null;
  const clipType = ["funny", "reaction", "opinion", "educational", "hype", "story", "other"].includes(value?.clip_type) ? value.clip_type : null;
  const start = parseTimestampToSeconds(String(value?.start_time ?? ""));
  const end = parseTimestampToSeconds(String(value?.end_time ?? ""));
  if (!difficulty || !clipType || end <= start) return null;
  return {
    title: String(value.title ?? "").slice(0, 180) || "Untitled clip idea",
    start_time: start,
    end_time: end,
    score: Math.max(0, Math.min(100, Math.round(Number(value.score ?? 0)))),
    reason: String(value.reason ?? ""),
    hook: String(value.hook ?? ""),
    caption: String(value.caption ?? ""),
    difficulty,
    clip_type: clipType
  };
}

function rankClipCandidates(candidates, limit = 20) {
  return [...candidates]
    .filter((candidate) => {
      const duration = candidate.end_time - candidate.start_time;
      return duration >= 10 && duration <= 180;
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, limit);
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
  const [ffmpeg, ytdlp, supabaseConnected] = await Promise.all([
    checkBinaryAvailability(ffmpegBinary, ["-version"]),
    checkBinaryAvailability(ytDlpBinary, ["--version"]),
    checkSupabaseConnection()
  ]);

  console.log(
    formatStartupReport({
      workerId,
      supabaseConnected,
      openAiPresent: Boolean(process.env.OPENAI_API_KEY),
      ffmpeg,
      ytdlp,
      buckets,
      pollIntervalMs,
      environment: process.env.NODE_ENV ?? "development"
    })
  );

  const missingRuntime = [];
  if (!supabaseConnected) missingRuntime.push("Supabase connection failed");
  if (!ffmpeg.ok) missingRuntime.push(`FFmpeg unavailable at ${ffmpeg.binary}`);
  if (!ytdlp.ok) missingRuntime.push(`yt-dlp unavailable at ${ytdlp.binary}`);
  if (missingRuntime.length > 0) {
    throw new Error(`Worker startup checks failed:\n${missingRuntime.join("\n")}`);
  }
}

async function checkSupabaseConnection() {
  const { error } = await supabase.from("processing_jobs").select("id").limit(1);
  return !error;
}

async function updateHeartbeat(status, currentJobId, currentStep) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("worker_heartbeats").upsert(
    {
      worker_id: workerId,
      status,
      last_seen_at: now,
      current_job_id: currentJobId,
      current_step: currentStep,
      metadata_json: {
        ffmpeg: ffmpegBinary,
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
