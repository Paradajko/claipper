"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  use_case: z.enum(["tiktok", "podcast", "youtube-shorts", "instagram-reels", "other"]),
  videos_per_week: z.enum(["1-5", "5-10", "10+"]),
  how_did_you_hear: z.string().optional(),
  honeypot: z.string().max(0)
});

const useCaseOptions = [
  { label: "TikTok Shorts", value: "tiktok" },
  { label: "Podcast clips", value: "podcast" },
  { label: "YouTube Long → Shorts", value: "youtube-shorts" },
  { label: "Instagram Reels", value: "instagram-reels" },
  { label: "Other / not sure yet", value: "other" }
] as const;

const volumeOptions = ["1-5", "5-10", "10+"] as const;

type Toast = "success" | "error" | null;

export default function RequestAccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => emailRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!open && !toast) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? ""),
      name: optionalValue(formData.get("name")),
      use_case: String(formData.get("use_case") ?? ""),
      videos_per_week: String(formData.get("videos_per_week") ?? ""),
      how_did_you_hear: optionalValue(formData.get("how_did_you_hear")),
      honeypot: String(formData.get("honeypot") ?? "")
    };

    const parsed = formSchema.safeParse(payload);
    if (!parsed.success) {
      setError("Enter a valid email and select the required options.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data)
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      event.currentTarget.reset();
      setToast("success");
      onClose();
    } catch {
      setToast("error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm" onMouseDown={onClose}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Request Early Access"
            className="max-h-[calc(100vh-4rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-emerald-400/20 bg-slate-900 p-6 shadow-[0_24px_120px_rgba(0,0,0,.55)] sm:p-8"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Request Early Access</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Tell us what you want to clip and we will get back to you.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <input type="text" name="honeypot" className="hidden" tabIndex={-1} autoComplete="off" />

              <label className="grid gap-1.5 text-sm font-medium text-slate-200">
                Email
                <input
                  ref={emailRef}
                  required
                  type="email"
                  name="email"
                  className="h-11 rounded-md border border-slate-700 bg-slate-800/50 px-3 text-white outline-none transition focus:border-emerald-400/60"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-slate-200">
                Name
                <input
                  type="text"
                  name="name"
                  className="h-11 rounded-md border border-slate-700 bg-slate-800/50 px-3 text-white outline-none transition focus:border-emerald-400/60"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium text-slate-200">
                Use case
                <select
                  name="use_case"
                  defaultValue="youtube-shorts"
                  className="h-11 rounded-md border border-slate-700 bg-slate-800/50 px-3 text-white outline-none transition focus:border-emerald-400/60"
                >
                  {useCaseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-200">Videos per week</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {volumeOptions.map((option) => (
                    <label
                      key={option}
                      className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-800/50 px-3 text-sm text-slate-200 transition hover:border-emerald-400/40"
                    >
                      <input required type="radio" name="videos_per_week" value={option} className="accent-emerald-400" />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="grid gap-1.5 text-sm font-medium text-slate-200">
                How did you hear about us?
                <input
                  type="text"
                  name="how_did_you_hear"
                  className="h-11 rounded-md border border-slate-700 bg-slate-800/50 px-3 text-white outline-none transition focus:border-emerald-400/60"
                />
              </label>

              {error ? <p className="text-sm text-rose-200">{error}</p> : null}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="h-11 px-3 text-sm font-semibold text-slate-400 transition hover:text-white">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
                >
                  {submitting ? "Sending..." : "Send request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-[60] animate-[slide-in_.22s_ease-out] rounded-md border border-emerald-400/40 bg-slate-900 px-4 py-3 text-sm text-emerald-200 shadow-[0_16px_70px_rgba(0,0,0,.45)]">
          {toast === "success" ? "Thanks! We'll be in touch." : "Something went wrong, please try again."}
        </div>
      ) : null}
    </>
  );
}

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}
