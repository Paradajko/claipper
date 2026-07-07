import { describe, expect, it } from "vitest";
import {
  buildTranscriptSegments,
  normalizeClipCandidate,
  parseTimestampToSeconds,
  rankClipCandidates,
  secondsToTimestamp
} from "@/lib/stream-scan";

describe("stream scan helpers", () => {
  it("parses and formats HH:MM:SS timestamps", () => {
    expect(parseTimestampToSeconds("00:08:14")).toBe(494);
    expect(parseTimestampToSeconds("01:02:03")).toBe(3723);
    expect(secondsToTimestamp(494)).toBe("00:08:14");
    expect(secondsToTimestamp(3723)).toBe("01:02:03");
  });

  it("splits transcript items into bounded 5 minute segments", () => {
    const words = Array.from({ length: 13 }, (_, index) => ({
      start: index * 60,
      end: index * 60 + 20,
      text: `minute-${index}`
    }));

    const segments = buildTranscriptSegments(words, 300);

    expect(segments).toEqual([
      {
        segment_index: 0,
        start_time: 0,
        end_time: 260,
        text: "minute-0 minute-1 minute-2 minute-3 minute-4"
      },
      {
        segment_index: 1,
        start_time: 300,
        end_time: 560,
        text: "minute-5 minute-6 minute-7 minute-8 minute-9"
      },
      {
        segment_index: 2,
        start_time: 600,
        end_time: 740,
        text: "minute-10 minute-11 minute-12"
      }
    ]);
  });

  it("normalizes structured AI candidates and rejects invalid items", () => {
    const candidate = normalizeClipCandidate({
      title: "Strong opener",
      start_time: "00:08:14",
      end_time: "00:08:49",
      score: 91,
      reason: "Clear opinion and payoff.",
      hook: "This is where the argument changes.",
      caption: "A short moment worth replaying.",
      difficulty: "easy",
      clip_type: "opinion",
      attention_score: 92,
      emotion_spike: 80,
      hook_strength: 95,
      payoff_score: 88,
      context_needed: 12,
      retention_risk: 18,
      edit_difficulty: 22,
      recommendation: "export",
      recut_suggestion: "Start at the sentence with the challenge and end after the laugh."
    });

    expect(candidate).toMatchObject({
      title: "Strong opener",
      start_time: 494,
      end_time: 529,
      score: 91,
      difficulty: "easy",
      clip_type: "opinion",
      attention_score: 92,
      emotion_spike: 80,
      hook_strength: 95,
      payoff_score: 88,
      context_needed: 12,
      retention_risk: 18,
      edit_difficulty: 22,
      recommendation: "export",
      recut_suggestion: "Start at the sentence with the challenge and end after the laugh."
    });
    expect(normalizeClipCandidate({ title: "bad", start_time: "oops" })).toBeNull();
  });

  it("keeps legacy clip idea candidates working with v2 scoring defaults", () => {
    const candidate = normalizeClipCandidate({
      title: "Legacy opener",
      start_time: "00:01:10",
      end_time: "00:01:44",
      score: 82,
      reason: "Clear reaction.",
      hook: "Wait for the turn.",
      caption: "This changed fast.",
      difficulty: "medium",
      clip_type: "reaction"
    });

    expect(candidate).toMatchObject({
      title: "Legacy opener",
      attention_score: 82,
      emotion_spike: 50,
      hook_strength: 82,
      payoff_score: 50,
      context_needed: 50,
      retention_risk: 50,
      edit_difficulty: 50,
      recommendation: "maybe",
      recut_suggestion: ""
    });
  });

  it("ranks candidates by score while filtering long or unclear ranges", () => {
    const ranked = rankClipCandidates([
      { title: "Too short", start_time: 0, end_time: 12, score: 100, reason: "short", hook: "h", caption: "c", difficulty: "easy", clip_type: "story", attention_score: 100, emotion_spike: 90, hook_strength: 95, payoff_score: 90, context_needed: 10, retention_risk: 10, edit_difficulty: 10, recommendation: "export", recut_suggestion: "" },
      { title: "Too long", start_time: 0, end_time: 400, score: 99, reason: "long", hook: "h", caption: "c", difficulty: "easy", clip_type: "story", attention_score: 99, emotion_spike: 90, hook_strength: 95, payoff_score: 90, context_needed: 10, retention_risk: 10, edit_difficulty: 10, recommendation: "export", recut_suggestion: "" },
      { title: "Summary", start_time: 1, end_time: 40, score: 98, reason: "calm explanation", hook: "h", caption: "c", difficulty: "easy", clip_type: "educational", attention_score: 25, emotion_spike: 10, hook_strength: 20, payoff_score: 15, context_needed: 85, retention_risk: 90, edit_difficulty: 30, recommendation: "skip", recut_suggestion: "Needs a sharper reaction." },
      { title: "Needs recut", start_time: 60, end_time: 100, score: 96, reason: "great payoff but starts early", hook: "h", caption: "c", difficulty: "medium", clip_type: "opinion", attention_score: 88, emotion_spike: 80, hook_strength: 84, payoff_score: 90, context_needed: 28, retention_risk: 42, edit_difficulty: 64, recommendation: "needs_recut", recut_suggestion: "Trim the setup." },
      { title: "Best", start_time: 10, end_time: 50, score: 95, reason: "best", hook: "h", caption: "c", difficulty: "easy", clip_type: "reaction", attention_score: 95, emotion_spike: 88, hook_strength: 92, payoff_score: 86, context_needed: 18, retention_risk: 20, edit_difficulty: 22, recommendation: "export", recut_suggestion: "" },
      { title: "Weak", start_time: 110, end_time: 140, score: 61, reason: "weak", hook: "h", caption: "c", difficulty: "medium", clip_type: "other", attention_score: 55, emotion_spike: 40, hook_strength: 52, payoff_score: 45, context_needed: 60, retention_risk: 62, edit_difficulty: 50, recommendation: "maybe", recut_suggestion: "" }
    ]);

    expect(ranked.map((item) => item.title)).toEqual(["Best", "Needs recut", "Weak"]);
  });
});
