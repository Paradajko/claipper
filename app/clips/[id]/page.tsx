import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import { AiHelper } from "@/components/ai-helper";
import { AppShell, Badge, Card, StatusBadge } from "@/components/ui";
import { getClip, updateClipDetails, updateClipStatus } from "@/lib/supabase";
import { clipStatuses, type ClipStatus } from "@/lib/types";

export default async function ClipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clip = await getClip(id);
  if (!clip) notFound();

  return (
    <AppShell title={clip.title ?? "Clip detail"} eyebrow="Production workspace">
      <div className="mb-5">
        <Link href="/clips" className="inline-flex items-center gap-2 text-sm text-emerald-300">
          <ArrowLeft size={16} /> Back to board
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <StatusBadge status={clip.status} />
              {clip.content_type ? <Badge className="border-white/10 bg-white/5 text-slate-200">{clip.content_type}</Badge> : null}
              {clip.score ? <Badge className="border-lime-300/30 bg-lime-300/10 text-lime-100">Score {clip.score}</Badge> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Timestamp" value={`${formatSeconds(clip.start_seconds)} - ${formatSeconds(clip.end_seconds)}`} />
              <Metric label="Duration" value={`${clip.duration_seconds ?? 0}s`} />
              <Metric label="MyLaura ref" value={clip.mylaura_campaign_name ?? "No reference"} />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Clip editing</h2>
            <form action={updateClipDetails} className="grid gap-4">
              <input type="hidden" name="id" value={clip.id} />
              <Textarea name="hook" label="Hook" defaultValue={clip.hook ?? ""} />
              <Textarea name="caption" label="Caption" defaultValue={clip.caption ?? ""} />
              <Textarea name="hashtags" label="Hashtags" defaultValue={clip.hashtags ?? ""} />
              <Textarea name="cta" label="CTA" defaultValue={clip.cta ?? ""} />
              <Input name="exported_video_url" label="Exported video URL" defaultValue={clip.exported_video_url ?? ""} />
              <Textarea name="notes" label="Edit notes" defaultValue={clip.notes ?? ""} />
              <button className="h-11 rounded-md bg-emerald-400 font-semibold text-slate-950 hover:bg-emerald-300">Save changes</button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <AiHelper clip={clip} />

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Status buttons</h2>
            <div className="flex flex-wrap gap-2">
              {clipStatuses.map((status) => (
                <form key={status} action={updateClipStatus.bind(null, clip.id, status as ClipStatus)}>
                  <button className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-400/40">
                    {status}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Scheduled posts</h2>
            <div className="space-y-3">
              {(clip.scheduled_posts ?? []).length > 0 ? (
                clip.scheduled_posts?.map((post) => (
                  <div key={post.id} className="rounded-md border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{post.platform}</p>
                      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{post.status}</Badge>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                      <Clock size={15} /> {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString("en-US") : "No date"}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">{post.views.toLocaleString("en-US")} views · {post.likes} likes · {post.comments} comments</p>
                    {post.post_url ? (
                      <a href={post.post_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-300">
                        Post URL <ExternalLink size={15} />
                      </a>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">This clip has no scheduled posts yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      {label}
      <input {...props} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-emerald-400/60" />
    </label>
  );
}

function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      {label}
      <textarea {...props} rows={4} className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-400/60" />
    </label>
  );
}

function formatSeconds(value: number | null) {
  if (value === null) return "00:00";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
