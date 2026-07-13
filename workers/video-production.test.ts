import { describe, expect, it } from "vitest";
import {
  buildAssDocument,
  buildReadyRenderCommand,
  buildRenderTimeline,
  groundColdOpenHook,
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

  it("orders cold-open captions by output time and clips words at splice boundaries", () => {
    const ass = buildAssDocument([
      { start: 100.2, end: 100.8, text: "Body" },
      { start: 124.9, end: 125.1, text: "Boundary" },
      { start: 125.2, end: 125.8, text: "Hook" }
    ], [
      { role: "hook", start: 125, end: 127 },
      { role: "body", start: 100, end: 125 },
      { role: "body", start: 127, end: 140 }
    ]);
    const dialogues = ass
      .split("\n")
      .filter((line) => line.startsWith("Dialogue:"));
    const dialogueTimes = dialogues.map((line) => line.split(",").slice(1, 3));

    expect(dialogueTimes).toEqual([
      ["0:00:00.00", "0:00:00.10"],
      ["0:00:00.20", "0:00:00.80"],
      ["0:00:02.20", "0:00:02.80"],
      ["0:00:26.90", "0:00:27.00"]
    ]);
    expect(dialogues[0]).toContain("Hook");
    expect(dialogues[0]).not.toContain("Body");
    expect(dialogues[2]).toContain("Body");
    expect(dialogues[2]).not.toContain("Hook");
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
    expect(command.args.indexOf("-ss")).toBeLessThan(command.args.indexOf("-i"));
    expect(command.args).toContain("100");
    expect(graph).toContain("trim=start=25:end=27");
    expect(graph).toContain("trim=start=0:end=25");
    expect(graph).not.toContain("trim=start=125");
  });

  it("seeks directly to a late natural clip before decoding", () => {
    const command = buildReadyRenderCommand({
      inputPath: "/tmp/source.mpg",
      outputPath: "/tmp/output.mp4",
      editPlan: { start_seconds: 6339, end_seconds: 6370, hook_mode: "natural" }
    });
    const graph = command.args.join(" ");

    expect(command.args.slice(0, command.args.indexOf("-i"))).toEqual(expect.arrayContaining(["-ss", "6339"]));
    expect(graph).toContain("trim=start=0:end=31");
    expect(graph).not.toContain("trim=start=6339");
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

  it("rejects malformed current edit plans instead of silently changing them", () => {
    const currentPlan = {
      version: 1,
      start_seconds: 100,
      end_seconds: 140,
      hook_mode: "natural",
      hook_start_seconds: null,
      hook_end_seconds: null,
      framing_mode: "center",
      background_mode: "crop",
      subtitle_preset: "creator",
      add_captions: true,
      enhance_enabled: true
    };

    expect(() => normalizeEditPlan({ ...currentPlan, hook_mode: "surprise" } as never)).toThrow("hook mode");
    expect(() => normalizeEditPlan({ ...currentPlan, framing_mode: "top" } as never)).toThrow("framing mode");
    expect(() => normalizeEditPlan({ ...currentPlan, background_mode: "neon" } as never)).toThrow("background mode");
    expect(() => normalizeEditPlan({ ...currentPlan, add_captions: "yes" } as never)).toThrow("caption setting");
  });

  it("grounds cold-open hook text only to words inside its verified interval", () => {
    const candidate = {
      hook_mode: "cold_open" as const,
      hook_start_time: 125,
      hook_end_time: 127,
      hook: "A claim from the body of the clip"
    };
    const words = [
      { start: 110, end: 111, text: "Body claim" },
      { start: 125, end: 125.7, text: "Toto" },
      { start: 125.7, end: 126.4, text: "je hook" },
      { start: 130, end: 131, text: "Later payoff" }
    ];

    expect(groundColdOpenHook(candidate, words)).toMatchObject({
      hook_mode: "cold_open",
      hook: "Toto je hook"
    });
  });
});
