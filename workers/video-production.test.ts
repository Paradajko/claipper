import { describe, expect, it } from "vitest";
import {
  buildAssDocument,
  buildReadyRenderCommand,
  buildRenderTimeline,
  normalizeEditPlan,
  validateProbeResult
} from "./video-production.mjs";

describe("video production", () => {
  it("keeps a natural clip as one timeline segment", () => {
    expect(buildRenderTimeline({
      start_seconds: 100,
      end_seconds: 140,
      hook_mode: "natural"
    })).toEqual([{ role: "body", start: 100, end: 140 }]);
  });

  it("builds Unicode creator captions for a 1080x1920 safe area", () => {
    const words = [
      { start: 100, end: 100.5, text: "Toto" },
      { start: 100.5, end: 101, text: "je" },
      { start: 101, end: 101.7, text: "naozaj" },
      { start: 101.7, end: 102.4, text: "dôležité." }
    ];
    const ass = buildAssDocument(words, [{ role: "body", start: 100, end: 140 }], {
      width: 1080, height: 1920, preset: "creator"
    });

    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
    expect(ass).toContain("dôležité");
    expect(ass).toContain("MarginL,MarginR,MarginV,Encoding");
    expect(ass).toContain(",80,80,260,1");
    expect(ass).toContain("\\1c&H00FFFF&");
  });

  it("builds distinct framing graphs and production output settings", () => {
    const base = {
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/output.mp4",
      timeline: [{ role: "body" as const, start: 100, end: 140 }],
      assPath: "/tmp/captions.ass"
    };
    const left = buildReadyRenderCommand({ ...base, editPlan: { start_seconds: 100, end_seconds: 140, framing_mode: "left", background_mode: "crop", enhance_enabled: true } });
    const center = buildReadyRenderCommand({ ...base, editPlan: { start_seconds: 100, end_seconds: 140, framing_mode: "center", background_mode: "crop" } });
    const right = buildReadyRenderCommand({ ...base, editPlan: { start_seconds: 100, end_seconds: 140, framing_mode: "right", background_mode: "crop" } });
    const blur = buildReadyRenderCommand({ ...base, editPlan: { start_seconds: 100, end_seconds: 140, background_mode: "blur" } });

    expect(left.args.join(" ")).toContain("crop=1080:1920:0");
    expect(center.args.join(" ")).toContain("crop=1080:1920:(iw-1080)/2");
    expect(right.args.join(" ")).toContain("crop=1080:1920:iw-1080");
    expect(blur.args.join(" ")).toContain("boxblur");
    expect(blur.args.join(" ")).toContain("overlay");
    expect(left.args.join(" ")).toContain("eq=");
    expect(left.args.join(" ")).toContain("unsharp");
    expect(left.args.join(" ")).toContain("loudnorm");
    for (const token of ["libx264", "medium", "18", "yuv420p", "aac", "+faststart"]) {
      expect(left.args).toContain(token);
    }
  });

  it("builds trim and concat filters for a cold-open timeline", () => {
    const command = buildReadyRenderCommand({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/output.mp4",
      editPlan: { start_seconds: 100, end_seconds: 140, hook_mode: "cold_open", hook_start_seconds: 125, hook_end_seconds: 127 },
      timeline: [
        { role: "hook", start: 125, end: 127 },
        { role: "body", start: 100, end: 125 },
        { role: "body", start: 127, end: 140 }
      ]
    });
    const graph = command.args.join(" ");
    for (const token of ["trim=", "atrim=", "setpts=", "asetpts=", "concat=n=3"]) expect(graph).toContain(token);
  });

  it("validates rendered video probe results", () => {
    const validProbe = {
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1080, height: 1920 },
        { codec_type: "audio", codec_name: "aac" }
      ],
      format: { duration: "40.2" }
    };
    expect(validateProbeResult(validProbe, { width: 1080, height: 1920, duration: 40 })).toEqual({ ok: true, errors: [] });
    expect(validateProbeResult({ streams: [], format: { duration: "40" } }, { width: 1080, height: 1920, duration: 40 }).errors)
      .toEqual(expect.arrayContaining(["missing_video_stream", "missing_audio_stream"]));
    expect(validateProbeResult({ ...validProbe, format: { duration: "42" } }, { width: 1080, height: 1920, duration: 40 }).errors)
      .toContain("duration_mismatch");
  });

  it("moves a cold open first without duplicating its source range", () => {
    expect(buildRenderTimeline({
      start_seconds: 100,
      end_seconds: 140,
      hook_mode: "cold_open",
      hook_start_seconds: 125,
      hook_end_seconds: 127
    })).toEqual([
      { role: "hook", start: 125, end: 127 },
      { role: "body", start: 100, end: 125 },
      { role: "body", start: 127, end: 140 }
    ]);
  });

  it("rejects invalid clip bounds and sub-250ms timeline fragments", () => {
    expect(() => normalizeEditPlan({ start_seconds: 40, end_seconds: 20 })).toThrow("clip bounds");
    expect(() => buildRenderTimeline({
      start_seconds: 100,
      end_seconds: 120,
      hook_mode: "cold_open",
      hook_start_seconds: 100.1,
      hook_end_seconds: 101.1
    })).toThrow("250ms");
  });

  it("downgrades invalid legacy cold-open bounds when requested", () => {
    expect(normalizeEditPlan({
      start_seconds: 100,
      end_seconds: 140,
      hook_mode: "cold_open",
      hook_start_seconds: 80,
      hook_end_seconds: 90
    }, { legacy: true })).toMatchObject({
      hook_mode: "natural",
      hook_start_seconds: null,
      hook_end_seconds: null
    });
  });
});
