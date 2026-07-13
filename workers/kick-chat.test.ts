import { describe, expect, it } from "vitest";
import { buildChatWindows, normalizeKickChat } from "./kick-chat.mjs";

describe("Kick chat normalization", () => {
  it("aligns absolute timestamps to the first message and extracts emotes", () => {
    const messages = normalizeKickChat([
      { content: "[emote:37226:KEKW]", createdAt: "2026-06-28T15:49:43Z", userId: 1, username: "one" },
      { content: "clipni to", createdAt: "2026-06-28T15:49:48Z", userId: 2, username: "two" }
    ], { offsetSeconds: 2 });

    expect(messages).toEqual([
      { timestamp_seconds: 2, username: "one", message: "KEKW", emotes: ["KEKW"] },
      { timestamp_seconds: 7, username: "two", message: "clipni to", emotes: [] }
    ]);
  });

  it("supports negative synchronization offsets and chronological sorting", () => {
    const messages = normalizeKickChat([
      { content: "second", createdAt: "2026-06-28T15:50:00Z", username: "two" },
      { content: "first", createdAt: "2026-06-28T15:49:50Z", username: "one" }
    ], { offsetSeconds: -3.5 });

    expect(messages.map((message) => message.timestamp_seconds)).toEqual([-3.5, 6.5]);
    expect(messages.map((message) => message.message)).toEqual(["first", "second"]);
  });

  it("rejects malformed roots and drops invalid, empty, and promotional rows", () => {
    expect(() => normalizeKickChat({ messages: [] })).toThrow("array");

    const messages = normalizeKickChat([
      { content: "", createdAt: "2026-06-28T15:49:43Z", username: "empty" },
      { content: "hello", createdAt: "not-a-date", username: "invalid" },
      { content: "‼️Chat commands ★ !shop • !dc", createdAt: "2026-06-28T15:49:44Z", username: "bot" },
      { content: "Check BONUSES https://touken.gg/", createdAt: "2026-06-28T15:49:45Z", username: "bot" },
      { content: "real reaction", createdAt: "2026-06-28T15:49:46Z", username: "viewer" }
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toBe("real reaction");
  });
});

describe("Kick chat activity windows", () => {
  it("rewards multi-user reactions and exposes prompt-safe summaries", () => {
    const messages = normalizeKickChat([
      { content: "[emote:37226:KEKW]", createdAt: "2026-06-28T15:49:43Z", username: "one" },
      { content: "clipni to", createdAt: "2026-06-28T15:49:45Z", username: "two" },
      { content: "coze", createdAt: "2026-06-28T15:49:47Z", username: "three" },
      { content: "W", createdAt: "2026-06-28T15:49:48Z", username: "four" }
    ]);

    const [window] = buildChatWindows(messages, { windowSeconds: 10 });

    expect(window).toMatchObject({
      start_seconds: 0,
      end_seconds: 10,
      message_count: 4,
      unique_users: 4,
      messages_per_minute: 24
    });
    expect(window.emote_counts).toEqual({ KEKW: 1 });
    expect(window.representative_messages).toContain("clipni to");
    expect(window).not.toHaveProperty("usernames");
    expect(window.activity_score).toBeGreaterThan(20);
  });

  it("caps one-user flooding and repeated identical messages", () => {
    const base = Date.parse("2026-06-28T15:49:43Z");
    const input = Array.from({ length: 20 }, (_, index) => ({
      content: "SPAM",
      createdAt: new Date(base + index * 100).toISOString(),
      username: "same-user"
    }));
    const [window] = buildChatWindows(normalizeKickChat(input), { windowSeconds: 10 });

    expect(window.message_count).toBeLessThanOrEqual(3);
    expect(window.unique_users).toBe(1);
    expect(window.activity_score).toBeLessThan(20);
  });
});
