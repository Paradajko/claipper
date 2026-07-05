import Link from "next/link";
import { Check, Edit3, X } from "lucide-react";
import { AppShell, Badge, Card, StatusBadge } from "@/components/ui";
import { getClips } from "@/lib/supabase";
import type { ClipStatus, ClipWithSchedule } from "@/lib/types";

const productionStatuses = ["selected", "editing", "ready", "scheduled", "posted"] as const satisfies readonly ClipStatus[];
const productionStatusSet = new Set<ClipStatus>(productionStatuses);

const productionLabels: Record<(typeof productionStatuses)[number], string> = {
  selected: "Selected",
  editing: "Editing",
  ready: "Ready",
  scheduled: "Scheduled",
  posted: "Posted"
};

export default async function ClipsPage() {
  const clips = await getClips();
  const ideas = clips.filter((clip) => clip.status === "idea");
  const productionClips = clips.filter((clip) => productionStatusSet.has(clip.status));

  return (
    <AppShell title="Clips" eyebrow="Ideas and production">
      <div className="mb-6 grid grid-cols-2 rounded-lg border border-white/10 bg-white/[0.04] p-1 sm:inline-flex">
        <a href="#ideas" className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Ideas</a>
        <a href="#production" className="rounded-md px-4 py-2 text-center text-sm font-semibold text-slate-300 hover:text-white">Production</a>
      </div>

      <section id="ideas">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Ideas</h2>
            <p className="mt-2 text-sm text-slate-400">AI-generated clip ideas from analyzed content and MyLaura context.</p>
          </div>
          <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{ideas.length} ideas</Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {(ideas.length > 0 ? ideas : clips.slice(0, 2)).map((clip) => (
            <IdeaCard key={clip.id} clip={clip} />
          ))}
        </div>
      </section>

      <section id="production" className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Production</h2>
            <p className="mt-2 text-sm text-slate-400">Selected clips move through editing, readiness, scheduling, and posting.</p>
          </div>
          <Badge className="border-white/10 bg-white/5 text-slate-200">{productionClips.length} active</Badge>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {productionStatuses.map((status) => (
            <a key={status} href={`#production-${status}`} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
              {productionLabels[status]}
            </a>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          {productionStatuses.map((status) => {
            const columnClips = clips.filter((clip) => clip.status === status);
            return (
              <section id={`production-${status}`} key={status} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{productionLabels[status]}</h3>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{columnClips.length}</span>
                </div>
                <div className="space-y-3">
                  {columnClips.map((clip) => (
                    <Link href={`/app/clips/${clip.id}`} key={clip.id}>
                      <Card className="p-4 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06]">
                        <StatusBadge status={clip.status} />
                        <h4 className="mt-3 text-sm font-semibold text-white">{clip.title ?? "Untitled clip"}</h4>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{clip.hook ?? clip.caption ?? "No hook generated yet."}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{formatRange(clip.start_seconds, clip.end_seconds)}</span>
                          <span>{clip.score ? `${clip.score}/100` : "no score"}</span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function IdeaCard({ clip }: { clip: ClipWithSchedule }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">timestamp range: {formatRange(clip.start_seconds, clip.end_seconds)}</Badge>
        <Badge className="border-white/10 bg-white/5 text-slate-200">score {clip.score ?? "pending"}</Badge>
      </div>
      <h3 className="text-lg font-semibold text-white">{clip.title ?? "Untitled clip idea"}</h3>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
        <p><span className="font-semibold text-white">Reason why it works:</span> {clip.notes ?? "It has a clear shift in energy, a useful takeaway, and a natural short-form setup."}</p>
        <p><span className="font-semibold text-white">Generated hook:</span> {clip.hook ?? "Hook pending."}</p>
        <p><span className="font-semibold text-white">campaign relevance:</span> {clip.mylaura_campaign_name ? `Matches ${clip.mylaura_campaign_name}.` : "No MyLaura Brief attached."}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 sm:flex-none">
          <Check className="h-3.5 w-3.5" />
          Create Clip
        </button>
        <button className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-emerald-400/40 sm:flex-none">
          <Edit3 className="h-3.5 w-3.5" />
          Edit
        </button>
        <button className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:border-rose-300/40 sm:flex-none">
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </Card>
  );
}

function formatRange(start: number | null, end: number | null) {
  if (start == null || end == null) return "pending";
  return `${formatTime(start)}-${formatTime(end)}`;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
