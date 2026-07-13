export type NormalizedKickChatMessage = {
  timestamp_seconds: number;
  username: string;
  message: string;
  emotes: string[];
};

export type KickChatWindow = {
  start_seconds: number;
  end_seconds: number;
  message_count: number;
  unique_users: number;
  messages_per_minute: number;
  emote_counts: Record<string, number>;
  representative_messages: string[];
  activity_score: number;
};

export function normalizeKickChat(input: unknown, options?: { offsetSeconds?: number }): NormalizedKickChatMessage[];
export function buildChatWindows(messages: NormalizedKickChatMessage[], options?: { windowSeconds?: number }): KickChatWindow[];
