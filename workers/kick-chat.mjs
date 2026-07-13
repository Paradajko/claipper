const EMOTE_PATTERN = /\[emote:\d+:([^\]]+)]/gi;
const PROMO_PATTERNS = [
  /chat\s+commands?/i,
  /check\s+bonuses?/i,
  /monthly\s+wager/i,
  /leaderboard/i,
  /https?:\/\//i
];
const REACTION_PATTERN = /\b(?:clip|clipni|kekw|lol|xd|w|l|coze|čože|wtf|omg)\b/i;

export function normalizeKickChat(input, { offsetSeconds = 0 } = {}) {
  if (!Array.isArray(input)) throw new Error("Kick chat export must be an array.");
  const offset = Number(offsetSeconds);
  if (!Number.isFinite(offset)) throw new Error("Chat offset must be a finite number.");

  const parsed = input
    .map(parseRawMessage)
    .filter((message) => message !== null)
    .sort((first, second) => first.createdAtMs - second.createdAtMs);
  if (parsed.length === 0) return [];
  const firstTimestamp = parsed[0].createdAtMs;

  return parsed
    .filter((message) => !isPromotionalMessage(message.rawContent))
    .map((message) => ({
      timestamp_seconds: roundMilliseconds((message.createdAtMs - firstTimestamp) / 1000 + offset),
      username: message.username,
      message: message.message,
      emotes: message.emotes
    }));
}

export function buildChatWindows(messages, { windowSeconds = 10 } = {}) {
  const size = Number(windowSeconds);
  if (!Number.isFinite(size) || size <= 0) throw new Error("Chat window must be a positive number.");
  const grouped = new Map();

  for (const message of messages ?? []) {
    const timestamp = Number(message?.timestamp_seconds);
    if (!Number.isFinite(timestamp) || timestamp < 0 || !String(message?.message ?? "").trim()) continue;
    const start = Math.floor(timestamp / size) * size;
    const entries = grouped.get(start) ?? [];
    entries.push(message);
    grouped.set(start, entries);
  }

  return [...grouped.entries()]
    .sort(([first], [second]) => first - second)
    .map(([start, entries]) => summarizeWindow(start, size, entries));
}

function parseRawMessage(value) {
  if (!value || typeof value !== "object") return null;
  const rawContent = String(value.content ?? "").replace(/\s+/g, " ").trim();
  const createdAtMs = Date.parse(String(value.createdAt ?? ""));
  if (!rawContent || !Number.isFinite(createdAtMs)) return null;
  const emotes = [...rawContent.matchAll(EMOTE_PATTERN)].map((match) => match[1]).filter(Boolean);
  const message = rawContent.replace(EMOTE_PATTERN, (_, name) => ` ${name} `).replace(/\s+/g, " ").trim();
  if (!message) return null;
  return {
    rawContent,
    createdAtMs,
    username: String(value.username ?? "unknown").trim() || "unknown",
    message,
    emotes
  };
}

function isPromotionalMessage(message) {
  return PROMO_PATTERNS.some((pattern) => pattern.test(message));
}

function summarizeWindow(start, size, entries) {
  const accepted = [];
  const perUser = new Map();
  const perMessage = new Map();
  for (const entry of entries.sort((first, second) => first.timestamp_seconds - second.timestamp_seconds)) {
    const userKey = String(entry.username ?? "unknown").toLowerCase();
    const messageKey = normalizeMessageKey(entry.message);
    const userCount = perUser.get(userKey) ?? 0;
    const duplicateCount = perMessage.get(messageKey) ?? 0;
    if (userCount >= 3 || duplicateCount >= 5) continue;
    accepted.push(entry);
    perUser.set(userKey, userCount + 1);
    perMessage.set(messageKey, duplicateCount + 1);
  }

  const uniqueUsers = new Set(accepted.map((entry) => String(entry.username ?? "unknown").toLowerCase())).size;
  const emoteCounts = {};
  for (const entry of accepted) {
    for (const emote of entry.emotes ?? []) emoteCounts[emote] = (emoteCounts[emote] ?? 0) + 1;
  }
  const representativeMessages = [...new Set(accepted.map((entry) => String(entry.message).trim()))]
    .sort((first, second) => reactionPriority(second) - reactionPriority(first))
    .slice(0, 5);
  const reactionCount = accepted.filter((entry) => REACTION_PATTERN.test(String(entry.message))).length;
  const emoteCount = Object.values(emoteCounts).reduce((sum, count) => sum + count, 0);
  const activityScore = clampScore(accepted.length * 1.5 + uniqueUsers * 4 + emoteCount * 1.5 + reactionCount * 3);

  return {
    start_seconds: start,
    end_seconds: start + size,
    message_count: accepted.length,
    unique_users: uniqueUsers,
    messages_per_minute: Math.round(accepted.length * (60 / size)),
    emote_counts: emoteCounts,
    representative_messages: representativeMessages,
    activity_score: activityScore
  };
}

function normalizeMessageKey(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function reactionPriority(value) {
  return REACTION_PATTERN.test(value) ? 1 : 0;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundMilliseconds(value) {
  return Math.round(value * 1000) / 1000;
}
