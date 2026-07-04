import { FileText, Sparkles } from "lucide-react";
import { AppShell, Card } from "@/components/ui";

const analyzedContext = [
  { label: "Goal", value: "Identify the campaign objective and the strongest conversion moment." },
  { label: "Audience", value: "Summarize the target viewer, their pain point, and why the clip should matter." },
  { label: "Tone", value: "Extract the preferred voice, energy, and claims to avoid." },
  { label: "CTA", value: "Capture the offer, action, or destination the clips should support." },
  { label: "Content rules", value: "Save required phrases, restrictions, brand rules, and compliance notes." },
  { label: "Recommended clip angles", value: "Generate angles that connect the brief to moments found in long-form content." }
];

export default function MyLauraBriefPage() {
  return (
    <AppShell title="MyLaura Brief" eyebrow="Campaign context">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <FileText className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Analyze campaign brief</h2>
          </div>
          <p className="mb-5 text-sm leading-6 text-slate-300">
            Paste a MyLaura campaign link. Claipper analyzes the campaign brief and saves it as context for clipping.
          </p>
          <form className="grid gap-4">
            <label className="grid gap-1 text-sm text-slate-300">
              MyLaura campaign URL
              <input name="mylaura_campaign_url" placeholder="https://..." className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-emerald-400/60" />
            </label>
            <button className="h-11 rounded-md bg-emerald-400 font-semibold text-slate-950 hover:bg-emerald-300">Analyze Brief</button>
          </form>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Analyzed campaign context</h2>
          </div>
          <div className="grid gap-3">
            {analyzedContext.map((item) => (
              <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
