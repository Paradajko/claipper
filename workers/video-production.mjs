const MIN_SEGMENT_SECONDS = 0.25;

export function normalizeEditPlan(value, options = {}) {
  const start = Number(value?.start_seconds);
  const end = Number(value?.end_seconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error("Invalid clip bounds.");
  }

  const plan = {
    version: 1,
    start_seconds: start,
    end_seconds: end,
    hook_mode: value?.hook_mode === "cold_open" ? "cold_open" : "natural",
    hook_start_seconds: value?.hook_start_seconds == null ? null : Number(value.hook_start_seconds),
    hook_end_seconds: value?.hook_end_seconds == null ? null : Number(value.hook_end_seconds),
    framing_mode: ["left", "center", "right"].includes(value?.framing_mode) ? value.framing_mode : "center",
    background_mode: value?.background_mode === "blur" ? "blur" : "crop",
    subtitle_preset: "creator",
    add_captions: value?.add_captions !== false,
    enhance_enabled: value?.enhance_enabled !== false
  };

  if (plan.hook_mode === "cold_open") {
    const hookDuration = plan.hook_end_seconds - plan.hook_start_seconds;
    const valid =
      Number.isFinite(plan.hook_start_seconds) &&
      Number.isFinite(plan.hook_end_seconds) &&
      plan.hook_start_seconds >= start &&
      plan.hook_end_seconds <= end &&
      hookDuration >= 1 &&
      hookDuration <= 3;
    if (!valid) {
      if (!options.legacy) throw new Error("Invalid cold-open bounds.");
      plan.hook_mode = "natural";
      plan.hook_start_seconds = null;
      plan.hook_end_seconds = null;
    }
  } else {
    plan.hook_start_seconds = null;
    plan.hook_end_seconds = null;
  }
  return plan;
}

export function buildRenderTimeline(value) {
  const plan = normalizeEditPlan(value);
  if (plan.hook_mode === "natural") {
    return [{ role: "body", start: plan.start_seconds, end: plan.end_seconds }];
  }

  const timeline = [
    { role: "hook", start: plan.hook_start_seconds, end: plan.hook_end_seconds },
    { role: "body", start: plan.start_seconds, end: plan.hook_start_seconds },
    { role: "body", start: plan.hook_end_seconds, end: plan.end_seconds }
  ].filter((segment) => segment.end > segment.start);
  if (timeline.some((segment) => segment.end - segment.start < MIN_SEGMENT_SECONDS)) {
    throw new Error("Render timeline contains a segment shorter than 250ms.");
  }
  return timeline;
}

export function buildAssDocument(words, timeline, options = {}) {
  const width = Number(options.width ?? 1080);
  const height = Number(options.height ?? 1920);
  const mapped = words
    .map((word) => ({ ...word, outputStart: mapSourceTime(word.start, timeline), outputEnd: mapSourceTime(word.end, timeline) }))
    .filter((word) => Number.isFinite(word.outputStart) && Number.isFinite(word.outputEnd) && word.outputEnd > word.outputStart);
  const dialogues = [];
  for (let index = 0; index < mapped.length; index += 4) {
    const group = mapped.slice(index, index + 4);
    for (const [activeIndex, active] of group.entries()) {
      const text = group.map((word, wordIndex) => {
        const escaped = escapeAssText(word.text ?? word.word ?? "");
        return wordIndex === activeIndex ? `{\\1c&H00FFFF&}${escaped}{\\1c&HFFFFFF&}` : escaped;
      }).join(" ");
      dialogues.push(`Dialogue: 0,${assTime(active.outputStart)},${assTime(active.outputEnd)},Creator,,0,0,0,,${text}`);
    }
  }
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    "Style: Creator,Arial,72,&H00FFFFFF,&H0000FFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,80,80,260,1",
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...dialogues
  ].join("\n");
}

export function buildReadyRenderCommand({ inputPath, outputPath, editPlan, timeline, assPath = null }) {
  const plan = normalizeEditPlan(editPlan, { legacy: true });
  const segments = timeline ?? buildRenderTimeline(plan);
  const graphParts = [];
  const pairs = [];
  segments.forEach((segment, index) => {
    graphParts.push(`[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[v${index}]`);
    graphParts.push(`[0:a]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[a${index}]`);
    pairs.push(`[v${index}][a${index}]`);
  });
  graphParts.push(`${pairs.join("")}concat=n=${segments.length}:v=1:a=1[joinedv][joineda]`);

  const framingX = plan.framing_mode === "left" ? "0" : plan.framing_mode === "right" ? "iw-1080" : "(iw-1080)/2";
  let videoChain;
  if (plan.background_mode === "blur") {
    videoChain = "[joinedv]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:10[blurred];[fg]scale=1080:1920:force_original_aspect_ratio=decrease[contained];[blurred][contained]overlay=(W-w)/2:(H-h)/2";
  } else {
    videoChain = `[joinedv]scale=-2:1920,crop=1080:1920:${framingX}`;
  }
  if (plan.enhance_enabled) videoChain += ",eq=contrast=1.03:saturation=1.04,unsharp=5:5:0.35";
  if (assPath) videoChain += `,subtitles='${escapeFilterPath(assPath)}'`;
  videoChain += "[outv]";
  graphParts.push(videoChain);
  graphParts.push(plan.enhance_enabled ? "[joineda]loudnorm=I=-16:TP=-1.5:LRA=11[outa]" : "[joineda]anull[outa]");

  const expectedDuration = segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
  return {
    expectedDuration,
    args: [
      "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
      "-filter_complex", graphParts.join(";"),
      "-map", "[outv]", "-map", "[outa]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outputPath
    ]
  };
}

export function validateProbeResult(probe, expected) {
  const errors = [];
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (!video) errors.push("missing_video_stream");
  if (!audio) errors.push("missing_audio_stream");
  if (video && (video.width !== expected.width || video.height !== expected.height)) errors.push("wrong_dimensions");
  if (video && !["h264", "avc1"].includes(String(video.codec_name ?? "").toLowerCase())) errors.push("unsupported_video_codec");
  const duration = Number(probe?.format?.duration);
  if (!Number.isFinite(duration) || Math.abs(duration - expected.duration) > 0.75) errors.push("duration_mismatch");
  return { ok: errors.length === 0, errors };
}

function mapSourceTime(sourceTime, timeline) {
  let offset = 0;
  for (const segment of timeline) {
    if (sourceTime >= segment.start && sourceTime <= segment.end) return offset + sourceTime - segment.start;
    offset += segment.end - segment.start;
  }
  return Number.NaN;
}

function assTime(seconds) {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

function escapeAssText(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", "\\N");
}

function escapeFilterPath(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}
