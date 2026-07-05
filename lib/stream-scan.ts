import { z } from "zod";

export const videoStatuses = [
  "uploaded",
  "extracting_audio",
  "transcribing",
  "segmenting",
  "analyzing",
  "ranking",
  "ready",
  "failed"
] as const;

export type VideoStatus = (typeof videoStatuses)[number];

export const clipDifficulties = ["easy", "medium", "hard"] as const;
export const clipTypes = ["funny", "reaction", "opinion", "educational", "hype", "story", "other"] as const;

export type TranscriptItem = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptSegment = {
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
};

export type NormalizedClipCandidate = {
  title: string;
  start_time: number;
  end_time: number;
  score: number;
  reason: string;
  hook: string;
  caption: string;
  difficulty: (typeof clipDifficulties)[number];
  clip_type: (typeof clipTypes)[number];
};

const aiCandidateSchema = z.object({
  title: z.string().min(1),
  start_time: z.string(),
  end_time: z.string(),
  score: z.number().min(0).max(100),
  reason: z.string().min(1),
  hook: z.string().min(1),
  caption: z.string().min(1),
  difficulty: z.enum(clipDifficulties),
  clip_type: z.enum(clipTypes)
});

export function parseTimestampToSeconds(timestamp: string) {
  const parts = timestamp.split(":").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  const [hours, minutes, seconds] = parts;
  if (minutes > 59 || seconds > 59) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function secondsToTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function buildTranscriptSegments(items: TranscriptItem[], segmentLengthSeconds = 600): TranscriptSegment[] {
  if (items.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentItems: TranscriptItem[] = [];
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

  if (currentItems.length > 0) {
    segments.push(toSegment(segments.length, currentItems));
  }

  return segments;
}

export function normalizeClipCandidate(value: unknown): NormalizedClipCandidate | null {
  const parsed = aiCandidateSchema.safeParse(value);
  if (!parsed.success) return null;

  try {
    const start = parseTimestampToSeconds(parsed.data.start_time);
    const end = parseTimestampToSeconds(parsed.data.end_time);
    if (end <= start) return null;

    return {
      title: parsed.data.title,
      start_time: start,
      end_time: end,
      score: Math.round(parsed.data.score),
      reason: parsed.data.reason,
      hook: parsed.data.hook,
      caption: parsed.data.caption,
      difficulty: parsed.data.difficulty,
      clip_type: parsed.data.clip_type
    };
  } catch {
    return null;
  }
}

export function normalizeClipCandidates(value: unknown): NormalizedClipCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeClipCandidate).filter((candidate): candidate is NormalizedClipCandidate => candidate !== null);
}

export function rankClipCandidates(candidates: NormalizedClipCandidate[], limit = 20) {
  return [...candidates]
    .filter((candidate) => {
      const duration = candidate.end_time - candidate.start_time;
      return duration >= 10 && duration <= 180;
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, limit);
}

function toSegment(segmentIndex: number, items: TranscriptItem[]): TranscriptSegment {
  return {
    segment_index: segmentIndex,
    start_time: items[0].start,
    end_time: items[items.length - 1].end,
    text: items.map((item) => item.text.trim()).filter(Boolean).join(" ")
  };
}
