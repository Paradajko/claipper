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

  it("frames the dashboard as a focused clipping start page", () => {
    const dashboard = read("app/app/page.tsx");

    expect(dashboard).toContain("Find clips in minutes.");
    expect(dashboard).toContain("Upload a long video, paste a link, or start from campaign context.");
    expect(dashboard).toContain("Upload content");
    expect(dashboard).toContain("Start from brief");
    expect(dashboard).toContain("Clip Ideas");
    expect(dashboard).toContain("Content Runs");
    expect(dashboard).toContain("Ready Clips");
    expect(dashboard).toContain("Recent analyses");
    expect(dashboard).toContain("No analyses yet.");
    expect(dashboard).toContain("clip-start-hero");
    expect(dashboard).toContain("clip-action-card");
    expect(dashboard.indexOf("Upload content")).toBeLessThan(dashboard.indexOf("Start from brief"));
    expect(dashboard).not.toContain("moment-radar-hero");
    expect(dashboard).not.toContain("moment-radar-visual");
    expect(dashboard).not.toContain("radar-sweep");
    expect(dashboard).not.toContain("Operator dashboard");
    expect(dashboard).not.toContain("MyLaura Brief → Content Lab → Clips → Schedule → Reports");
    expect(dashboard).not.toContain("Brief / Content");
    expect(dashboard).not.toContain("AI Analysis");
  });

  it("keeps Content Lab simple and AI-first", () => {
    const contentLab = read("app/app/content-lab/page.tsx");
    const ingest = read("components/content-lab-ingest.tsx");

    expect(contentLab).toContain("Content Lab");
    expect(contentLab).toContain("Upload content to find clips.");
    expect(contentLab).toContain("Start with a video file or paste a link. Claipper will surface the strongest moments.");
    expect(contentLab).toContain("content-lab-upload-shell");
    expect(contentLab).toContain("WorkerStatusStrip");
    expect(ingest).toContain("Upload video");
    expect(ingest).toContain("Paste link");
    expect(ingest).toContain("Platform link");
    expect(ingest).toContain("Drop a video here");
    expect(ingest).toContain("Start analysis");
    expect(ingest).toContain("Analyze link");

    for (const manualField of ["Duration seconds", "Transcript", "directly to Supabase Storage", "queue a YouTube"]) {
      expect(contentLab).not.toContain(manualField);
    }
  });

  it("keeps Dashboard and Content Lab green, premium and uncluttered", () => {
    const dashboard = read("app/app/page.tsx");
    const contentLab = read("app/app/content-lab/page.tsx");
    const ingest = read("components/content-lab-ingest.tsx");
    const css = read("app/globals.css");

    expect(dashboard).toContain("clip-start-hero");
    expect(dashboard).toContain("Find clips in minutes.");
    expect(dashboard).toContain("Upload content");
    expect(dashboard).toContain("Start from brief");
    expect(dashboard).not.toContain("animated-flow-line");
    expect(dashboard).not.toContain("moment-radar-visual");
    expect(dashboard).not.toContain("Start with context. Finish with clips.");
    expect(dashboard).toContain("premium-hover");
    expect(dashboard).toContain("Recent analyses");
    expect(dashboard.indexOf("Upload content")).toBeLessThan(dashboard.indexOf("Start from brief"));
    expect(contentLab).toContain("WorkerStatusStrip");
    expect(contentLab).toContain("content-lab-upload-shell");
    expect(contentLab).not.toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
    expect(contentLab).toContain("Recent analyses");
    expect(ingest).toContain("min-h-44");
    expect(ingest).toContain("content-lab-dropzone");
    expect(css).toContain("@keyframes ambient-shift");
    expect(css).toContain(".premium-hover");
    for (const source of [dashboard, contentLab]) {
      expect(source).not.toContain("cyan");
      expect(source).not.toContain("blue");
    }
  });

  it("lets users export one clear vertical clip with optional captions", () => {
    const detailPage = read("app/app/content-lab/[id]/page.tsx");
    const reviewClient = read("components/moment-review-client.tsx");
    const readyRoute = read("app/api/stream-scan/clip-ideas/[id]/ready-clip/route.ts");
    const worker = read("workers/stream-scan-worker.mjs");

    expect(reviewClient).toContain("Export 9:16 Clip");
    expect(reviewClient).toContain("Add captions");
    expect(reviewClient).toContain("/ready-clip");
    expect(reviewClient).toContain('name="addCaptions"');
    expect(reviewClient).toContain("formatCaptionMode");
    expect(reviewClient).toContain("optimisticExportIdeaIds");
    expect(reviewClient).toContain("Exporting...");
    expect(reviewClient).toContain("exportStatus");
    expect(reviewClient).toContain("handleExportSubmit");
    expect(reviewClient).toContain("Download");
    expect(reviewClient).not.toContain("Render Ready MP4");
    expect(reviewClient).not.toContain("/draft");
    expect(detailPage).not.toContain("Generate Draft");
    expect(readyRoute).toContain("await request.formData()");
    expect(readyRoute).toContain("add_captions: addCaptions");
    expect(readyRoute).toContain("add_hook_overlay: false");
    expect(readyRoute).toContain('job_type: "render_ready_clip"');
    expect(readyRoute).toContain('type: "ready"');
    expect(readyRoute).toContain("storageBuckets.clips");
    expect(worker).toContain("shouldAddCaptions");
    expect(worker).toContain("clip.raw_data?.add_captions === true");
    expect(worker).toContain("buildReadyClipFilters({ subtitlePath })");
  });

  it("presents the video detail page as a clean Moment Review workspace with live updates", () => {
    const detailPage = read("app/app/content-lab/[id]/page.tsx");
    const reviewClient = read("components/moment-review-client.tsx");
    const videoRoute = read("app/api/stream-scan/videos/[id]/route.ts");

    expect(detailPage).toContain("Moment Review");
    expect(detailPage).toContain("MomentReviewClient");
    expect(detailPage).toContain('dynamic = "force-dynamic"');
    expect(reviewClient).toContain("Moment Review");
    expect(reviewClient).toContain("Found moments");
    expect(reviewClient).toContain("Best moments");
    expect(reviewClient).toContain("Run Analysis Again");
    expect(reviewClient).toContain("handleAnalyzeSubmit");
    expect(reviewClient).toContain("analysisJob");
    expect(reviewClient).toContain("optimisticAnalysis");
    expect(reviewClient).toContain("analysisProgress");
    expect(reviewClient).toContain("Export 9:16 Clip");
    expect(reviewClient).toContain("setInterval");
    expect(reviewClient).toContain("2500");
    expect(reviewClient).toContain(`/api/stream-scan/videos/$`);
    expect(reviewClient).toContain("setSnapshot");
    expect(reviewClient).toContain("shouldPoll");
    expect(reviewClient).toContain("hasActiveExport");
    expect(reviewClient).toContain("hasActiveAnalysis");
    expect(videoRoute).toContain("export async function GET");
    expect(videoRoute).toContain("getStreamVideo");
    expect(videoRoute).toContain("getLatestWorkerHeartbeat");
    expect(videoRoute).toContain("createStorageSignedUrl");
    expect(read("app/api/stream-scan/videos/[id]/process/route.ts")).toContain('job_type", "analyze_video"');
    expect(read("app/api/stream-scan/videos/[id]/process/route.ts")).toContain(".in(\"status\", [\"queued\", \"running\"])");
    expect(read("app/api/stream-scan/videos/[id]/process/route.ts")).toContain('from("clip_ideas").delete().eq("video_id", id)');
    expect(read("app/api/stream-scan/videos/[id]/process/route.ts")).toContain('revalidatePath(`/app/content-lab/${id}`)');
    expect(reviewClient).toContain("Why it works");
    expect(reviewClient).toContain("Hook");
    expect(reviewClient).toContain("Caption");
    expect(reviewClient).toContain("moment_finder_version");
    expect(reviewClient).toContain("retention_risk");
    expect(reviewClient).toContain("recut_suggestion");
    expect(reviewClient).toContain("formatMomentVersion");
    expect(reviewClient).toContain("recommendationClass");
    expect(reviewClient).toContain("idea, index");
    expect(detailPage).toContain("Uploaded");
    expect(detailPage).toContain("Audio");
    expect(detailPage).toContain("Transcript");
    expect(detailPage).toContain("Analysis");
    expect(detailPage).toContain("Ranked");
    expect(detailPage).toContain("Ready");
    expect(reviewClient).toContain("mx-auto max-w-6xl");
    expect(reviewClient).toContain("StatusProgressPanel");
    expect(reviewClient).toContain("exportStatus={exportStatus");
    expect(reviewClient.indexOf("Best moments")).toBeLessThan(reviewClient.indexOf("<RenderedClipsCard"));
    expect(reviewClient).not.toContain("lg:grid-cols-[minmax(250px,0.42fr)_minmax(0,1.58fr)]");
    expect(reviewClient).not.toContain("<aside");
    expect(reviewClient).not.toContain("Clip Review");
    expect(reviewClient).not.toContain("AI-selected clip ideas");
    expect(reviewClient).not.toContain("Ranked moments");
    expect(reviewClient).not.toContain("Run Stream Scan again");
    expect(reviewClient).not.toContain("Developer debug");
  });

  it("logs v2.1 moment finder candidate counts in the worker", () => {
    const worker = read("workers/stream-scan-worker.mjs");

    expect(worker).toContain('MOMENT_FINDER_VERSION = "v2.1"');
    expect(worker).toContain("local candidates found");
    expect(worker).toContain("final ranked candidates");
    expect(worker).toContain("moment_finder_version");
  });

  it("has the Railway worker render ready clips as faster 720p 9:16 MP4s with hook and subtitle support", () => {
    const worker = read("workers/stream-scan-worker.mjs");

    expect(worker).toContain('job.job_type === "render_ready_clip"');
    expect(worker).toContain("processRenderReadyClip");
    expect(worker).toContain("720:1280");
    expect(worker).not.toContain("1080:1920");
    expect(worker).toContain("\"-hide_banner\"");
    expect(worker).toContain("\"-loglevel\"");
    expect(worker).toContain("\"error\"");
    expect(worker).toContain("add_captions");
    expect(worker).not.toContain("buildHookTextFile");
    expect(worker).not.toContain("textfile='");
    expect(worker).not.toContain("drawtext=text=");
    expect(worker).not.toContain("between(t\\\\,0\\\\,3)");
    expect(worker).toContain("subtitles=");
    expect(worker).toContain("loadSubtitleSegments");
    expect(worker).toContain("loadFineTranscriptSegments");
    expect(worker).toContain("buildSubtitleFile");
    expect(worker).toContain("MAX_SUBTITLE_WORDS = 3");
    expect(worker).toContain("buildSubtitleCues");
    expect(worker).toContain("refineReadyClipTiming");
    expect(worker).toContain("20-60 seconds");
    expect(worker).toContain("avoid irrelevant intro");
    expect(worker).toContain("clear sentence/payoff");
    expect(worker).toContain("segments_json");
    expect(worker).toContain("MarginV=220");
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

  it("provides an explicit development-only stream scan reset script", () => {
    const packageJson = read("package.json");
    const resetScript = read("scripts/dev-reset-stream-scan.mjs");

    expect(packageJson).toContain('"dev:reset-stream-scan": "node scripts/dev-reset-stream-scan.mjs"');
    expect(resetScript).toContain("DEVELOPMENT/TESTING ONLY");
    expect(resetScript).toContain("--confirm");
    expect(resetScript).toContain("SUPABASE_SERVICE_ROLE_KEY");
    for (const table of ["clips", "clip_ideas", "transcript_segments", "transcripts", "processing_jobs", "video_imports", "videos", "scheduled_posts", "source_videos"]) {
      expect(resetScript).toContain(`"${table}"`);
    }
    for (const bucket of ["original-videos", "extracted-audio", "rendered-clips", "subtitles"]) {
      expect(resetScript).toContain(`"${bucket}"`);
    }
    expect(resetScript).toContain("deleteStorageBucketContents");
    expect(resetScript).toContain("deleteTableRows");
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
