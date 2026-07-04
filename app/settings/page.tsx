import { CheckCircle2, CircleAlert } from "lucide-react";
import { AppShell, Card } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase";

const envChecks = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), note: "Supabase project URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), note: "Browser-safe Supabase key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), note: "Server inserts and updates" },
  { key: "OPENAI_API_KEY", present: Boolean(process.env.OPENAI_API_KEY), note: "AI helper generation" },
  { key: "APP_PASSWORD", present: Boolean(process.env.APP_PASSWORD), note: "Simple dashboard password" }
];

export default function SettingsPage() {
  return (
    <AppShell title="Settings" eyebrow="Env/status">
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <h2 className="mb-5 text-lg font-semibold text-white">Environment status</h2>
          <div className="space-y-3">
            {envChecks.map((env) => (
              <div key={env.key} className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.035] p-4">
                <div>
                  <p className="font-mono text-sm text-white">{env.key}</p>
                  <p className="mt-1 text-sm text-slate-400">{env.note}</p>
                </div>
                <div className={env.present ? "text-lime-200" : "text-amber-200"}>
                  {env.present ? <CheckCircle2 /> : <CircleAlert />}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-5 text-lg font-semibold text-white">Basic preferences</h2>
          <div className="space-y-4 text-sm text-slate-300">
            <p>Jazyk: Slovak first</p>
            <p>Domain later: claipper.com/sk</p>
            <p>Data mode: {isSupabaseConfigured ? "Supabase connected" : "Demo fallback"}</p>
            <p>Manual scope: video rendering, auto-upload a MyLaura campaign/payout logic sú mimo tejto verzie.</p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
