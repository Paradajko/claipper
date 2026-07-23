import type {
  CampaignAutomaticMetadata,
  CampaignSource,
  SourceCollectionState,
  SourceCollectionStatus,
  SourceMetrics
} from "../lib/campaign-analyzer/types";

export function buildCampaignMetadataArgs(url: string): string[];

export function parseCampaignMetadata(
  value: unknown,
  options: { source: CampaignSource; now?: Date }
): SourceMetrics;

export function parseCampaignMetadataCommandResult(options: {
  stdout?: string;
  error?: Error & { stdout?: string };
}): unknown;

export function safeCampaignSourceError(error: unknown): string;

export type CampaignSourceResult = {
  source: CampaignSource;
  status: Exclude<SourceCollectionStatus, "pending">;
  metrics: SourceMetrics | null;
  error: string | null;
  technicalError: string | null;
};

export function mergeCampaignSourceResult(options: {
  automaticMetadata: CampaignAutomaticMetadata;
  sourceStatuses: Partial<Record<CampaignSource, SourceCollectionState>>;
  result: CampaignSourceResult;
  collectedAt: string;
}): {
  automaticMetadata: CampaignAutomaticMetadata;
  sourceStatuses: Partial<Record<CampaignSource, SourceCollectionState>>;
};
