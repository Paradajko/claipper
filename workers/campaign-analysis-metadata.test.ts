import { describe, expect, it } from "vitest";
import type { SourceMetrics } from "../lib/campaign-analyzer/types";
import {
  buildCampaignMetadataArgs,
  mergeCampaignSourceResult,
  parseCampaignMetadata,
  safeCampaignSourceError
} from "./campaign-analysis-metadata.mjs";

const now = new Date("2026-07-21T12:00:00Z");

function sourceMetrics(itemCount: number, medianViews: number): SourceMetrics {
  return {
    item_count: itemCount,
    total_duration_seconds: null,
    average_views: medianViews,
    median_views: medianViews,
    top_views: medianViews,
    sample_size: itemCount,
    shorts_median_views: null,
    shorts_sample_size: 0
  };
}

describe("campaign metadata", () => {
  it("builds metadata-only yt-dlp arguments", () => {
    const args = buildCampaignMetadataArgs("https://youtube.com/@creator");
    expect(args).toContain("--skip-download");
    expect(args).toContain("--dump-single-json");
    expect(args).toContain("--playlist-end");
    expect(args).not.toContain("--output");
    expect(args.join(" ")).not.toMatch(/--format|write-thumbnail|write-subs/);
  });

  it("uses only dated entries in the trailing 30-day UTC window", () => {
    const value = { entries: [
      { id: "a", timestamp: now.getTime() / 1000 - 86400, duration: 120, view_count: 1000, webpage_url: "https://youtube.com/shorts/a" },
      { id: "b", upload_date: "20260625", duration: 600, view_count: 3000 },
      { id: "old", upload_date: "20260501", duration: 60, view_count: 999999 },
      { id: "unknown", duration: 60, view_count: 999999 }
    ] };
    const result = parseCampaignMetadata(value, { source: "youtube", now });
    expect(result.item_count).toBe(2);
    expect(result.total_duration_seconds).toBe(720);
    expect(result.average_views).toBe(2000);
    expect(result.median_views).toBe(2000);
    expect(result.top_views).toBe(3000);
    expect(result.shorts_median_views).toBe(1000);
  });

  it("treats a YouTube item as a Short by URL or duration at most 180 seconds", () => {
    const value = { entries: [
      { timestamp: now.getTime() / 1000, duration: 181, view_count: 100, webpage_url: "https://youtube.com/shorts/a" },
      { timestamp: now.getTime() / 1000, duration: 180, view_count: 300, webpage_url: "https://youtube.com/watch?v=b" }
    ] };
    expect(parseCampaignMetadata(value, { source: "youtube", now }).shorts_median_views).toBe(200);
  });

  it("walks nested entries and excludes malformed upload dates", () => {
    const value = { entries: [{ entries: [
      { upload_date: "20260720", duration: 90, view_count: 500, is_short: true },
      { upload_date: "2026-07-20", duration: 90, view_count: 9999 }
    ] }] };
    const result = parseCampaignMetadata(value, { source: "clipper", now });
    expect(result.item_count).toBe(1);
    expect(result.shorts_median_views).toBe(500);
  });

  it("returns a concise source error without command output", () => {
    expect(safeCampaignSourceError(new Error("HTTP Error 403 with cookie=secret"))).toBe("Zdrojové metadáta sa nepodarilo načítať.");
  });

  it("retains failed source metrics as stale while replacing successful metrics", () => {
    const previousYouTube = sourceMetrics(5, 1200);
    const kickMetrics = sourceMetrics(7, 2400);
    const initial = {
      automaticMetadata: { youtube: previousYouTube, kick: sourceMetrics(1, 100) },
      sourceStatuses: {}
    };
    const afterYouTube = mergeCampaignSourceResult({
      ...initial,
      result: {
        source: "youtube",
        status: "failed",
        metrics: null,
        error: "Zdrojové metadáta sa nepodarilo načítať.",
        technicalError: "HTTP Error 403"
      },
      collectedAt: "2026-07-21T12:00:00.000Z"
    });
    const afterKick = mergeCampaignSourceResult({
      ...afterYouTube,
      result: { source: "kick", status: "completed", metrics: kickMetrics, error: null, technicalError: null },
      collectedAt: "2026-07-21T12:01:00.000Z"
    });

    expect(afterKick.automaticMetadata.youtube).toEqual(previousYouTube);
    expect(afterKick.sourceStatuses.youtube).toMatchObject({ status: "failed", stale: true });
    expect(afterKick.automaticMetadata.kick).toEqual(kickMetrics);
    expect(afterKick.sourceStatuses.kick).toEqual({
      status: "completed",
      error: null,
      collected_at: "2026-07-21T12:01:00.000Z",
      stale: false
    });
  });

  it("marks an omitted Clipper source as not provided without a failure", () => {
    const previousClipper = sourceMetrics(4, 800);
    const result = mergeCampaignSourceResult({
      automaticMetadata: { clipper: previousClipper },
      sourceStatuses: {},
      result: { source: "clipper", status: "not_provided", metrics: null, error: null, technicalError: null },
      collectedAt: "2026-07-21T12:00:00.000Z"
    });

    expect(result.sourceStatuses.clipper).toEqual({
      status: "not_provided",
      error: null,
      collected_at: null,
      stale: false
    });
    expect(result.sourceStatuses.clipper?.status).not.toBe("failed");
    expect(result.automaticMetadata.clipper).toBeUndefined();
  });

  it("keeps three failed sources as three separate safe statuses", () => {
    let state = { automaticMetadata: {}, sourceStatuses: {} };
    for (const source of ["youtube", "kick", "clipper"] as const) {
      state = mergeCampaignSourceResult({
        ...state,
        result: {
          source,
          status: "failed",
          metrics: null,
          error: "Zdrojové metadáta sa nepodarilo načítať.",
          technicalError: `${source} secret failure`
        },
        collectedAt: "2026-07-21T12:00:00.000Z"
      });
    }

    expect(Object.values(state.sourceStatuses)).toHaveLength(3);
    expect(Object.values(state.sourceStatuses)).toEqual([
      expect.objectContaining({ status: "failed", error: "Zdrojové metadáta sa nepodarilo načítať." }),
      expect.objectContaining({ status: "failed", error: "Zdrojové metadáta sa nepodarilo načítať." }),
      expect.objectContaining({ status: "failed", error: "Zdrojové metadáta sa nepodarilo načítať." })
    ]);
  });

  it("does not add downloaded paths or media bytes to merged results", () => {
    const result = mergeCampaignSourceResult({
      automaticMetadata: {},
      sourceStatuses: {},
      result: {
        source: "youtube",
        status: "completed",
        metrics: sourceMetrics(1, 500),
        error: null,
        technicalError: null
      },
      collectedAt: "2026-07-21T12:00:00.000Z"
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/downloadedPath|file_path|storage_path|media_bytes|buffer/i);
  });
});
