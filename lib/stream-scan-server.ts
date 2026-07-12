import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOverlappingTranscriptSegments,
  clipIdeaInsertPayload,
  groundClipCandidate,
  normalizeClipCandidates,
  rankClipCandidates,
  refineFinalMomentTiming,
  secondsToTimestamp,
  type NormalizedClipCandidate,
  type TranscriptItem,
  type VideoStatus
} from "@/lib/stream-scan";

const execFileAsync = promisify(execFile);

export const streamScanRoot =
  process.env.STREAM_SCAN_STORAGE_DIR ??
  (process.env.VERCEL ? path.join("/tmp", "claipper-stream-scan") : path.join(process.cwd(), "storage", "stream-scan"));
const ffmpegBinary = process.env.FFMPEG_PATH ?? "ffmpeg";
const ytDlpBinary = process.env.YTDLP_PATH ?? "yt-dlp";

type VerboseTranscript = {
  text?: string;
  language?: string;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
  }>;
  words?: Array<{ start?: number; end?: number; word?: string; text?: string }>;
};

export async function ensureStreamScanFolders() {
  await Promise.all([
    mkdir(path.join(streamScanRoot, "videos"), { recursive: true }),
    mkdir(path.join(streamScanRoot, "audio"), { recursive: true }),
    mkdir(path.join(streamScanRoot, "drafts"), { recursive: true })
  ]);
}

export async function saveUploadedVideo(file: File, id: string) {
  await ensureStreamScanFolders();
  const extension = safeExtension(file.name) || ".mp4";
  const filePath = path.join(streamScanRoot, "videos", `${id}${extension}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes);
  return filePath;
}

export async function saveVideoBuffer(bytes: Buffer, id: string, filename: string) {
  await ensureStreamScanFolders();
  const extension = safeExtension(filename) || ".mp4";
  const filePath = path.join(streamScanRoot, "videos", `${id}${extension}`);
  await writeFile(filePath, bytes);
  return filePath;
}

export async function downloadPlatformVideo(contentUrl: string, id: string) {
  await ensureStreamScanFolders();
  const outputTemplate = path.join(streamScanRoot, "videos", `${id}.%(ext)s`);

  try {
    const { stdout } = await execFileAsync(
      ytDlpBinary,
      [
      contentUrl,
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
      ]
    );

    const filePath = stdout.trim().split("\n").filter(Boolean).at(-1);
    if (!filePath) {
      throw new Error("Downloader finished without returning a video file path.");
    }
    const fileStats = await stat(filePath);

    return {
      filePath,
      filename: path.basename(filePath),
      mimeType: "video/mp4",
      sizeBytes: fileStats.size
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown downloader error.";
    throw new Error(`Could not download that platform link. Upload the video file directly or configure YTDLP_PATH for a custom downloader. Details: ${message}`);
  }
}

export async function runStreamScanPipeline(supabase: SupabaseClient, videoId: string) {
  const { data: video, error } = await supabase.from("videos").select("*").eq("id", videoId).single();
  if (error || !video) throw new Error(error?.message ?? "Video not found.");

  const jobId = await createProcessingJob(supabase, videoId, "stream_scan");

  try {
    await setVideoStatus(supabase, videoId, "extracting_audio", "Extracting audio with FFmpeg.");
    await updateJob(supabase, jobId, "running", "extracting_audio");
    const audioPath = await extractAudio(video.file_path, videoId);
    await supabase.from("videos").update({ audio_path: audioPath }).eq("id", videoId);

    await setVideoStatus(supabase, videoId, "transcribing", "Transcribing audio with timestamps.");
    await updateJob(supabase, jobId, "running", "transcribing");
    const transcript = await transcribeAudio(audioPath);
    const transcriptId = await saveTranscript(supabase, videoId, transcript);

    await setVideoStatus(supabase, videoId, "segmenting", "Splitting transcript into reviewable chunks.");
    await updateJob(supabase, jobId, "running", "segmenting");
    const transcriptItems = toTranscriptItems(transcript);
    const segments = buildOverlappingTranscriptSegments(transcriptItems, 600, 120);
    await saveTranscriptSegments(supabase, videoId, transcriptId, segments);

    await setVideoStatus(supabase, videoId, "analyzing", "Analyzing transcript chunks for clip candidates.");
    await updateJob(supabase, jobId, "running", "analyzing");
    const candidates: NormalizedClipCandidate[] = [];
    for (const segment of segments) {
      candidates.push(...(await analyzeTranscriptSegment(segment)));
    }

    await setVideoStatus(supabase, videoId, "ranking", "Ranking the strongest moments.");
    await updateJob(supabase, jobId, "running", "ranking");
    const ranked = await rankCandidatesWithAi(candidates);
    const grounded = ranked.map((candidate) => groundClipCandidate(candidate, transcriptItems));
    const refined = grounded.map((candidate) => refineFinalMomentTiming(candidate, transcriptItems));
    const verified = [];
    for (const candidate of refined) verified.push(await verifyCandidateTiming(candidate, transcriptItems));
    await saveClipIdeas(supabase, videoId, verified);

    await setVideoStatus(supabase, videoId, "ready", `Ready with ${verified.length} ranked clip ideas.`);
    await updateJob(supabase, jobId, "completed", "ready");
    return { ideas: verified.length };
  } catch (pipelineError) {
    const message = pipelineError instanceof Error ? pipelineError.message : "Unknown stream scan failure.";
    await setVideoStatus(supabase, videoId, "failed", "Processing failed.", message);
    await updateJob(supabase, jobId, "failed", "failed", message);
    throw pipelineError;
  }
}

export async function generateDraftClip(supabase: SupabaseClient, clipIdeaId: string) {
  const { data: idea, error: ideaError } = await supabase.from("clip_ideas").select("*").eq("id", clipIdeaId).single();
  if (ideaError || !idea) throw new Error(ideaError?.message ?? "Clip idea not found.");

  const { data: video, error: videoError } = await supabase.from("videos").select("*").eq("id", idea.video_id).single();
  if (videoError || !video) throw new Error(videoError?.message ?? "Video not found.");

  await ensureStreamScanFolders();
  const outputPath = path.join(streamScanRoot, "drafts", `${clipIdeaId}.mp4`);
  const duration = Math.max(1, idea.end_time - idea.start_time);

  try {
    await execFileAsync(ffmpegBinary, [
      "-y",
      "-ss",
      String(idea.start_time),
      "-i",
      video.file_path,
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
      String(idea.start_time),
      "-i",
      video.file_path,
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

  const insertPayload = {
    video_id: idea.video_id,
    clip_idea_id: idea.id,
    title: idea.title,
    start_seconds: idea.start_time,
    end_seconds: idea.end_time,
    duration_seconds: duration,
    hook: idea.hook,
    caption: idea.caption,
    content_type: idea.clip_type,
    score: idea.score,
    status: "selected",
    file_path: outputPath,
    exported_video_url: `/api/stream-scan/files/drafts/${clipIdeaId}.mp4`,
    notes: idea.reason,
    raw_data: { source: "stream_scan_mvp" }
  };

  const { data: clip, error } = await supabase.from("clips").insert(insertPayload).select("*").single();
  if (error) throw new Error(error.message);

  await supabase.from("clip_ideas").update({ status: "drafted" }).eq("id", idea.id);
  return clip;
}

async function extractAudio(videoPath: string, videoId: string) {
  await ensureStreamScanFolders();
  const audioPath = path.join(streamScanRoot, "audio", `${videoId}.mp3`);

  await execFileAsync(ffmpegBinary, [
    "-y",
    "-i",
    videoPath,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-ar",
    "16000",
    "-ac",
    "1",
    audioPath
  ]);

  return audioPath;
}

async function transcribeAudio(audioPath: string): Promise<VerboseTranscript> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for transcription.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"]
  });

  return response as VerboseTranscript;
}

async function analyzeTranscriptSegment(segment: { segment_index: number; start_time: number; end_time: number; text: string }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for AI analysis.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are Claipper's Moment Finder v3 producer for Czech and Slovak clips. Return only structured JSON and favor recall. Never invent a quote. Every hook and timestamp must overlap words present in the supplied transcript. A cold-open interval must be 1-3 seconds and remain inside the candidate interval. Use natural when no self-contained cold open exists. Keep all editorial text in Czech or Slovak. Prefer emotion, conflict, strong opinion, surprise, funny reactions, tension and clear payoff; penalize generic intros, outros and context-heavy summaries."
      },
      {
        role: "user",
        content: [
          `Segment index: ${segment.segment_index}`,
          `Segment time: ${secondsToTimestamp(segment.start_time)}-${secondsToTimestamp(segment.end_time)}`,
          "Choose start_time close to the first strong line/reaction. Do not include generic setup unless it is required. Choose end_time after a clear payoff, laugh, answer, reversal or punchline; never end mid-thought.",
          "Return JSON as {\"candidates\":[{\"title\":\"CZ/SK string\",\"start_time\":\"HH:MM:SS\",\"end_time\":\"HH:MM:SS\",\"score\":0-100,\"reason\":\"grounded reason\",\"hook\":\"exact grounded hook\",\"caption\":\"CZ/SK caption\",\"difficulty\":\"easy|medium|hard\",\"clip_type\":\"funny|reaction|opinion|educational|hype|story|other\",\"attention_score\":0-100,\"emotion_spike\":0-100,\"hook_strength\":0-100,\"payoff_score\":0-100,\"context_needed\":0-100,\"retention_risk\":0-100,\"edit_difficulty\":0-100,\"recommendation\":\"export|needs_recut|maybe|skip\",\"recut_suggestion\":\"CZ/SK note\",\"source_quote\":\"exact transcript quote\",\"hook_mode\":\"natural|cold_open\",\"hook_start_time\":\"HH:MM:SS or omitted\",\"hook_end_time\":\"HH:MM:SS or omitted\"}]}. Keep candidates 20-60 seconds.",
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

async function rankCandidatesWithAi(candidates: NormalizedClipCandidate[]) {
  const locallyRanked = rankClipCandidates(candidates, 8);
  if (locallyRanked.length <= 1 || !process.env.OPENAI_API_KEY) return locallyRanked;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Rank and deduplicate Claipper Moment Finder v3 candidates. Return only structured JSON. Keep the strongest 5-10 non-skip CZ/SK moments when available. Never invent a quote. Every hook and timestamp must overlap supplied transcript words. Cold opens must be 1-3 seconds inside the candidate; otherwise use natural. Prefer low context_needed, low retention_risk, strong first seconds and clear payoff."
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

async function verifyCandidateTiming(
  candidate: NormalizedClipCandidate,
  transcriptItems: TranscriptItem[]
): Promise<NormalizedClipCandidate> {
  const fallback: NormalizedClipCandidate = {
    ...candidate,
    hook_mode: "natural",
    hook_start_time: null,
    hook_end_time: null
  };
  if (!process.env.OPENAI_API_KEY) return fallback;
  const context = transcriptItems.filter(
    (item) => item.end > candidate.start_time - 20 && item.start < candidate.end_time + 20
  );
  if (context.length === 0) return fallback;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Verify one CZ/SK short-form moment against transcript timing. Never invent a quote. Return only JSON. Start and end must land on supplied transcript segments and keep the clip 20-60 seconds. A cold-open must be a self-contained 1-3 second interval inside the clip; otherwise use natural."
        },
        {
          role: "user",
          content: `Candidate: ${JSON.stringify(candidate)}\nReturn {"start_seconds":120,"end_seconds":158,"hook_mode":"natural|cold_open","hook_start_seconds":null,"hook_end_seconds":null,"reason":"grounded reason"}.\nTranscript: ${JSON.stringify(context)}`
        }
      ],
      temperature: 0,
      max_tokens: 300
    });
    const value = JSON.parse(completion.choices[0]?.message.content ?? "{}") as Record<string, unknown>;
    const start = nearestBoundary(Number(value.start_seconds), context.map((item) => item.start));
    const end = nearestBoundary(Number(value.end_seconds), context.map((item) => item.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 20 || end - start > 60) return fallback;

    const hookStart = Number(value.hook_start_seconds);
    const hookEnd = Number(value.hook_end_seconds);
    const coldOpenValid =
      value.hook_mode === "cold_open" &&
      Number.isFinite(hookStart) &&
      Number.isFinite(hookEnd) &&
      hookStart >= start &&
      hookEnd <= end &&
      hookEnd - hookStart >= 1 &&
      hookEnd - hookStart <= 3;
    return {
      ...candidate,
      start_time: start,
      end_time: end,
      hook_mode: coldOpenValid ? "cold_open" : "natural",
      hook_start_time: coldOpenValid ? hookStart : null,
      hook_end_time: coldOpenValid ? hookEnd : null
    };
  } catch {
    return fallback;
  }
}

function nearestBoundary(value: number, boundaries: number[]) {
  if (!Number.isFinite(value) || boundaries.length === 0) return Number.NaN;
  return boundaries.reduce((nearest, boundary) =>
    Math.abs(boundary - value) < Math.abs(nearest - value) ? boundary : nearest
  );
}

function parseCandidatesJson(content: string) {
  try {
    const parsed = JSON.parse(content) as unknown;
    const candidates = Array.isArray(parsed) ? parsed : (parsed as { candidates?: unknown }).candidates;
    return normalizeClipCandidates(candidates);
  } catch {
    return [];
  }
}

function toTranscriptItems(transcript: VerboseTranscript): TranscriptItem[] {
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

async function saveTranscript(supabase: SupabaseClient, videoId: string, transcript: VerboseTranscript) {
  const { data, error } = await supabase
    .from("transcripts")
    .insert({
      video_id: videoId,
      status: "ready",
      language: transcript.language ?? null,
      text: transcript.text ?? null,
      segments_json: { segments: transcript.segments ?? [], words: transcript.words ?? [] },
      raw_data: transcript
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function saveTranscriptSegments(
  supabase: SupabaseClient,
  videoId: string,
  transcriptId: string,
  segments: Array<{ segment_index: number; start_time: number; end_time: number; text: string }>
) {
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

async function saveClipIdeas(supabase: SupabaseClient, videoId: string, ideas: NormalizedClipCandidate[]) {
  await supabase.from("clip_ideas").delete().eq("video_id", videoId);
  if (ideas.length === 0) return;

  const { error } = await supabase.from("clip_ideas").insert(ideas.map((idea) => clipIdeaInsertPayload(videoId, idea, "stream_scan_mvp")));
  if (error) throw new Error(error.message);
}

async function createProcessingJob(supabase: SupabaseClient, videoId: string, jobType: string) {
  const { data, error } = await supabase
    .from("processing_jobs")
    .insert({ video_id: videoId, job_type: jobType, status: "queued", step: "queued" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function updateJob(supabase: SupabaseClient, jobId: string, status: string, step: string, errorMessage?: string) {
  await supabase
    .from("processing_jobs")
    .update({ status, step, error_message: errorMessage ?? null, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function setVideoStatus(supabase: SupabaseClient, videoId: string, status: VideoStatus, progressText: string, errorMessage?: string) {
  await supabase
    .from("videos")
    .update({
      status,
      progress_text: progressText,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", videoId);
}

function safeExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return /^[a-z0-9.]+$/.test(extension) ? extension : "";
}

export async function readStreamScanFile(kind: "videos" | "audio" | "drafts", filename: string) {
  const safeFilename = path.basename(filename);
  return readFile(path.join(streamScanRoot, kind, safeFilename));
}
