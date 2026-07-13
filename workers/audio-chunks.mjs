const DEFAULT_CHUNK_SECONDS = 600;
const DEFAULT_OVERLAP_SECONDS = 5;

export function buildAudioChunkPlan(durationSeconds, options = {}) {
  const duration = Number(durationSeconds);
  const chunkSeconds = Number(options.chunkSeconds ?? DEFAULT_CHUNK_SECONDS);
  const overlapSeconds = Number(options.overlapSeconds ?? DEFAULT_OVERLAP_SECONDS);

  if (!Number.isFinite(duration) || duration <= 0) return [];
  if (!Number.isFinite(chunkSeconds) || chunkSeconds <= 0) {
    throw new Error("chunkSeconds must be greater than zero");
  }
  if (!Number.isFinite(overlapSeconds) || overlapSeconds < 0 || overlapSeconds >= chunkSeconds) {
    throw new Error("overlapSeconds must be smaller than chunkSeconds");
  }

  const chunks = [];
  const stepSeconds = chunkSeconds - overlapSeconds;
  for (let startSeconds = 0, index = 0; startSeconds < duration; startSeconds += stepSeconds, index += 1) {
    const endSeconds = Math.min(duration, startSeconds + chunkSeconds);
    chunks.push({
      index,
      startSeconds: roundTimestamp(startSeconds),
      endSeconds: roundTimestamp(endSeconds),
      durationSeconds: roundTimestamp(endSeconds - startSeconds)
    });
    if (endSeconds >= duration) break;
  }
  return chunks;
}

export function mergeVerboseTranscripts(chunks) {
  const orderedChunks = [...(Array.isArray(chunks) ? chunks : [])]
    .filter((chunk) => chunk && Number.isFinite(Number(chunk.offsetSeconds)) && chunk.transcript)
    .sort((left, right) => Number(left.offsetSeconds) - Number(right.offsetSeconds));

  const segmentCandidates = [];
  const wordCandidates = [];
  let duration = 0;
  let language;

  for (const chunk of orderedChunks) {
    const offsetSeconds = Number(chunk.offsetSeconds);
    const transcript = chunk.transcript ?? {};
    language ??= transcript.language;
    duration = Math.max(duration, offsetSeconds + finiteOrZero(transcript.duration));

    for (const segment of Array.isArray(transcript.segments) ? transcript.segments : []) {
      const adjusted = offsetTimedItem(segment, offsetSeconds, "text");
      if (!adjusted) continue;
      segmentCandidates.push(adjusted);
      duration = Math.max(duration, adjusted.end);
    }

    for (const word of Array.isArray(transcript.words) ? transcript.words : []) {
      const adjusted = offsetTimedItem(word, offsetSeconds, "word");
      if (!adjusted) continue;
      wordCandidates.push(adjusted);
      duration = Math.max(duration, adjusted.end);
    }
  }

  const segments = deduplicateTimedItems(segmentCandidates, "text").map((segment, index) => ({
    ...segment,
    id: index
  }));
  const words = deduplicateTimedItems(wordCandidates, "word");
  const text = segments.length > 0
    ? segments.map((segment) => String(segment.text ?? "").trim()).filter(Boolean).join(" ")
    : words.map((word) => String(word.word ?? "").trim()).filter(Boolean).join(" ");

  return {
    text,
    ...(language ? { language } : {}),
    duration: roundTimestamp(duration),
    segments,
    words
  };
}

function offsetTimedItem(item, offsetSeconds, textKey) {
  const start = Number(item?.start);
  const end = Number(item?.end);
  const text = String(item?.[textKey] ?? "").trim();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || !text) return null;
  return {
    ...item,
    start: roundTimestamp(start + offsetSeconds),
    end: roundTimestamp(end + offsetSeconds),
    [textKey]: item[textKey]
  };
}

function deduplicateTimedItems(items, textKey) {
  const sorted = [...items].sort((left, right) => left.start - right.start || left.end - right.end);
  const accepted = [];
  for (const item of sorted) {
    let duplicate = false;
    for (let index = accepted.length - 1; index >= 0; index -= 1) {
      const previous = accepted[index];
      if (previous.end < item.start - 2) break;
      if (sameTimedContent(previous, item, textKey)) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) accepted.push(item);
  }
  return accepted;
}

function sameTimedContent(left, right, textKey) {
  if (normalizeText(left[textKey]) !== normalizeText(right[textKey])) return false;
  if (Math.abs(left.start - right.start) <= 0.35 && Math.abs(left.end - right.end) <= 0.35) return true;

  const intersection = Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start));
  const shortestDuration = Math.max(0.001, Math.min(left.end - left.start, right.end - right.start));
  return intersection / shortestDuration >= 0.6;
}

function normalizeText(value) {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function finiteOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function roundTimestamp(value) {
  return Math.round(value * 1000) / 1000;
}
