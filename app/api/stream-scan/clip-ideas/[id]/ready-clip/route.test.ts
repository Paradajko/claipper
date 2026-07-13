import { describe, expect, it } from "vitest";
import { editPlanSchema, isGroundedReadyClipTiming } from "./ready-clip-validation";

const validInput = {
  startSeconds: "100",
  endSeconds: "140",
  hookMode: "natural",
  framingMode: "center",
  backgroundMode: "crop",
  subtitlePreset: "creator",
  addCaptions: "true",
  enhanceEnabled: "true"
};

describe("ready clip input validation", () => {
  it("rejects empty and whitespace-only required timing values", () => {
    expect(editPlanSchema.safeParse({ ...validInput, startSeconds: "" }).success).toBe(false);
    expect(editPlanSchema.safeParse({ ...validInput, startSeconds: "   " }).success).toBe(false);
    expect(editPlanSchema.safeParse({ ...validInput, endSeconds: " " }).success).toBe(false);
  });

  it("rejects a cold-open that leaves a body fragment below 250ms", () => {
    const parsed = editPlanSchema.parse({
      ...validInput,
      hookMode: "cold_open",
      hookStartSeconds: "100.1",
      hookEndSeconds: "101.2"
    });

    expect(isGroundedReadyClipTiming(parsed, 100, 140)).toBe(false);
    expect(isGroundedReadyClipTiming({ ...parsed, hookStartSeconds: 100 }, 100, 140)).toBe(true);
  });
});
