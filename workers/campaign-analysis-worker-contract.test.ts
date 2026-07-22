import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("workers/stream-scan-worker.mjs", "utf8");

describe("campaign analysis worker integration", () => {
  it("dispatches campaign jobs through the existing worker", () => {
    expect(worker).toContain('job.job_type === "campaign_analysis"');
    expect(worker).toContain("processCampaignAnalysis(job)");
    expect(worker).toContain("campaign_analysis_id");
  });

  it("uses metadata-only yt-dlp and no media pipeline", () => {
    expect(worker).toContain("buildCampaignMetadataArgs");
    expect(worker).toContain("parseCampaignMetadata");
    expect(worker).not.toContain("processCampaignAnalysis(job, { download");
  });

  it("isolates all three source attempts and preserves stale data", () => {
    for (const source of ["youtube", "kick", "clipper"]) expect(worker).toContain(`source: "${source}"`);
    expect(worker).toContain("collectCampaignSource");
    expect(worker).toContain("previousAutomaticMetadata");
    expect(worker).toContain("stale: true");
    expect(worker).toContain("Hotovo s upozornením");
  });

  it("surfaces job persistence failures and fails campaign rows on job-level errors", () => {
    expect(worker).toContain("jobUpdateError");
    expect(worker).toMatch(/async function updateJob[\s\S]*if \(jobUpdateError\) throw new Error\(jobUpdateError\.message\)/);
    expect(worker).toMatch(/async function failJob[\s\S]*job\.raw_data\?\.campaign_analysis_id[\s\S]*\.from\("campaign_analyses"\)[\s\S]*status: "failed"/);
  });
});
