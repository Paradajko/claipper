"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Link2, Loader2, UploadCloud } from "lucide-react";

type UploadSession = {
  videoId: string;
  bucket: string;
  storagePath: string;
  sourceStorageProvider?: "r2" | "supabase";
  sourceStoragePath?: string;
  token: string | null;
  signedUrl: string;
  uploadMethod?: "r2_put" | "supabase_signed";
  headers?: Record<string, string>;
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
      setMessage("Uploading video.");
      setProgress(15);

      await uploadWithProgress(session, file, (nextProgress) => {
        setProgress(Math.max(15, Math.min(92, nextProgress)));
      });

      setMessage("Starting analysis.");
      setProgress(95);

      const completeResponse = await fetch("/api/stream-scan/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: session.videoId,
          bucket: session.bucket,
          storagePath: session.storagePath,
          sourceStorageProvider: session.sourceStorageProvider,
          sourceStoragePath: session.sourceStoragePath
        })
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
    setMessage("Starting link analysis.");

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
      <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/25 p-1 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={activeTab === "upload" ? "rounded-md bg-emerald-400/90 px-3 py-2 font-semibold text-slate-950" : "rounded-md px-3 py-2 font-semibold text-slate-300 transition hover:bg-white/[0.05]"}
        >
          Upload video
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("link")}
          className={activeTab === "link" ? "rounded-md bg-emerald-400/90 px-3 py-2 font-semibold text-slate-950" : "rounded-md px-3 py-2 font-semibold text-slate-300 transition hover:bg-white/[0.05]"}
        >
          Paste link
        </button>
      </div>

      {activeTab === "upload" ? (
        <div className="grid gap-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} label="Video title" placeholder="Optional title" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="content-lab-dropzone grid min-h-44 gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.045] p-6 text-left transition hover:border-emerald-400/45 hover:bg-emerald-400/[0.07]"
          >
            <span className="relative flex flex-col gap-4 font-medium text-white sm:flex-row sm:items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                <UploadCloud className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold">{file ? file.name : "Drop a video here"}</span>
                <span className="mt-2 block text-sm font-normal text-slate-400">
                  {fileSize ? `${fileSize} selected.` : "Choose an MP4, MOV, MKV or WEBM file to start finding clips."}
                </span>
              </span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime,video/x-matroska,video/webm"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-slate-500">Current upload limit: {maxSizeMb} MB · MP4, MOV, MKV, WEBM</p>
          <ProgressBar progress={progress} />
          <button
            type="button"
            disabled={busy}
            onClick={uploadVideo}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start analysis
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          <Input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} label="Video title" placeholder="Optional title" />
          <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} label="Platform link" placeholder="YouTube, Twitch or Kick URL" />
          <p className="rounded-md border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-slate-400">
            Paste a public video link when the source is already online. Uploading a file is usually faster for long videos.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={importLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Analyze link
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
      <input {...props} className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-emerald-400/60" />
    </label>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="grid gap-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-slate-500">{progress > 0 ? `${progress}% uploaded` : "Upload progress will appear here."}</p>
    </div>
  );
}

async function uploadWithProgress(session: UploadSession, file: File, onProgress: (progress: number) => void) {
  if (session.uploadMethod === "r2_put") {
    await uploadToR2WithProgress(session, file, onProgress);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase upload configuration is missing.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  if (!session.token) {
    throw new Error("Supabase upload token is missing.");
  }
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

async function uploadToR2WithProgress(session: UploadSession, file: File, onProgress: (progress: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", session.signedUrl);
    for (const [key, value] of Object.entries(session.headers ?? {})) {
      request.setRequestHeader(key, value);
    }
    if (!session.headers?.["Content-Type"]) {
      request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(15 + Math.round((event.loaded / event.total) * 77));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(92);
        resolve();
      } else {
        reject(new Error(`Upload to R2 failed with status ${request.status}.`));
      }
    };
    request.onerror = () => reject(new Error("Upload to R2 failed. Check the R2 bucket CORS settings and try again."));
    request.send(file);
  });
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
