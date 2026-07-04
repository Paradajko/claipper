import Link from "next/link";
import { AppShell, Card, StatusBadge } from "@/components/ui";
import { getClips } from "@/lib/supabase";
import { clipStatuses, type ClipStatus } from "@/lib/types";

const columnLabels: Record<ClipStatus, string> = {
  idea: "Ideas",
  selected: "Selected",
  editing: "Editing",
  ready: "Ready",
  scheduled: "Scheduled",
  posted: "Posted",
  reported: "Reported",
  rejected: "Rejected"
};

export default async function ClipsPage() {
  const clips = await getClips();
  const visibleStatuses = clipStatuses.filter((status) => status !== "rejected");

  return (
    <AppShell title="Kanban production board" eyebrow="Clips">
      <div className="grid gap-4 xl:grid-cols-7">
        {visibleStatuses.map((status) => {
          const columnClips = clips.filter((clip) => clip.status === status);
          return (
            <section key={status} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">{columnLabels[status]}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{columnClips.length}</span>
              </div>
              <div className="space-y-3">
                {columnClips.map((clip) => (
                  <Link href={`/app/clips/${clip.id}`} key={clip.id}>
                    <Card className="p-4 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06]">
                      <StatusBadge status={clip.status} />
                      <h3 className="mt-3 text-sm font-semibold text-white">{clip.title ?? "Untitled clip"}</h3>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{clip.hook ?? clip.caption ?? "Bez hooku."}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{clip.duration_seconds ?? 0}s</span>
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
    </AppShell>
  );
}
