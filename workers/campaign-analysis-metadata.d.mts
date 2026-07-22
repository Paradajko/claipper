import type { CampaignSource, SourceMetrics } from "../lib/campaign-analyzer/types";

export function buildCampaignMetadataArgs(url: string): string[];

export function parseCampaignMetadata(
  value: unknown,
  options: { source: CampaignSource; now?: Date }
): SourceMetrics;

export function safeCampaignSourceError(error: unknown): string;
