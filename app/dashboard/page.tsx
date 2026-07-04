import { CalendarClock, CheckCircle2, Eye, Film, ListChecks } from "lucide-react";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { getDashboardMetrics } from "@/lib/metrics";
import { getClips, getScheduledPosts, getSourceVideos } from "@/lib/supabase";
import { clipStatuses } from "@/lib/types";

export default async function DashboardPage() {
  const [sources, clips, posts] = await Promise.all([getSourceVideos(), getClips(), getScheduledPosts()]);
  const metrics = getDashboardMetrics(sources, clips, posts);

  const cards = [
    { label: "Source videos", value: metrics.sourceVideosCount, icon: Film },
    { label: "Scheduled posts", value: metrics.scheduledPosts, icon: CalendarClock },
    { label: "Published posts", value: metrics.publishedPosts, icon: CheckCircle2 },
    { label: "Total views", value: metrics.totalViews.toLocaleString("sk-SK"), icon: Eye }
  ];

  return (
    <AppShell title="Operator dashboard" eyebrow="Claipper">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
                <card.icon />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <h2 className="mb-5 text-lg font-semibold text-white">Clips by status</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {clipStatuses.map((status) => (
              <div key={status} className="rounded-md border border-white/10 bg-white/[0.035] p-4">
                <StatusBadge status={status} />
                <p className="mt-4 text-3xl font-semibold text-white">{metrics.clipsByStatus[status]}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-2">
            <ListChecks className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Today’s tasks</h2>
          </div>
          <div className="space-y-3">
            {metrics.todaysTasks.length > 0 ? (
              metrics.todaysTasks.map((task, index) => (
                <div key={`${task.label}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">{task.label}</p>
                  <p className="mt-1 text-sm text-slate-400">{task.detail}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Dnes nie sú naplánované urgentné úlohy.</p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
