import Link from "next/link";
import { ArrowRight, FileText, Link2 } from "lucide-react";
import { AppShell, Card } from "@/components/ui";
import { getClips, getScheduledPosts, getSourceVideos } from "@/lib/supabase";

export default async function DashboardPage() {
  const [sources, clips, posts] = await Promise.all([getSourceVideos(), getClips(), getScheduledPosts()]);
  const clipIdeas = clips.filter((clip) => clip.status === "idea").length;
  const selectedClips = clips.filter((clip) => ["selected", "editing", "ready", "scheduled", "posted"].includes(clip.status)).length;

  const cards = [
    { label: "Content analyzed", value: sources.length },
    { label: "Clip ideas", value: clipIdeas },
    { label: "Production clips", value: selectedClips },
    { label: "Scheduled posts", value: posts.length }
  ];

  return (
    <AppShell title="Dashboard" eyebrow="AI clipping workspace">
      <Card>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Main workflow</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">MyLaura Brief → Content Lab → Clips → Schedule → Reports</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Start with campaign context or analyze any long-form content directly. Claipper turns the source into scored clip ideas, then moves selected clips through production, scheduling, and reporting.
            </p>
          </div>
          <p className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">Universal workflow: Content Lab → Clips → Schedule → Reports</p>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/app/mylaura-brief" className="group block">
          <Card className="h-full transition group-hover:border-emerald-400/40 group-hover:bg-emerald-400/[0.06]">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
              <FileText />
            </div>
            <h2 className="text-xl font-semibold text-white">Clip from MyLaura Brief</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">User pastes a MyLaura campaign link. Claipper analyzes the brief and uses it as context.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
              Analyze brief <ArrowRight className="h-4 w-4" />
            </span>
          </Card>
        </Link>

        <Link href="/app/content-lab" className="group block">
          <Card className="h-full transition group-hover:border-emerald-400/40 group-hover:bg-emerald-400/[0.06]">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
              <Link2 />
            </div>
            <h2 className="text-xl font-semibold text-white">Clip any content</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">User uploads a video or pastes a content link. Claipper analyzes it without MyLaura context.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
              Open Content Lab <ArrowRight className="h-4 w-4" />
            </span>
          </Card>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
