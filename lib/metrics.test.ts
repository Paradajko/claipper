import { describe, expect, it } from "vitest";
import { getDashboardMetrics, getPlatformBreakdown, getTopClips } from "@/lib/metrics";
import type { ClipWithSchedule, ScheduledPost, SourceVideo } from "@/lib/types";

const sources: SourceVideo[] = [
  {
    id: "s1",
    created_at: "2026-07-04T08:00:00.000Z",
    title: "Source",
    source_url: null,
    platform: "YouTube",
    duration_seconds: 100,
    transcript: null,
    mylaura_campaign_name: null,
    mylaura_campaign_url: null,
    client_name: null,
    status: "new",
    notes: null,
    raw_data: null
  }
];

const posts: ScheduledPost[] = [
  {
    id: "p1",
    created_at: "2026-07-04T08:00:00.000Z",
    clip_id: "c2",
    platform: "TikTok",
    target_account: "@one",
    scheduled_at: "2026-07-04T18:00:00.000Z",
    published_at: null,
    post_url: null,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    status: "scheduled",
    notes: null
  },
  {
    id: "p2",
    created_at: "2026-07-03T08:00:00.000Z",
    clip_id: "c1",
    platform: "Instagram Reels",
    target_account: "@two",
    scheduled_at: "2026-07-03T18:00:00.000Z",
    published_at: "2026-07-03T18:00:00.000Z",
    post_url: "https://example.com/post",
    views: 1200,
    likes: 100,
    comments: 10,
    shares: 5,
    status: "posted",
    notes: null
  }
];

const clips: ClipWithSchedule[] = [
  { id: "c1", created_at: "2026-07-03T08:00:00.000Z", source_video_id: "s1", title: "Posted", start_seconds: null, end_seconds: null, duration_seconds: 30, hook: "A", caption: null, hashtags: null, cta: null, content_type: null, score: 80, status: "posted", exported_video_url: null, target_platforms: ["Instagram Reels"], mylaura_campaign_name: null, notes: null, raw_data: null, scheduled_posts: [posts[1]] },
  { id: "c2", created_at: "2026-07-04T08:00:00.000Z", source_video_id: "s1", title: "Ready", start_seconds: null, end_seconds: null, duration_seconds: 20, hook: "B", caption: null, hashtags: null, cta: null, content_type: null, score: 90, status: "ready", exported_video_url: null, target_platforms: ["TikTok"], mylaura_campaign_name: null, notes: null, raw_data: null, scheduled_posts: [posts[0]] }
];

describe("metrics", () => {
  it("summarizes dashboard work without campaign ownership logic", () => {
    const metrics = getDashboardMetrics(sources, clips, posts, new Date("2026-07-04T09:00:00.000Z"));

    expect(metrics.sourceVideosCount).toBe(1);
    expect(metrics.clipsByStatus.ready).toBe(1);
    expect(metrics.clipsByStatus.posted).toBe(1);
    expect(metrics.scheduledPosts).toBe(1);
    expect(metrics.publishedPosts).toBe(1);
    expect(metrics.totalViews).toBe(1200);
    expect(metrics.todaysTasks[0]).toEqual({ label: "Publikovať", detail: "TikTok · @one" });
  });

  it("orders top clips by post views, then score", () => {
    expect(getTopClips(clips).map((clip) => clip.id)).toEqual(["c1", "c2"]);
  });

  it("groups platform performance by publishing surface", () => {
    expect(getPlatformBreakdown(posts)).toEqual([
      { platform: "Instagram Reels", posts: 1, views: 1200 },
      { platform: "TikTok", posts: 1, views: 0 }
    ]);
  });
});
