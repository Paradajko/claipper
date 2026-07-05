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
        <div className="grid gap-3 md:hidden">
          {posts.map((post) => {
            const clip = clipById.get(post.clip_id);
            return (
              <article key={post.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Scheduled post</span>
                  <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{post.status}</Badge>
                </div>
                <h3 className="text-base font-semibold text-white">{clip?.title ?? "No clip"}</h3>
                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                  <p><span className="text-slate-500">Platform:</span> {post.platform}</p>
                  <p><span className="text-slate-500">Date/time:</span> {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString("en-US") : "No date"}</p>
                  <p><span className="text-slate-500">Account:</span> {post.target_account ?? "No account"}</p>
                </div>
                {post.post_url ? (
                  <a href={post.post_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm font-semibold text-emerald-300">
                    Open post <ExternalLink size={14} />
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="hidden md:block overflow-x-auto">
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
                    <td className="rounded-l-md px-3 py-3 text-slate-200">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString("en-US") : "No date"}</td>
                    <td className="px-3 py-3 text-white">{post.platform}</td>
                    <td className="px-3 py-3 text-slate-300">{post.target_account ?? "No account"}</td>
                    <td className="px-3 py-3">
                      {clip ? <Link href={`/app/clips/${clip.id}`} className="text-emerald-300 hover:text-emerald-200">{clip.title ?? "Untitled"}</Link> : "No clip"}
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
