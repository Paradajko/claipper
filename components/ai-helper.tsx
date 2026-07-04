"use client";

import { useState } from "react";
import { WandSparkles } from "lucide-react";
import type { ClipWithSchedule } from "@/lib/types";

const actions = [
  { id: "generate-hooks", label: "Generate hooks" },
  { id: "improve-hook", label: "Improve hook" },
  { id: "generate-caption", label: "Generate caption" },
  { id: "generate-hashtags", label: "Generate hashtags" },
  { id: "generate-cta", label: "Generate CTA" }
] as const;

export function AiHelper({ clip }: { clip: ClipWithSchedule }) {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function run(action: (typeof actions)[number]["id"]) {
    setLoading(action);
    setResult("");
    const response = await fetch("/api/ai/clip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        clip: {
          title: clip.title,
          hook: clip.hook,
          caption: clip.caption,
          hashtags: clip.hashtags,
          cta: clip.cta,
          notes: clip.notes,
          mylaura_campaign_name: clip.mylaura_campaign_name
        }
      })
    });
    const data = (await response.json()) as { text?: string; error?: string; demo?: boolean };
    setResult(data.text ?? data.error ?? "Bez odpovede.");
    setLoading(null);
  }

  return (
    <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.055] p-4">
      <div className="mb-4 flex items-center gap-2">
        <WandSparkles className="text-cyan-200" size={18} />
        <h2 className="text-sm font-semibold text-white">AI helper</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => void run(action.id)}
            disabled={Boolean(loading)}
            className="h-9 rounded-md border border-white/10 bg-black/25 px-3 text-xs font-semibold text-slate-100 transition hover:border-cyan-300/40 disabled:cursor-wait disabled:opacity-60"
          >
            {loading === action.id ? "Generating..." : action.label}
          </button>
        ))}
      </div>
      {result ? <pre className="mt-4 whitespace-pre-wrap rounded-md border border-white/10 bg-black/35 p-3 text-sm leading-6 text-cyan-50">{result}</pre> : null}
    </div>
  );
}
