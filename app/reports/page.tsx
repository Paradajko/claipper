import Link from "next/link";
import { BarChart3, Eye, Lightbulb, Trophy } from "lucide-react";
import { AppShell, Card } from "@/components/ui";
import { getPlatformBreakdown, getTopClips } from "@/lib/metrics";
import { getClips, getScheduledPosts } from "@/lib/supabase";

export default async function ReportsPage() {
  const [clips, posts] = await Promise.all([getClips(), getScheduledPosts()]);
  const topClips = getTopClips(clips);
  const platforms = getPlatformBreakdown(posts);
  const postedClips = clips.filter((clip) => ["posted", "reported"].includes(clip.status)).length;
  const totalViews = posts.reduce((sum, post) => sum + post.views, 0);
  const bestHooks = topClips.filter((clip) => clip.hook).slice(0, 3);

  return (
    <AppShell title="Performance report" eyebrow="Reports">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-400">Total clips</p>
          <p className="mt-2 text-3xl font-semibold text-white">{clips.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Posted clips</p>
          <p className="mt-2 text-3xl font-semibold text-white">{postedClips}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Total views</p>
          <p className="mt-2 text-3xl font-semibold text-white">{totalViews.toLocaleString("en-US")}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <Trophy className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Top clips</h2>
          </div>
          <div className="space-y-3">
            {topClips.map((clip) => (
              <Link key={clip.id} href={`/clips/${clip.id}`} className="block rounded-md border border-white/10 bg-white/[0.035] p-4 hover:border-emerald-400/30">
                <p className="font-medium text-white">{clip.title ?? "Untitled clip"}</p>
                <p className="mt-2 text-sm text-slate-400">{clip.hook ?? "No hook yet"}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Best platforms</h2>
          </div>
          <div className="space-y-3">
            {platforms.map((platform) => (
              <div key={platform.platform} className="rounded-md border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{platform.platform}</p>
                  <p className="text-sm text-emerald-200">{platform.views.toLocaleString("en-US")} views</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(8, Math.min(100, totalViews ? (platform.views / totalViews) * 100 : 8))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <Eye className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Best hooks</h2>
          </div>
          <div className="space-y-3">
            {bestHooks.map((clip) => (
              <blockquote key={clip.id} className="rounded-md border-l-2 border-emerald-400 bg-emerald-400/[0.06] p-4 text-sm leading-6 text-emerald-50">
                {clip.hook}
              </blockquote>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-2">
            <Lightbulb className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Recommendations for next clips</h2>
          </div>
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            <li>Create more variants from moments scoring above 85, especially when the first three seconds have clear contrast.</li>
            <li>Add platform-specific captions to ready clips before scheduling so reporting can compare angles.</li>
            <li>Sort the next batch by hook type: insight, teardown, tip, or strategy.</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
