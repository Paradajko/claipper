import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, FileText, Film, Link2, ListChecks, Radar, Scissors, Sparkles } from "lucide-react";
import { AppShell, Badge, Card } from "@/components/ui";
import { getClips, getScheduledPosts, getSourceVideos } from "@/lib/supabase";

const workflowSteps = [
  { label: "Brief / Content", icon: FileText, active: true },
  { label: "AI Analysis", icon: Radar },
  { label: "Clip Ideas", icon: Sparkles },
  { label: "Production", icon: Scissors },
  { label: "Reports", icon: BarChart3 }
];

const briefSignals = ["Goal found", "Tone found", "CTA found", "Angles ready"];

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
      <div className="flex flex-col gap-6">
        <section className="dashboard-ambient order-2 rounded-lg border border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl md:order-1 md:p-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-end">
            <div>
              <Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">AI production workspace</Badge>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-white md:text-4xl">Start with context. Finish with clips.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Turn campaign context and long-form video into ranked clip ideas, drafts and ready outputs without switching tools.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
              {stats.slice(0, 3).map((stat) => (
                <div key={stat.label} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animated-flow-line relative mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {workflowSteps.map((step) => (
              <div
                key={step.label}
                className={[
                  "premium-hover relative z-10 flex min-h-24 flex-col justify-between rounded-lg border p-4 backdrop-blur",
                  step.active
                    ? "border-emerald-300/35 bg-emerald-300/[0.12] text-white"
                    : "border-white/10 bg-black/25 text-slate-300"
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <step.icon className={step.active ? "h-5 w-5 text-emerald-200" : "h-5 w-5 text-cyan-200/80"} />
                  <span className={step.active ? "h-2 w-2 rounded-full bg-emerald-300" : "h-2 w-2 rounded-full bg-white/20"} />
                </div>
                <p className="mt-4 text-sm font-semibold">{step.label}</p>
              </div>
            ))}
          </div>
        </section>

      <div className="order-1 grid gap-4 md:order-2 xl:grid-cols-2">
        <Link href="/app/mylaura-brief" className="group block">
          <Card className="premium-hover h-full border-white/10 bg-white/[0.045] p-0 group-hover:border-emerald-400/35 group-hover:bg-emerald-400/[0.055]">
            <div className="p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Start with MyLaura Brief</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Paste a MyLaura campaign link. Claipper reads the brief and finds campaign-relevant moments.</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-300/15 bg-emerald-300/10 text-emerald-300">
                  <FileText className="h-4 w-4" />
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/15 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">MyLaura link</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100">Context extracted</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100">Clip angles ready</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {briefSignals.map((signal) => (
                    <span key={signal} className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 text-xs font-medium text-emerald-100">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <span className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 sm:w-auto">
                Start with Brief <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>

        <Link href="/app/content-lab" className="group block">
          <Card className="premium-hover h-full border-white/10 bg-white/[0.045] p-0 group-hover:border-cyan-300/35 group-hover:bg-cyan-300/[0.05]">
            <div className="p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Start with Content</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Upload a video or paste a link. Claipper scans it and creates clip ideas without campaign context.</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-300/15 bg-emerald-300/10 text-emerald-300">
                  <Link2 className="h-4 w-4" />
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/15 p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">Video source</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">Transcript</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100">Moments found</span>
                </div>
                <div className="relative h-9">
                  <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-slate-800" />
                  {[22, 52, 79].map((left) => (
                    <span key={left} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-100/60 bg-emerald-300" style={{ left: `${left}%` }} />
                  ))}
                </div>
              </div>

              <span className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 sm:w-auto">
                Start with Content <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>
      </div>

      <div className="order-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="order-3">
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
              <Link href="/app/mylaura-brief" className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Start with Brief</Link>
              <Link href="/app/content-lab" className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-emerald-400/40">Start with Content</Link>
            </div>
          </Card>
        )}
      </section>
      </div>
    </AppShell>
  );
}
