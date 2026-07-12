import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("workers/stream-scan-worker.mjs", "utf8");

describe("ready render worker contract", () => {
  it("uses the deterministic production module and FFprobe before upload", () => {
    for (const symbol of [
      "normalizeEditPlan",
      "buildRenderTimeline",
      "buildAssDocument",
      "buildReadyRenderCommand",
      "validateProbeResult"
    ]) {
      expect(worker).toContain(symbol);
    }
    expect(worker).toContain("FFPROBE_PATH");
    expect(worker).toContain('"-show_streams"');
    expect(worker).toContain('"-show_format"');
    expect(worker).toContain('"json"');
    expect(worker.indexOf("validateProbeResult")).toBeLessThan(worker.indexOf("uploadFile(buckets.clips"));
  });

  it("persists passed QA and exposes clear job errors on failure", () => {
    expect(worker).toContain('render_version: 2');
    expect(worker).toContain('status: "passed"');
    expect(worker).toContain("ffprobe_error");
    expect(worker).toContain("quality_check");
    expect(worker).toContain('render_status: "failed"');
    expect(worker).toContain('status: "editing"');
    expect(worker).toContain("error_message: userError");
    expect(worker).toContain("technical_error: technicalError");
  });

  it("accepts new word timestamps and legacy transcript arrays", () => {
    expect(worker).toContain("Array.isArray(value)");
    expect(worker).toContain("value?.segments");
    expect(worker).toContain("value?.words");
    expect(worker).toContain("loadTranscriptTiming");
  });
});
