import type { FastifyInstance } from "fastify";

export type LocalUploadRecord = {
  videoId: string;
  title: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number;
  sourceStorageProvider: "local";
  sourceStoragePath: string;
  chatStoragePath: string | null;
  normalizedChatStoragePath: string | null;
  chatMessageCount: number;
  chatOffsetSeconds: number;
};

export function buildLocalAgent(options: {
  storageRoot: string;
  agentToken: string;
  allowedOrigins?: string[];
  maxUploadBytes: number;
  createUploadRecords(record: LocalUploadRecord): Promise<void>;
  toolChecks(): Promise<{ ffmpeg: boolean; ffprobe: boolean; openai: boolean }>;
}): Promise<FastifyInstance>;
