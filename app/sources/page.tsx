import { ExternalLink, Plus } from "lucide-react";
import { AppShell, Badge, Card } from "@/components/ui";
import { createSourceVideo, getSourceVideos, isSupabaseConfigured } from "@/lib/supabase";

export default async function SourcesPage() {
  const sources = await getSourceVideos();

  return (
    <AppShell title="Source video library" eyebrow="Zdroje">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <Plus className="text-cyan-200" />
            <h2 className="text-lg font-semibold text-white">Add source video</h2>
          </div>
          {!isSupabaseConfigured ? (
            <p className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Demo mód: formulár začne ukladať po nastavení Supabase env premenných.
            </p>
          ) : null}
          <form action={createSourceVideo} className="grid gap-3">
            <Input name="title" label="Title" required />
            <Input name="source_url" label="Source URL" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="platform" label="Platform" />
              <Input name="duration_seconds" label="Duration seconds" type="number" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="mylaura_campaign_name" label="MyLaura campaign name" />
              <Input name="mylaura_campaign_url" label="MyLaura campaign URL" />
            </div>
            <Input name="client_name" label="Client name optional" />
            <Input name="status" label="Status" defaultValue="new" />
            <Textarea name="transcript" label="Transcript" />
            <Textarea name="notes" label="Notes" />
            <button className="mt-2 h-11 rounded-md bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200">
              Uložiť zdroj
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          {sources.map((source) => (
            <Card key={source.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100">{source.status}</Badge>
                    {source.platform ? <Badge className="border-white/10 bg-white/5 text-slate-200">{source.platform}</Badge> : null}
                  </div>
                  <h2 className="text-xl font-semibold text-white">{source.title}</h2>
                  <p className="mt-2 text-sm text-slate-400">{source.notes ?? "Bez poznámok."}</p>
                  <p className="mt-3 text-sm text-slate-300">
                    MyLaura: {source.mylaura_campaign_name ?? "bez referencie"}
                    {source.client_name ? ` · ${source.client_name}` : ""}
                  </p>
                </div>
                {source.source_url ? (
                  <a href={source.source_url} target="_blank" className="inline-flex items-center gap-2 text-sm text-cyan-200" rel="noreferrer">
                    Source <ExternalLink size={15} />
                  </a>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      {label}
      <input {...props} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-cyan-300/60" />
    </label>
  );
}

function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      {label}
      <textarea {...props} rows={4} className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300/60" />
    </label>
  );
}
