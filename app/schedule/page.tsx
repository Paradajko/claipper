import Link from "next/link";
import { CalendarClock, ExternalLink } from "lucide-react";
import { AppShell, Badge, Card } from "@/components/ui";
import { getClips, getScheduledPosts } from "@/lib/supabase";

export default async function SchedulePage() {
  const [posts, clips] = await Promise.all([getScheduledPosts(), getClips()]);
  const clipById = new Map(clips.map((clip) => [clip.id, clip]));

  return (
    <AppShell title="Scheduled posts" eyebrow="Schedule">
      <Card>
        <div className="mb-5 flex items-center gap-2">
          <CalendarClock className="text-emerald-300" />
          <h2 className="text-lg font-semibold text-white">Publishing queue</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Date/time</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Target account</th>
                <th className="px-3 py-2">Clip</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Post URL</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const clip = clipById.get(post.clip_id);
                return (
                  <tr key={post.id} className="bg-white/[0.035]">
                    <td className="rounded-l-md px-3 py-3 text-slate-200">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString("sk-SK") : "bez dátumu"}</td>
                    <td className="px-3 py-3 text-white">{post.platform}</td>
                    <td className="px-3 py-3 text-slate-300">{post.target_account ?? "bez účtu"}</td>
                    <td className="px-3 py-3">
                      {clip ? <Link href={`/clips/${clip.id}`} className="text-emerald-300 hover:text-emerald-200">{clip.title ?? "Untitled"}</Link> : "bez clipu"}
                    </td>
                    <td className="px-3 py-3"><Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{post.status}</Badge></td>
                    <td className="rounded-r-md px-3 py-3">
                      {post.post_url ? (
                        <a href={post.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-300">
                          URL <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-slate-500">manual</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
