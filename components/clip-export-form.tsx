"use client";

import { FormEvent, useMemo, useState } from "react";
import { Play } from "lucide-react";
import type { ClipIdea, MomentV3Metadata } from "@/lib/types";

type ExportStatus = {
  active: boolean;
  label: string | null;
  tone?: "default" | "error";
};

export function ClipExportForm({
  idea,
  exportStatus,
  onSubmit
}: {
  idea: ClipIdea;
  exportStatus: ExportStatus;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const recommendation = useMemo(() => momentV3(idea), [idea]);
  const recommendedColdOpen = recommendation?.hook_mode === "cold_open"
    && recommendation.hook_start_seconds != null
    && recommendation.hook_end_seconds != null;
  const [hookMode, setHookMode] = useState<"natural" | "cold_open">(recommendedColdOpen ? "cold_open" : "natural");

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <form
        action={`/api/stream-scan/clip-ideas/${idea.id}/ready-clip`}
        method="post"
        className="grid gap-3"
        onSubmit={onSubmit}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Start" name="startSeconds" defaultValue={idea.start_time} disabled={exportStatus.active} />
          <NumberField label="End" name="endSeconds" defaultValue={idea.end_time} disabled={exportStatus.active} />
          <SelectField label="Hook" name="hookMode" value={hookMode} disabled={exportStatus.active} onChange={(value) => setHookMode(value as "natural" | "cold_open")} options={[
            { label: "Natural", value: "natural" },
            { label: "Cold open", value: "cold_open" }
          ]} />
          <SelectField label="Framing" name="framingMode" defaultValue="center" disabled={exportStatus.active} options={[
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" }
          ]} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Hook start"
            name="hookStartSeconds"
            defaultValue={recommendation?.hook_start_seconds ?? idea.start_time}
            disabled={exportStatus.active || hookMode === "natural"}
          />
          <NumberField
            label="Hook end"
            name="hookEndSeconds"
            defaultValue={recommendation?.hook_end_seconds ?? Math.min(idea.end_time, idea.start_time + 2)}
            disabled={exportStatus.active || hookMode === "natural"}
          />
          <SelectField label="Background" name="backgroundMode" defaultValue="crop" disabled={exportStatus.active} options={[
            { label: "Crop", value: "crop" },
            { label: "Blur background", value: "blur" }
          ]} />
        </div>

        <input type="hidden" name="subtitlePreset" value="creator" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Toggle label="Creator captions" name="addCaptions" disabled={exportStatus.active} defaultChecked />
            <Toggle label="Creator Enhance" name="enhanceEnabled" disabled={exportStatus.active} defaultChecked />
          </div>
          <button disabled={exportStatus.active} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(16,185,129,.25)] hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            <Play className="h-4 w-4" />
            {exportStatus.active ? "Exporting..." : "Export 9:16 Clip"}
          </button>
        </div>
      </form>
      {exportStatus.label ? <p className={`mt-2 text-sm ${exportStatus.tone === "error" ? "text-rose-200" : "text-slate-400"}`}>{exportStatus.label}</p> : null}
    </div>
  );
}

function NumberField({ defaultValue, disabled, label, name }: { defaultValue: number; disabled: boolean; label: string; name: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input type="number" step="0.1" min="0" name={name} defaultValue={defaultValue} disabled={disabled} className="h-10 min-w-0 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50 disabled:opacity-60" />
    </label>
  );
}

function SelectField({ defaultValue, disabled, label, name, onChange, options, value }: {
  defaultValue?: string;
  disabled: boolean;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select name={name} defaultValue={value == null ? defaultValue : undefined} value={value} disabled={disabled} onChange={(event) => onChange?.(event.currentTarget.value)} className="h-10 min-w-0 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50 disabled:opacity-60">
        {options.map((option) => <option key={option.value} value={option.value} className="bg-slate-950">{option.label}</option>)}
      </select>
    </label>
  );
}

function Toggle({ defaultChecked, disabled, label, name }: { defaultChecked?: boolean; disabled: boolean; label: string; name: string }) {
  return (
    <label className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium text-slate-200">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} disabled={disabled} className="h-4 w-4 rounded border-white/20 bg-black accent-emerald-400" />
      {label}
    </label>
  );
}

function momentV3(idea: ClipIdea): MomentV3Metadata | null {
  const raw = idea.raw_data?.moment_v3;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as unknown as MomentV3Metadata : null;
}
