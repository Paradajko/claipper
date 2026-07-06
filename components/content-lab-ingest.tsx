"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Link2, Loader2, UploadCloud } from "lucide-react";

type UploadSession = {
  videoId: string;
  bucket: string;
  storagePath: string;
  token: string;
  signedUrl: string;
};

const maxSizeMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB ?? 1000);

export function ContentLabIngest() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "link">("upload");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadVideo() {
    if (!file) {
      setError("Choose a video file first.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("Creating upload session.");
    setProgress(5);

    try {
      const sessionResponse = await fetch("/api/stream-scan/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || file.name,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size
        })
      });
      const sessionPayload = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(sessionPayload.error ?? "Could not create upload session.");

      const session = sessionPayload as UploadSession;
      setMessage("Uploading directly to Supabase Storage.");
      setProgress(15);

      await uploadWithProgress(session, file, (nextProgress) => {
        setProgress(Math.max(15, Math.min(92, nextProgress)));
      });

      setMessage("Queueing video for processing.");
      setProgress(95);

      const completeResponse = await fetch("/api/stream-scan/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: session.videoId, bucket: session.bucket, storagePath: session.storagePath })
      });
      const completePayload = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completePayload.error ?? "Upload finished, but processing could not be queued.");

      setProgress(100);
      window.location.href = completePayload.href;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setMessage(null);
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  async function importLink() {
    setBusy(true);
    setError(null);
    setMessage("Queueing platform import.");

    try {
      const response = await fetch("/api/stream-scan/import-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: linkTitle.trim(), sourceUrl: sourceUrl.trim() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not queue platform import.");
      window.location.href = payload.href;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import this link. Upload the video file directly.");
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  const fileSize = file ? formatBytes(file.size) : null;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/30 p-1 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={activeTab === "upload" ? "rounded-md bg-emerald-400 px-3 py-2 font-semibold text-slate-950" : "rounded-md px-3 py-2 font-semibold text-slate-300"}
        >
          Upload video
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("link")}
          className={activeTab === "link" ? "rounded-md bg-emerald-400 px-3 py-2 font-semibold text-slate-950" : "rounded-md px-3 py-2 font-semibold text-slate-300"}
        >
          Import from link
        </button>
      </div>

      {activeTab === "upload" ? (
        <div className="grid gap-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} label="Video title" placeholder="Stream title or episode name" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid gap-3 rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-left transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.04]"
          >
            <span className="flex items-center gap-2 font-medium text-white">
              <UploadCloud className="h-4 w-4 text-emerald-300" />
              {file ? file.name : "Choose video file"}
            </span>
            <span className="text-sm text-slate-400">
              {fileSize ? `${fileSize} selected.` : "MP4, MOV, MKV or WEBM. Large files upload directly to Supabase Storage."}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime,video/x-matroska,video/webm"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-slate-500">Current upload limit: {maxSizeMb} MB. Supported formats: MP4, MOV, MKV, WEBM.</p>
          <ProgressBar progress={progress} />
          <button
            type="button"
            disabled={busy}
            onClick={uploadVideo}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Upload and queue scan
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          <Input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} label="Video title" placeholder="Optional title" />
          <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} label="Platform link" placeholder="YouTube, Twitch or Kick URL" />
          <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-400">
            Platform imports are processed by the worker and may take longer for long videos.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={importLink}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Import with worker
          </button>
        </div>
      )}

      {message ? <p className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p> : null}
    </div>
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

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="grid gap-2">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.55)] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-slate-500">{progress > 0 ? `${progress}% uploaded / queued` : "Upload progress will appear here."}</p>
    </div>
  );
}

async function uploadWithProgress(session: UploadSession, file: File, onProgress: (progress: number) => void) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase upload configuration is missing.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  let stagedProgress = 15;
  const stagedTimer = window.setInterval(() => {
    stagedProgress = Math.min(88, stagedProgress + 7);
    onProgress(stagedProgress);
  }, 600);

  try {
    const { error } = await supabase.storage
      .from(session.bucket)
      .uploadToSignedUrl(session.storagePath, session.token, file, { contentType: file.type || "application/octet-stream", upsert: true });
    if (error) throw new Error(cleanStorageUploadError(error.message));
    onProgress(92);
  } finally {
    window.clearInterval(stagedTimer);
  }
}

function cleanStorageUploadError(message: string) {
  if (/exceeded the maximum allowed size|maximum allowed size|file size limit|payload too large/i.test(message)) {
    return `Supabase Storage is still capped below this file size. Current app upload limit is ${maxSizeMb} MB; increase the original-videos bucket file size limit and try again.`;
  }
  return message || "Upload to Supabase Storage failed.";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
