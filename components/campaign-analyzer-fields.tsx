"use client";

import React from "react";
import type { CampaignAutomaticMetadata, CampaignInputs, CampaignManualOverrides, CampaignSource, SourceCollectionState, SourceMetrics } from "@/lib/campaign-analyzer/types";

const inputClass = "h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-400/60";
type Draft = CampaignInputs & { manual_overrides: CampaignManualOverrides };

export function CampaignAnalyzerFields({ draft, automatic, statuses, onDraft, onOverride }: {
  draft: Draft;
  automatic: CampaignAutomaticMetadata;
  statuses: Partial<Record<CampaignSource, SourceCollectionState>>;
  onDraft: (key: keyof Draft, value: string | number | null | CampaignManualOverrides) => void;
  onOverride: (source: CampaignSource, metric: keyof SourceMetrics, value: number | null) => void;
}) {
  const text = (label: string, key: keyof Draft, value: string | null, placeholder = "") => <Field label={label}><input className={inputClass} value={value ?? ""} placeholder={placeholder} onChange={(e) => onDraft(key, e.target.value || null)} /></Field>;
  const number = (label: string, key: keyof Draft, value: number | null) => <Field label={label}><input className={inputClass} type="number" min="0" step="any" value={value ?? ""} onChange={(e) => onDraft(key, e.target.value === "" ? null : Number(e.target.value))} /></Field>;
  return <div className="space-y-7">
    <Section title="Kampaň"><div className="grid gap-3 sm:grid-cols-2">
      {text("Meno creatora", "creator_name", draft.creator_name)}
      {number("Mesačný budget (€)", "monthly_budget_eur", draft.monthly_budget_eur)}
      {number("Odmena za 1 000 views (€)", "reward_per_1000_views_eur", draft.reward_per_1000_views_eur)}
      {number("Klipov denne", "clips_per_day", draft.clips_per_day)}
      {number("Počet dní kampane", "campaign_duration_days", draft.campaign_duration_days)}
      {number("Jeden dobrý klip každých X hodín", "content_hours_per_good_clip", draft.content_hours_per_good_clip)}
    </div></Section>
    <Section title="Kanály"><div className="grid gap-3 sm:grid-cols-2">
      {text("YouTube link", "youtube_url", draft.youtube_url, "https://youtube.com/@creator")}
      {text("Kick link", "kick_url", draft.kick_url, "https://kick.com/creator")}
      {text("YouTube link clippera (voliteľné)", "clipper_youtube_url", draft.clipper_youtube_url, "https://youtube.com/@clipper")}
    </div></Section>
    <Section title="Distribúcia"><div className="grid gap-3 sm:grid-cols-2">
      {number("TikTok účty", "tiktok_account_count", draft.tiktok_account_count)}
      {number("Instagram účty", "instagram_account_count", draft.instagram_account_count)}
      {number("YouTube Shorts účty", "youtube_shorts_account_count", draft.youtube_shorts_account_count)}
      {number("Očakávané views na upload", "manual_expected_views_per_upload", draft.manual_expected_views_per_upload)}
    </div></Section>
    <Section title="Zistené údaje"><div className="space-y-4">
      {(["youtube", "kick", "clipper"] as CampaignSource[]).map((source) => <SourceEditor key={source} source={source} automatic={automatic[source]} overrides={draft.manual_overrides[source]} state={statuses[source]} onOverride={onOverride} />)}
    </div></Section>
  </div>;
}

function SourceEditor({ source, automatic, overrides, state, onOverride }: { source: CampaignSource; automatic?: SourceMetrics; overrides?: Partial<SourceMetrics>; state?: SourceCollectionState; onOverride: (source: CampaignSource, metric: keyof SourceMetrics, value: number | null) => void }) {
  const labels: Record<CampaignSource, string> = { youtube: "YouTube", kick: "Kick", clipper: "Clipper Shorts" };
  const metrics: Array<[keyof SourceMetrics, string, number]> = [["item_count", "Počet videí/streamov", 1], ["total_duration_seconds", "Obsah (hodiny)", 3600], ["average_views", "Priemerné views", 1], ["median_views", "Medián views", 1], ["top_views", "Top views", 1]];
  if (source !== "kick") metrics.push(["shorts_median_views", "Medián Shorts", 1]);
  return <div className="rounded-md border border-white/10 bg-white/[0.025] p-3">
    <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{labels[source]}</h3><span className="text-xs text-slate-400">{state?.status === "failed" ? "Nepodarilo sa" : state?.status === "completed" ? "Hotovo" : state?.status === "pending" ? "Analyzuje sa" : "Nezistené"}</span></div>
    {state?.error ? <p className="mb-3 text-xs text-rose-300">{state.error}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2">{metrics.map(([metric, label, divisor]) => {
      const hasOverride = Object.prototype.hasOwnProperty.call(overrides ?? {}, metric);
      const autoValue = automatic?.[metric];
      const raw = hasOverride ? overrides?.[metric] : autoValue;
      const origin = hasOverride ? "Ručne upravené" : autoValue == null ? "Nezistené" : state?.stale ? "Staršie dáta" : "Automaticky";
      return <Field key={metric} label={label} note={origin}><input className={inputClass} type="number" min="0" step="any" value={typeof raw === "number" ? raw / divisor : ""} onChange={(e) => onOverride(source, metric, e.target.value === "" ? null : Number(e.target.value) * divisor)} /></Field>;
    })}</div>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">{title}</h2>{children}</section>; }
function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) { return <label className="grid gap-1 text-xs text-slate-300"><span className="flex justify-between gap-2"><span>{label}</span>{note ? <span className="text-[10px] text-slate-500">{note}</span> : null}</span>{children}</label>; }
