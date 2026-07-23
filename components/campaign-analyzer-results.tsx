"use client";

import React from "react";
import { Badge, Card } from "@/components/ui";
import type { calculateCampaign } from "@/lib/campaign-analyzer/calculations";

type Result = ReturnType<typeof calculateCampaign>;
const integer = (value: number | null) => value == null ? "—" : Math.round(value).toLocaleString("sk-SK");

export function CampaignAnalyzerResults({ result }: { result: Result }) {
  const source = { clipper_shorts: "Clipper Shorts", creator_shorts: "Creator Shorts", manual: "Ručný odhad", none: "Nedostatok dát" }[result.benchmark.source];
  const warning = result.available_clips != null && result.unique_clips != null && Math.floor(result.available_clips) < result.unique_clips;
  return <Card className="lg:sticky lg:top-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">Výsledok</h2><Badge className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100">{result.rating}</Badge></div>
    <div className="grid grid-cols-2 gap-2">{[
      ["Unikátne klipy", integer(result.unique_clips)], ["Dostupné klipy", result.available_clips == null ? "—" : Math.floor(result.available_clips).toLocaleString("sk-SK")], ["Účty", integer(result.total_accounts)], ["Uploady", integer(result.total_uploads)],
      ["Potrebné views", integer(result.required_total_views)], ["Views / klip", integer(result.required_views_per_unique_clip)], ["Views / upload", integer(result.required_views_per_upload)], ["Views / účet", integer(result.required_views_per_account)]
    ].map(([label, value]) => <div key={label} className="rounded-md border border-white/10 bg-white/[0.035] p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>)}</div>
    <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm"><Row label="Referenčný medián" value={integer(result.benchmark.value)} /><Row label="Násobok" value={result.multiplier == null ? "—" : `${result.multiplier.toFixed(2)}×`} /><Row label="Zdroj benchmarku" value={source} /></div>
    {warning ? <p className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">Odhad dostupných klipov je nižší než plánovaný počet.</p> : null}
    {result.benchmark.source === "clipper_shorts" || result.benchmark.source === "creator_shorts" ? <p className="mt-3 text-xs leading-5 text-slate-500">YouTube Shorts benchmark je pre Instagram a TikTok iba orientačný.</p> : null}
  </Card>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><span className="text-slate-400">{label}</span><span className="text-right font-medium text-white">{value}</span></div>; }
