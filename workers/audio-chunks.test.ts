import { describe, expect, it } from "vitest";
import { buildAudioChunkPlan, mergeVerboseTranscripts } from "./audio-chunks.mjs";

describe("buildAudioChunkPlan", () => {
  it("keeps short audio in one bounded chunk", () => {
    expect(buildAudioChunkPlan(90)).toEqual([
      { index: 0, startSeconds: 0, endSeconds: 90, durationSeconds: 90 }
    ]);
  });

  it("plans a long VOD with overlap and a final partial chunk", () => {
    const chunks = buildAudioChunkPlan(142 * 60 + 27);

    expect(chunks).toHaveLength(15);
    expect(chunks[0]).toEqual({ index: 0, startSeconds: 0, endSeconds: 600, durationSeconds: 600 });
    expect(chunks[1]).toEqual({ index: 1, startSeconds: 595, endSeconds: 1195, durationSeconds: 600 });
    expect(chunks.at(-1)).toEqual({ index: 14, startSeconds: 8330, endSeconds: 8547, durationSeconds: 217 });
  });

  it("rejects invalid plans", () => {
    expect(buildAudioChunkPlan(0)).toEqual([]);
    expect(() => buildAudioChunkPlan(100, { chunkSeconds: 10, overlapSeconds: 10 })).toThrow(
      "overlapSeconds must be smaller than chunkSeconds"
    );
  });
});

describe("mergeVerboseTranscripts", () => {
  it("offsets segment and word timestamps onto the source timeline", () => {
    const merged = mergeVerboseTranscripts([
      {
        offsetSeconds: 600,
        transcript: {
          language: "sk",
          duration: 30,
          segments: [{ id: 0, start: 2.5, end: 4, text: "Ahoj svet" }],
          words: [
            { start: 2.5, end: 3, word: "Ahoj" },
            { start: 3.1, end: 4, word: "svet" }
          ]
        }
      }
    ]);

    expect(merged.duration).toBe(630);
    expect(merged.language).toBe("sk");
    expect(merged.segments[0]).toMatchObject({ start: 602.5, end: 604, text: "Ahoj svet" });
    expect(merged.words).toEqual([
      { start: 602.5, end: 603, word: "Ahoj" },
      { start: 603.1, end: 604, word: "svet" }
    ]);
  });

  it("deduplicates the same overlap word and segment", () => {
    const merged = mergeVerboseTranscripts([
      {
        offsetSeconds: 0,
        transcript: {
          segments: [{ start: 598, end: 600, text: "ahoj" }],
          words: [{ start: 599, end: 600, word: "ahoj" }]
        }
      },
      {
        offsetSeconds: 595,
        transcript: {
          segments: [{ start: 3, end: 5, text: "ahoj" }],
          words: [{ start: 4, end: 5, word: "ahoj" }]
        }
      }
    ]);

    expect(merged.segments).toHaveLength(1);
    expect(merged.words).toHaveLength(1);
    expect(merged.text).toBe("ahoj");
  });

  it("preserves repeated words when they occur at different times", () => {
    const merged = mergeVerboseTranscripts([
      {
        offsetSeconds: 0,
        transcript: {
          words: [
            { start: 10, end: 11, word: "áno" },
            { start: 20, end: 21, word: "áno" }
          ]
        }
      }
    ]);

    expect(merged.words).toHaveLength(2);
    expect(merged.text).toBe("áno áno");
  });
});
