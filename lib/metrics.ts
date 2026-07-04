import { clipStatuses, type ClipStatus, type ClipWithSchedule, type ScheduledPost, type SourceVideo } from "@/lib/types";

export type DashboardMetrics = {
  sourceVideosCount: number;
  clipsByStatus: Record<ClipStatus, number>;
  scheduledPosts: number;
  publishedPosts: number;
  totalViews: number;
  todaysTasks: Array<{ label: string; detail: string }>;
};

export function getClipsByStatus(clips: ClipWithSchedule[]) {
  return clipStatuses.reduce<Record<ClipStatus, number>>((acc, status) => {
    acc[status] = clips.filter((clip) => clip.status === status).length;
    return acc;
  }, {} as Record<ClipStatus, number>);
}

export function getDashboardMetrics(
  sources: SourceVideo[],
  clips: ClipWithSchedule[],
  posts: ScheduledPost[],
  today = new Date()
): DashboardMetrics {
  const day = today.toISOString().slice(0, 10);
  const todaysPosts = posts.filter((post) => post.scheduled_at?.slice(0, 10) === day);
  const readyClips = clips.filter((clip) => clip.status === "ready");
  const editingClips = clips.filter((clip) => clip.status === "editing");

  return {
    sourceVideosCount: sources.length,
    clipsByStatus: getClipsByStatus(clips),
    scheduledPosts: posts.filter((post) => post.status === "scheduled").length,
    publishedPosts: posts.filter((post) => post.status === "posted" || post.published_at).length,
    totalViews: posts.reduce((sum, post) => sum + (post.views ?? 0), 0),
    todaysTasks: [
      ...todaysPosts.map((post) => ({ label: "Publikovať", detail: `${post.platform} · ${post.target_account ?? "bez účtu"}` })),
      ...readyClips.slice(0, 3).map((clip) => ({ label: "Naplánovať clip", detail: clip.title ?? "Bez názvu" })),
      ...editingClips.slice(0, 3).map((clip) => ({ label: "Dokončiť edit", detail: clip.title ?? "Bez názvu" }))
    ].slice(0, 6)
  };
}

export function getTopClips(clips: ClipWithSchedule[]) {
  return [...clips]
    .map((clip) => ({
      ...clip,
      views: clip.scheduled_posts?.reduce((sum, post) => sum + post.views, 0) ?? 0
    }))
    .sort((a, b) => b.views - a.views || (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);
}

export function getPlatformBreakdown(posts: ScheduledPost[]) {
  const totals = posts.reduce<Record<string, { posts: number; views: number }>>((acc, post) => {
    acc[post.platform] ??= { posts: 0, views: 0 };
    acc[post.platform].posts += 1;
    acc[post.platform].views += post.views ?? 0;
    return acc;
  }, {});

  return Object.entries(totals)
    .map(([platform, value]) => ({ platform, ...value }))
    .sort((a, b) => b.views - a.views);
}
