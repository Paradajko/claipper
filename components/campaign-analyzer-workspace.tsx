"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { CampaignAnalyzerFields } from "@/components/campaign-analyzer-fields";
import { CampaignAnalyzerResults } from "@/components/campaign-analyzer-results";
import { Card } from "@/components/ui";
import { calculateCampaign } from "@/lib/campaign-analyzer/calculations";
import type { CampaignAnalysis, CampaignInputs, CampaignManualOverrides, CampaignSource, SourceMetrics } from "@/lib/campaign-analyzer/types";

type Draft = CampaignInputs & { manual_overrides: CampaignManualOverrides };
const blank: Draft = { creator_name: "", youtube_url: null, kick_url: null, clipper_youtube_url: null, monthly_budget_eur: 0, reward_per_1000_views_eur: 0, tiktok_account_count: 0, instagram_account_count: 0, youtube_shorts_account_count: 0, clips_per_day: 0, campaign_duration_days: 0, content_hours_per_good_clip: 0, manual_expected_views_per_upload: null, manual_overrides: {} };

function toDraft(value: CampaignAnalysis | null): Draft {
  if (!value) return { ...blank, manual_overrides: {} };
  const { creator_name, youtube_url, kick_url, clipper_youtube_url, monthly_budget_eur, reward_per_1000_views_eur, tiktok_account_count, instagram_account_count, youtube_shorts_account_count, clips_per_day, campaign_duration_days, content_hours_per_good_clip, manual_expected_views_per_upload, manual_overrides } = value;
  return { creator_name, youtube_url, kick_url, clipper_youtube_url, monthly_budget_eur, reward_per_1000_views_eur, tiktok_account_count, instagram_account_count, youtube_shorts_account_count, clips_per_day, campaign_duration_days, content_hours_per_good_clip, manual_expected_views_per_upload, manual_overrides };
}

export function CampaignAnalyzerWorkspace({ analyses, initialAnalysis }: { analyses: CampaignAnalysis[]; initialAnalysis: CampaignAnalysis | null }) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialAnalysis));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = useMemo(() => calculateCampaign(draft, analysis?.automatic_metadata ?? {}, draft.manual_overrides), [draft, analysis?.automatic_metadata]);

  useEffect(() => {
    if (!analysis?.id || analysis.status !== "analyzing") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/campaign-analyzer/${analysis.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      setAnalysis(payload.analysis);
      setDraft(toDraft(payload.analysis));
    }, 2500);
    return () => clearInterval(timer);
  }, [analysis?.id, analysis?.status]);

  function updateDraft(key: keyof Draft, value: string | number | null | CampaignManualOverrides) { setDraft((current) => ({ ...current, [key]: value } as Draft)); }
  function updateOverride(source: CampaignSource, metric: keyof SourceMetrics, value: number | null) {
    setDraft((current) => {
      const sourceValues = { ...(current.manual_overrides[source] ?? {}) };
      if (value === null) delete sourceValues[metric]; else sourceValues[metric] = value as never;
      const manual_overrides = { ...current.manual_overrides, [source]: sourceValues };
      return { ...current, manual_overrides };
    });
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(analysis?.id ? `/api/campaign-analyzer/${analysis.id}` : "/api/campaign-analyzer", { method: analysis?.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Uloženie zlyhalo.");
      setAnalysis(payload.analysis); return payload.analysis as CampaignAnalysis;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Uloženie zlyhalo."); return null; }
    finally { setBusy(false); }
  }

  async function analyze() {
    if (busy || analysis?.status === "analyzing") return;
    const saved = await save(); if (!saved) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/campaign-analyzer/${saved.id}/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Analýza zlyhala.");
      setAnalysis({ ...payload.analysis, status: "analyzing" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Analýza zlyhala."); }
    finally { setBusy(false); }
  }

  const statusCopy = analysis?.status === "analyzing" ? "Analyzuje sa" : analysis?.status === "completed" ? (analysis.error_message === "Hotovo s upozornením" ? "Hotovo s upozornením" : "Hotovo") : analysis?.status === "failed" ? "Nepodarilo sa" : "Koncept";
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold text-white">Campaign Analyzer</p><p className="text-xs text-slate-500">{statusCopy}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setAnalysis(null); setDraft(toDraft(null)); setError(null); }} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">Nová analýza</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-50">Uložiť zmeny</button><button type="button" disabled={busy || analysis?.status === "analyzing"} onClick={() => void analyze()} className="rounded-md bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Analyzovať</button></div>
    </div>
    {error ? <p className="rounded-md border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p> : null}
    {analyses.length ? <div className="flex gap-2 overflow-x-auto pb-1">{analyses.map((item) => <Link key={item.id} href={`/app/campaign-analyzer?id=${item.id}`} className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">{item.creator_name}</Link>)}</div> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><Card><CampaignAnalyzerFields draft={draft} automatic={analysis?.automatic_metadata ?? {}} statuses={analysis?.source_statuses ?? {}} onDraft={updateDraft} onOverride={updateOverride} /></Card><CampaignAnalyzerResults result={result} /></div>
  </div>;
}
