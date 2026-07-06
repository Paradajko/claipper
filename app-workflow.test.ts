import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("AI-first app workflow naming", () => {
  it("uses the requested English sidebar items", () => {
    const shell = read("components/ui.tsx");

    for (const label of ["Dashboard", "MyLaura Brief", "Content Lab", "Clips", "Schedule", "Reports", "Settings"]) {
      expect(shell).toContain(`label: "${label}"`);
    }

    for (const mobileLabel of ["Dashboard", "Brief", "Lab", "Clips", "More"]) {
      expect(shell).toContain(`mobileLabel: "${mobileLabel}"`);
    }

    expect(shell).toContain("MobileBottomNav");
    expect(shell).toContain("md:hidden");
    expect(shell).toContain("Production workspace");
    expect(shell).toContain("pb-28");

    expect(shell).not.toContain("Zdroje");
    expect(shell).not.toContain("Reporty");
    expect(shell).not.toContain("Sources");
  });

  it("frames the dashboard around the AI clipping workflow", () => {
    const dashboard = read("app/app/page.tsx");

    expect(dashboard).toContain("Start with context. Finish with clips.");
    expect(dashboard).toContain("Brief / Content");
    expect(dashboard).toContain("AI Analysis");
    expect(dashboard).toContain("Clip Ideas");
    expect(dashboard).toContain("Production");
    expect(dashboard).toContain("Reports");
    expect(dashboard).toContain("Start with MyLaura Brief");
    expect(dashboard).toContain("Start with Content");
    expect(dashboard).toContain("Goal found");
    expect(dashboard).toContain("Tone found");
    expect(dashboard).toContain("CTA found");
    expect(dashboard).toContain("Angles ready");
    expect(dashboard).toContain("Video source");
    expect(dashboard).toContain("Transcript");
    expect(dashboard).toContain("Moments found");
    expect(dashboard).toContain("Content Runs");
    expect(dashboard).toContain("Ready Clips");
    expect(dashboard).toContain("Recent analyses");
    expect(dashboard).toContain("No analyses yet.");
    expect(dashboard).toContain("order-1");
    expect(dashboard).toContain("order-2");
    expect(dashboard).toContain("order-3");
    expect(dashboard).toContain("order-4");
    expect(dashboard).not.toContain("Operator dashboard");
    expect(dashboard).not.toContain("MyLaura Brief → Content Lab → Clips → Schedule → Reports");
  });

  it("keeps Content Lab simple and AI-first", () => {
    const contentLab = read("app/app/content-lab/page.tsx");
    const ingest = read("components/content-lab-ingest.tsx");

    expect(contentLab).toContain("Content Lab");
    expect(contentLab).toContain("Add a video link or upload long-form content. Claipper will analyze it and turn it into clip ideas.");
    expect(contentLab).toContain("directly to Supabase Storage");
    expect(ingest).toContain("Upload video");
    expect(ingest).toContain("Import from link");
    expect(ingest).toContain("Platform link");
    expect(ingest).toContain("Upload and queue scan");
    expect(ingest).toContain("Import with worker");

    for (const manualField of ["Duration seconds", "Transcript"]) {
      expect(contentLab).not.toContain(manualField);
    }
  });

  it("lets users generate a ready vertical clip next to the draft action", () => {
    const detailPage = read("app/app/content-lab/[id]/page.tsx");
    const readyRoute = read("app/api/stream-scan/clip-ideas/[id]/ready-clip/route.ts");

    expect(detailPage).toContain("Generate Draft");
    expect(detailPage).toContain("Generate Ready Clip");
    expect(detailPage).toContain("/ready-clip");
    expect(detailPage).toContain("Download");
    expect(readyRoute).toContain('job_type: "render_ready_clip"');
    expect(readyRoute).toContain('type: "ready"');
    expect(readyRoute).toContain("storageBuckets.clips");
  });

  it("has the Railway worker render ready clips as 9:16 MP4s with hook and subtitle support", () => {
    const worker = read("workers/stream-scan-worker.mjs");

    expect(worker).toContain('job.job_type === "render_ready_clip"');
    expect(worker).toContain("processRenderReadyClip");
    expect(worker).toContain("1080:1920");
    expect(worker).toContain("drawtext");
    expect(worker).toContain("between(t,0,3)");
    expect(worker).toContain("subtitles=");
    expect(worker).toContain("loadTranscriptSegments");
    expect(worker).toContain("buildSubtitleFile");
    expect(worker).toContain("buckets.clips");
    expect(worker).toContain("video/mp4");
  });

  it("sets the MVP direct upload limit to 1000 MB and explains bucket-limit failures", () => {
    const config = read("lib/stream-scan-config.ts");
    const ingest = read("components/content-lab-ingest.tsx");
    const bucketMigration = read("supabase/migrations/005_mvp_upload_limit.sql");
    const envExample = read(".env.example");

    expect(config).toContain("MVP_UPLOAD_LIMIT_MB = 1000");
    expect(config).toContain("MAX_UPLOAD_SIZE_MB ?? String(MVP_UPLOAD_LIMIT_MB)");
    expect(ingest).toContain("Current upload limit: {maxSizeMb} MB");
    expect(ingest).toContain("Supabase Storage is still capped below this file size");
    expect(bucketMigration).toContain("file_size_limit = 1048576000");
    expect(bucketMigration).toContain("where id = 'original-videos'");
    expect(envExample).toContain("MAX_UPLOAD_SIZE_MB=1000");
    expect(envExample).toContain("NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB=1000");
  });

  it("defines MyLaura Brief as a simple campaign-context analyzer", () => {
    const brief = read("app/app/mylaura-brief/page.tsx");

    expect(brief).toContain("MyLaura Brief");
    expect(brief).toContain("MyLaura campaign URL");
    expect(brief).toContain("Analyze Brief");
    for (const output of ["Goal", "Audience", "Tone", "CTA", "Content rules", "Recommended clip angles"]) {
      expect(brief).toContain(output);
    }
  });

  it("keeps clip ideas inside the Clips page tabs", () => {
    const clips = read("app/app/clips/page.tsx");
    const shell = read("components/ui.tsx");

    expect(clips).toContain("Ideas");
    expect(clips).toContain("Production");
    expect(clips).toContain("Selected");
    expect(clips).toContain("Editing");
    expect(clips).toContain("Ready");
    expect(clips).toContain("Scheduled");
    expect(clips).toContain("Posted");
    expect(clips).toContain("timestamp range");
    expect(clips).toContain("campaign relevance");
    expect(clips).toContain("Create Clip");
    expect(clips).not.toContain("Kanban production board");
    expect(shell).not.toContain("Clip Ideas");
  });

  it("uses mobile card layouts for schedule and settings instead of forcing wide rows", () => {
    const schedule = read("app/app/schedule/page.tsx");
    const settings = read("app/app/settings/page.tsx");

    expect(schedule).toContain("md:hidden");
    expect(schedule).toContain("Scheduled post");
    expect(schedule).toContain("hidden md:block");
    expect(settings).toContain("break-all");
    expect(settings).toContain("sm:flex-row");
  });
});
