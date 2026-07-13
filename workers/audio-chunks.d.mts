export type AudioChunkPlanItem = {
  index: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

export type VerboseTranscriptItem = {
  start: number;
  end: number;
  [key: string]: unknown;
};

export type VerboseTranscript = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: Array<VerboseTranscriptItem & { text: string }>;
  words?: Array<VerboseTranscriptItem & { word: string }>;
  [key: string]: unknown;
};

export function buildAudioChunkPlan(
  durationSeconds: number,
  options?: { chunkSeconds?: number; overlapSeconds?: number }
): AudioChunkPlanItem[];

export function mergeVerboseTranscripts(
  chunks: Array<{ offsetSeconds: number; transcript: VerboseTranscript }>
): Required<Pick<VerboseTranscript, "text" | "duration" | "segments" | "words">> & Pick<VerboseTranscript, "language">;
