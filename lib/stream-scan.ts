import { z } from "zod";

export const videoStatuses = [
  "created",
  "uploading",
  "uploaded",
  "import_queued",
  "downloading",
  "queued",
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
export const clipRecommendations = ["export", "needs_recut", "maybe", "skip"] as const;

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
  attention_score: number;
  emotion_spike: number;
  hook_strength: number;
  payoff_score: number;
  context_needed: number;
  retention_risk: number;
  edit_difficulty: number;
  recommendation: (typeof clipRecommendations)[number];
  recut_suggestion: string;
  source_quote: string;
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
  clip_type: z.enum(clipTypes),
  attention_score: z.number().min(0).max(100).optional(),
  emotion_spike: z.number().min(0).max(100).optional(),
  hook_strength: z.number().min(0).max(100).optional(),
  payoff_score: z.number().min(0).max(100).optional(),
  context_needed: z.number().min(0).max(100).optional(),
  retention_risk: z.number().min(0).max(100).optional(),
  edit_difficulty: z.number().min(0).max(100).optional(),
  recommendation: z.enum(clipRecommendations).optional(),
  recut_suggestion: z.string().optional(),
  source_quote: z.string().optional()
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
      clip_type: parsed.data.clip_type,
      attention_score: normalizeScore(parsed.data.attention_score, parsed.data.score),
      emotion_spike: normalizeScore(parsed.data.emotion_spike, 50),
      hook_strength: normalizeScore(parsed.data.hook_strength, parsed.data.score),
      payoff_score: normalizeScore(parsed.data.payoff_score, 50),
      context_needed: normalizeScore(parsed.data.context_needed, 50),
      retention_risk: normalizeScore(parsed.data.retention_risk, 50),
      edit_difficulty: normalizeScore(parsed.data.edit_difficulty, 50),
      recommendation: parsed.data.recommendation ?? "maybe",
      recut_suggestion: parsed.data.recut_suggestion?.trim() ?? "",
      source_quote: parsed.data.source_quote?.trim() ?? ""
    };
  } catch {
    return null;
  }
}

export function normalizeClipCandidates(value: unknown): NormalizedClipCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeClipCandidate).filter((candidate): candidate is NormalizedClipCandidate => candidate !== null);
}

export function rankClipCandidates(candidates: NormalizedClipCandidate[], limit = 8) {
  return [...candidates]
    .filter((candidate) => {
      const duration = candidate.end_time - candidate.start_time;
      return duration >= 20 && duration <= 60 && candidate.recommendation !== "skip";
    })
    .sort((first, second) => v2MomentScore(second) - v2MomentScore(first))
    .slice(0, limit);
}

export function clipIdeaInsertPayload(videoId: string, idea: NormalizedClipCandidate, source: string) {
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
      moment_finder_version: "v2.1",
      moment_v2: {
        attention_score: idea.attention_score,
        emotion_spike: idea.emotion_spike,
        hook_strength: idea.hook_strength,
        payoff_score: idea.payoff_score,
        context_needed: idea.context_needed,
        retention_risk: idea.retention_risk,
        edit_difficulty: idea.edit_difficulty,
        recommendation: idea.recommendation,
        recut_suggestion: idea.recut_suggestion,
        source_quote: idea.source_quote
      }
    }
  };
}

export function extractSourceQuote(items: TranscriptItem[], startTime: number, endTime: number) {
  return items
    .filter((item) => item.end > startTime && item.start < endTime)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function groundClipCandidate(candidate: NormalizedClipCandidate, items: TranscriptItem[]): NormalizedClipCandidate {
  const selectedQuote = extractSourceQuote(items, candidate.start_time, candidate.end_time);
  if (metadataMatchesQuote(candidate, selectedQuote)) {
    return { ...candidate, source_quote: selectedQuote };
  }

  const nearbyRange = findBestQuoteRange(candidate, items);
  if (nearbyRange) {
    const movedQuote = extractSourceQuote(items, nearbyRange.start, nearbyRange.end);
    if (metadataMatchesQuote(candidate, movedQuote)) {
      return {
        ...candidate,
        start_time: nearbyRange.start,
        end_time: nearbyRange.end,
        source_quote: movedQuote
      };
    }
  }

  const fallbackQuote = selectedQuote || extractSourceQuote(items, candidate.start_time, candidate.end_time) || candidate.hook;
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

function metadataMatchesQuote(candidate: NormalizedClipCandidate, quote: string) {
  const metadataTokens = contentTokens([candidate.title, candidate.hook, candidate.caption].join(" "));
  if (metadataTokens.length === 0) return Boolean(quote.trim());
  const quoteTokens = new Set(contentTokens(quote));
  const matches = metadataTokens.filter((token) => quoteTokens.has(token)).length;
  return matches >= Math.min(2, metadataTokens.length);
}

function findBestQuoteRange(candidate: NormalizedClipCandidate, items: TranscriptItem[]) {
  const metadataTokens = contentTokens([candidate.title, candidate.hook, candidate.caption].join(" "));
  if (metadataTokens.length === 0) return null;

  let best: { index: number; score: number } | null = null;
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

function titleFromQuote(quote: string) {
  const compact = quote.replace(/\s+/g, " ").trim();
  if (!compact) return "Grounded moment";
  const sentence = compact.split(/[.!?]/)[0]?.trim() || compact;
  return sentence.slice(0, 80);
}

function contentTokens(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function normalizeText(value: string) {
  return value
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

function normalizeScore(value: number | undefined, fallback: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value ?? fallback))));
}

function v2MomentScore(candidate: NormalizedClipCandidate) {
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

function toSegment(segmentIndex: number, items: TranscriptItem[]): TranscriptSegment {
  return {
    segment_index: segmentIndex,
    start_time: items[0].start,
    end_time: items[items.length - 1].end,
    text: items.map((item) => item.text.trim()).filter(Boolean).join(" ")
  };
}
