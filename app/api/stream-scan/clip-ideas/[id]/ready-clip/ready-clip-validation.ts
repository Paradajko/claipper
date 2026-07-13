import { z } from "zod";

const MIN_TIMELINE_SEGMENT_SECONDS = 0.25;
const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;
const optionalNumber = z.preprocess(emptyToUndefined, z.coerce.number().optional());
const requiredNumber = z.preprocess(emptyToUndefined, z.coerce.number());
const formBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean()
);

export const editPlanSchema = z.object({
  startSeconds: requiredNumber.pipe(z.number().min(0)),
  endSeconds: requiredNumber.pipe(z.number().positive()),
  hookMode: z.enum(["natural", "cold_open"]).default("natural"),
  hookStartSeconds: optionalNumber,
  hookEndSeconds: optionalNumber,
  framingMode: z.enum(["left", "center", "right"]).default("center"),
  backgroundMode: z.enum(["crop", "blur"]).default("crop"),
  subtitlePreset: z.literal("creator").default("creator"),
  addCaptions: formBoolean,
  enhanceEnabled: formBoolean
});

type ParsedEditPlan = z.infer<typeof editPlanSchema>;

export function isGroundedReadyClipTiming(parsed: ParsedEditPlan, ideaStart: number, ideaEnd: number) {
  const duration = parsed.endSeconds - parsed.startSeconds;
  const allowedStart = Math.max(0, ideaStart - 20);
  const allowedEnd = ideaEnd + 20;
  const coldOpenDuration = (parsed.hookEndSeconds ?? 0) - (parsed.hookStartSeconds ?? 0);
  const leadingBodyDuration = (parsed.hookStartSeconds ?? parsed.startSeconds) - parsed.startSeconds;
  const trailingBodyDuration = parsed.endSeconds - (parsed.hookEndSeconds ?? parsed.endSeconds);
  const coldOpenValid =
    parsed.hookMode === "natural" ||
    (parsed.hookStartSeconds !== undefined &&
      parsed.hookEndSeconds !== undefined &&
      parsed.hookStartSeconds >= parsed.startSeconds &&
      parsed.hookEndSeconds <= parsed.endSeconds &&
      coldOpenDuration >= 1 &&
      coldOpenDuration <= 3 &&
      (leadingBodyDuration === 0 || leadingBodyDuration >= MIN_TIMELINE_SEGMENT_SECONDS) &&
      (trailingBodyDuration === 0 || trailingBodyDuration >= MIN_TIMELINE_SEGMENT_SECONDS));
  return duration >= 20 &&
    duration <= 60 &&
    parsed.startSeconds >= allowedStart &&
    parsed.endSeconds <= allowedEnd &&
    coldOpenValid;
}
