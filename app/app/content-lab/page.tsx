import Link from "next/link";
import { ArrowRight, ExternalLink, Link2, UploadCloud } from "lucide-react";
import { AppShell, Badge, Card, EmptyNotice } from "@/components/ui";
import { getSourceVideos, getStreamVideos, isSupabaseConfigured } from "@/lib/supabase";
import type { StreamVideo } from "@/lib/types";

export default async function ContentLabPage() {
  const [sources, streamVideos] = await Promise.all([getSourceVideos(), getStreamVideos()]);

  return (
    <AppShell title="Content Lab" eyebrow="AI analysis">
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr] xl:gap-6">
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <Link2 className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Analyze long-form content</h2>
          </div>
          <p className="mb-5 text-sm leading-6 text-slate-300">
            Paste a content link or upload long-form content. Claipper will analyze it, generate transcripts, find strong moments, and create clip ideas.
          </p>
          {!isSupabaseConfigured ? (
            <p className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Demo mode: AI analysis will start saving after Supabase and AI environment variables are configured.
            </p>
          ) : null}
          <form action="/api/stream-scan/upload" method="post" encType="multipart/form-data" className="grid gap-4">
            <Input name="title" label="Video title" placeholder="Stream title or episode name" required />
            <Input name="content_url" label="Paste content/video URL" placeholder="https://..." />
            <label className="grid gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-slate-300 sm:p-5">
              <span className="flex items-center gap-2 font-medium text-white">
                <UploadCloud className="h-4 w-4 text-emerald-300" />
                Upload video
              </span>
              <input name="video" type="file" accept="video/*" className="w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950" />
            </label>
            <label className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-300">
              <input name="attach_mylaura_brief" type="checkbox" className="h-4 w-4 accent-emerald-400" />
              Attach to MyLaura Brief
            </label>
            <button className="mt-2 h-12 rounded-md bg-emerald-400 font-semibold text-slate-950 hover:bg-emerald-300">
              Analyze Content
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          {streamVideos.length > 0 ? (
            streamVideos.map((video) => <StreamVideoCard key={video.id} video={video} />)
          ) : sources.length > 0 ? (
            sources.map((source) => (
              <Card key={source.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Analyzed</Badge>
                      {source.mylaura_campaign_name ? <Badge className="border-white/10 bg-white/5 text-slate-200">MyLaura context</Badge> : null}
                    </div>
                    <h2 className="text-xl font-semibold text-white">{source.title}</h2>
                    <p className="mt-2 text-sm text-slate-400">{source.notes ?? "Strong moments and clip ideas will appear after analysis."}</p>
                  </div>
                  {source.source_url ? (
                    <a href={source.source_url} target="_blank" className="inline-flex items-center gap-2 text-sm text-emerald-300" rel="noreferrer">
                      Open content <ExternalLink size={15} />
                    </a>
                  ) : null}
                </div>
              </Card>
            ))
          ) : (
            <EmptyNotice>Add a video link or upload long-form content. Claipper will analyze it and turn it into clip ideas.</EmptyNotice>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StreamVideoCard({ video }: { video: StreamVideo }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <VideoStateBadge state={video.status} />
            {video.original_filename ? <Badge className="border-white/10 bg-white/5 text-slate-200">{video.original_filename}</Badge> : null}
          </div>
          <h2 className="text-xl font-semibold text-white">{video.title}</h2>
          <p className="mt-2 text-sm text-slate-400">{video.progress_text ?? "Ready for Stream Scan."}</p>
          {video.error_message ? <p className="mt-2 text-sm text-rose-200">{video.error_message}</p> : null}
        </div>
        <Link href={`/app/content-lab/${video.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15">
          Open scan <ArrowRight size={15} />
        </Link>
      </div>
    </Card>
  );
}

function VideoStateBadge({ state }: { state: StreamVideo["status"] }) {
  const ready = state === "ready";
  const failed = state === "failed";
  return (
    <Badge className={failed ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : ready ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}>
      {state.replaceAll("_", " ")}
    </Badge>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      {label}
      <input {...props} className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-emerald-400/60" />
    </label>
  );
}
