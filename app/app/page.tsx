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
    { label: "Content Runs", value: sources.length, icon: Film, accent: "from-emerald-300/60 to-cyan-300/20" },
    { label: "Clip Ideas", value: clipIdeas, icon: Sparkles, accent: "from-cyan-300/60 to-emerald-300/20" },
    { label: "Ready Clips", value: readyClips, icon: CheckCircle2, accent: "from-emerald-300/70 to-lime-300/20" },
    { label: "Scheduled", value: scheduledPosts, icon: ListChecks, accent: "from-teal-300/60 to-emerald-300/20" }
  ];

  return (
    <AppShell title="Dashboard" eyebrow="AI clipping workspace">
      <section className="relative overflow-hidden rounded-xl border border-emerald-400/15 bg-[radial-gradient(circle_at_15%_10%,rgba(45,212,191,.18),transparent_28rem),linear-gradient(145deg,rgba(15,23,42,.88),rgba(2,6,23,.76))] p-6 shadow-[0_24px_90px_-40px_rgba(16,185,129,.45)]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,.055)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.045)_1px,transparent_1px)] bg-[size:36px_36px] opacity-70" />
        <div className="relative">
          <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100">Command center</Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">Start with context. Finish with clips.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Use a MyLaura brief or analyze any video directly. Claipper turns long-form content into scored clip ideas and production-ready outputs.
          </p>

          <div className="mt-7 grid gap-3 lg:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <div key={step.label} className="relative">
                {index < workflowSteps.length - 1 ? <div className="absolute left-[calc(100%-0.25rem)] top-1/2 z-0 hidden h-px w-6 bg-gradient-to-r from-emerald-300/60 to-cyan-300/30 lg:block" /> : null}
                <div
                  className={[
                    "relative z-10 flex min-h-24 flex-col justify-between rounded-lg border p-4 shadow-[0_18px_55px_-36px_rgba(34,211,238,.75)]",
                    step.active
                      ? "border-emerald-300/45 bg-emerald-300/[0.13] text-white"
                      : "border-white/10 bg-slate-950/55 text-slate-300"
                  ].join(" ")}
                >
                  <step.icon className={step.active ? "h-5 w-5 text-emerald-200" : "h-5 w-5 text-cyan-200/80"} />
                  <p className="mt-4 text-sm font-semibold">{step.label}</p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className={step.active ? "h-full w-3/4 rounded-full bg-emerald-300" : "h-full w-1/3 rounded-full bg-cyan-300/40"} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Link href="/app/mylaura-brief" className="group block">
          <Card className="h-full overflow-hidden p-0 transition group-hover:border-emerald-400/40 group-hover:bg-emerald-400/[0.06]">
            <div className="p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Start with MyLaura Brief</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">Paste a MyLaura campaign link. Claipper reads the brief and uses it to find campaign-relevant moments.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
                  <FileText />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">MyLaura link</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100">Context extracted</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-cyan-100">Clip angles ready</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {briefSignals.map((signal) => (
                    <span key={signal} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <span className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_28px_rgba(16,185,129,.22)]">
                Start with Brief <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>

        <Link href="/app/content-lab" className="group block">
          <Card className="h-full overflow-hidden p-0 transition group-hover:border-emerald-400/40 group-hover:bg-emerald-400/[0.06]">
            <div className="p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Start with Content</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">Upload a video or paste a link. Claipper scans it and creates clip ideas without campaign context.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
                  <Link2 />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">Video source</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">Transcript</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100">Moments found</span>
                </div>
                <div className="relative h-9">
                  <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-slate-800" />
                  {[22, 52, 79].map((left) => (
                    <span key={left} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-100/70 bg-emerald-300 shadow-[0_0_22px_rgba(16,185,129,.8)]" style={{ left: `${left}%` }} />
                  ))}
                </div>
              </div>

              <span className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_28px_rgba(16,185,129,.22)]">
                Start with Content <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className={`absolute inset-x-4 bottom-0 h-px bg-gradient-to-r ${stat.accent}`} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full w-2/3 rounded-full bg-gradient-to-r ${stat.accent}`} />
            </div>
          </Card>
        ))}
      </div>

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Recent analyses</h2>
            <p className="mt-2 text-sm text-slate-400">Latest content runs and campaign-context scans.</p>
          </div>
        </div>
        {recentAnalyses.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {recentAnalyses.map((analysis, index) => (
              <Card key={analysis.id}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{analysis.mylaura_campaign_name ? "MyLaura Brief" : "Universal Content"}</Badge>
                  <span className="text-xs text-slate-500">Run {index + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{analysis.title}</h3>
                <p className="mt-3 text-sm text-slate-400">{analysis.mylaura_campaign_name ? "Campaign-relevant analysis" : "Direct content analysis"}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-300">{Math.max(3, clips.filter((clip) => clip.source_video_id === analysis.id).length)} clip ideas</span>
                  <Link href="/app/clips" className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-emerald-400/40">View</Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center">
            <p className="text-lg font-semibold text-white">No analyses yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Start with a MyLaura brief or add content to generate your first clip ideas.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/app/mylaura-brief" className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Start with Brief</Link>
              <Link href="/app/content-lab" className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-emerald-400/40">Start with Content</Link>
            </div>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
