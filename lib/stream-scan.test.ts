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
      clip_type: "opinion"
    });

    expect(candidate).toMatchObject({
      title: "Strong opener",
      start_time: 494,
      end_time: 529,
      score: 91,
      difficulty: "easy",
      clip_type: "opinion"
    });
    expect(normalizeClipCandidate({ title: "bad", start_time: "oops" })).toBeNull();
  });

  it("ranks candidates by score while filtering long or unclear ranges", () => {
    const ranked = rankClipCandidates([
      { title: "Too long", start_time: 0, end_time: 400, score: 99, reason: "long", hook: "h", caption: "c", difficulty: "easy", clip_type: "story" },
      { title: "Best", start_time: 10, end_time: 50, score: 95, reason: "best", hook: "h", caption: "c", difficulty: "easy", clip_type: "reaction" },
      { title: "Weak", start_time: 60, end_time: 80, score: 61, reason: "weak", hook: "h", caption: "c", difficulty: "medium", clip_type: "other" }
    ]);

    expect(ranked.map((item) => item.title)).toEqual(["Best", "Weak"]);
  });
});
