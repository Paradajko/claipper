import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import youtubeDl, { create as createYoutubeDl } from "youtube-dl-exec";
import {
  buildTranscriptSegments,
  normalizeClipCandidates,
  rankClipCandidates,
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
const platformDownloader = process.env.YTDLP_PATH ? createYoutubeDl(process.env.YTDLP_PATH) : youtubeDl;

type VerboseTranscript = {
  text?: string;
  language?: string;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
  }>;
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
    const { stdout } = await platformDownloader.exec(
      contentUrl,
      {
        noPlaylist: true,
        restrictFilenames: true,
        mergeOutputFormat: "mp4",
        print: "after_move:filepath",
        format: "bv*+ba/b",
        output: outputTemplate
      } as never
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
    const segments = buildTranscriptSegments(toTranscriptItems(transcript), 600);
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
    await saveClipIdeas(supabase, videoId, ranked);

    await setVideoStatus(supabase, videoId, "ready", `Ready with ${ranked.length} ranked clip ideas.`);
    await updateJob(supabase, jobId, "completed", "ready");
    return { ideas: ranked.length };
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
    timestamp_granularities: ["segment"]
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

async function rankCandidatesWithAi(candidates: NormalizedClipCandidate[]) {
  const locallyRanked = rankClipCandidates(candidates, 20);
  if (locallyRanked.length <= 1 || !process.env.OPENAI_API_KEY) return locallyRanked.slice(0, 20);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
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

  const { error } = await supabase.from("clip_ideas").insert(
    ideas.map((idea) => ({
      video_id: videoId,
      ...idea,
      status: "idea",
      raw_data: { source: "stream_scan_mvp" }
    }))
  );
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
