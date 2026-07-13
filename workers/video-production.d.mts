export type EditPlan = {
  version?: 1;
  start_seconds: number;
  end_seconds: number;
  hook_mode?: "natural" | "cold_open";
  hook_start_seconds?: number | null;
  hook_end_seconds?: number | null;
  framing_mode?: "left" | "center" | "right";
  background_mode?: "crop" | "blur";
  subtitle_preset?: "creator";
  add_captions?: boolean;
  enhance_enabled?: boolean;
};

export type RenderSegment = { role: "hook" | "body"; start: number; end: number };
export type TranscriptWord = { start: number; end: number; text?: string; word?: string };

export function normalizeEditPlan(value: EditPlan, options?: { legacy?: boolean }): Required<EditPlan>;
export function buildRenderTimeline(value: EditPlan): RenderSegment[];
export function groundColdOpenHook<T extends {
  hook_mode?: "natural" | "cold_open";
  hook_start_time?: number | null;
  hook_end_time?: number | null;
  hook?: string;
}>(candidate: T, words: TranscriptWord[]): T;
export function buildAssDocument(
  words: TranscriptWord[],
  timeline: RenderSegment[],
  options?: { width?: number; height?: number; preset?: "creator" }
): string;
export function buildReadyRenderCommand(input: {
  inputPath: string;
  outputPath: string;
  editPlan: EditPlan;
  timeline?: RenderSegment[];
  assPath?: string | null;
}): { args: string[]; expectedDuration: number };
export function validateProbeResult(
  probe: unknown,
  expected: { width: number; height: number; duration: number }
): { ok: boolean; errors: string[] };
