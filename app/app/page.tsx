import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Film, ListChecks, Sparkles, UploadCloud } from "lucide-react";
import { AppShell, Badge, Card } from "@/components/ui";
import { getClips, getScheduledPosts, getSourceVideos } from "@/lib/supabase";

export default async function DashboardPage() {
  const [sources, clips, posts] = await Promise.all([getSourceVideos(), getClips(), getScheduledPosts()]);
  const clipIdeas = clips.filter((clip) => clip.status === "idea").length;
  const readyClips = clips.filter((clip) => clip.status === "ready").length;
  const scheduledPosts = posts.filter((post) => post.status === "scheduled").length;
  const recentAnalyses = sources.slice(0, 3);

  const stats = [
    { label: "Content Runs", value: sources.length, icon: Film },
    { label: "Clip Ideas", value: clipIdeas, icon: Sparkles },
    { label: "Ready Clips", value: readyClips, icon: CheckCircle2 },
    { label: "Scheduled", value: scheduledPosts, icon: ListChecks }
  ];

  return (
    <AppShell title="Dashboard" eyebrow="AI clipping workspace">
      <div className="space-y-6">
        <section className="clip-start-hero dashboard-ambient rounded-lg border border-emerald-300/15 bg-slate-950/55 p-5 backdrop-blur-xl md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Claipper</Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">Find clips in minutes.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 md:text-base">Upload a long video with optional Kick chat, or start from campaign context.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-center sm:min-w-80">
              <div className="rounded-md bg-white/[0.04] px-3 py-2">
                <p className="text-lg font-semibold text-white">{sources.length}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Runs</p>
              </div>
              <div className="rounded-md bg-white/[0.04] px-3 py-2">
                <p className="text-lg font-semibold text-white">{clipIdeas}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Ideas</p>
              </div>
              <div className="rounded-md bg-white/[0.04] px-3 py-2">
                <p className="text-lg font-semibold text-white">{readyClips}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Ready</p>
              </div>
            </div>
          </div>
        </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Link href="/app/content-lab" className="group block">
          <Card className="clip-action-card premium-hover h-full border-emerald-300/20 bg-emerald-300/[0.06] p-0 group-hover:border-emerald-400/45 group-hover:bg-emerald-400/[0.09]">
            <div className="flex h-full flex-col justify-between p-5 md:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Upload content</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Drop in a long video and optional chat export. Claipper finds the strongest moments.</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  <UploadCloud className="h-5 w-5" />
                </div>
              </div>

              <span className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition group-hover:bg-emerald-300 sm:w-fit">
                Open Content Lab <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>

        <Link href="/app/mylaura-brief" className="group block">
          <Card className="clip-action-card premium-hover h-full border-white/10 bg-white/[0.04] p-0 group-hover:border-emerald-400/30 group-hover:bg-emerald-400/[0.045]">
            <div className="flex h-full flex-col justify-between p-5 md:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Start from brief</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Use campaign context first, then review the moments that match the angle.</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  <FileText className="h-5 w-5" />
                </div>
              </div>

              <span className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition group-hover:bg-emerald-400/15 sm:w-fit">
                Open Brief <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="premium-hover border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{stat.value}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-emerald-300/15 bg-emerald-300/10 text-emerald-300">
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Recent analyses</h2>
            <p className="mt-2 text-sm text-slate-400">Latest content runs and campaign-context scans.</p>
          </div>
        </div>
        {recentAnalyses.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {recentAnalyses.map((analysis, index) => (
              <Card key={analysis.id} className="premium-hover border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{analysis.mylaura_campaign_name ? "MyLaura Brief" : "Universal Content"}</Badge>
                  <span className="text-xs text-slate-500">Run {index + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{analysis.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{analysis.mylaura_campaign_name ? "Campaign-relevant analysis" : "Direct content analysis"}</p>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-sm text-slate-300">{Math.max(3, clips.filter((clip) => clip.source_video_id === analysis.id).length)} clip ideas</span>
                  <Link href="/app/clips" className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-emerald-400/40">View</Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-white/10 bg-white/[0.035] text-center">
            <p className="text-lg font-semibold text-white">No analyses yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Start with a MyLaura brief or add content to generate your first clip ideas.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/app/content-lab" className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Upload content</Link>
              <Link href="/app/mylaura-brief" className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-emerald-400/40">Start from brief</Link>
            </div>
          </Card>
        )}
      </section>
      </div>
    </AppShell>
  );
}
