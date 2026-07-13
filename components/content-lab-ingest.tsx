"use client";

import { useEffect, useRef, useState } from "react";
import { FileJson, KeyRound, Loader2, UploadCloud } from "lucide-react";

type LocalUploadResponse = {
  videoId: string;
  href: string;
  error?: string;
};

const agentUrl = (process.env.NEXT_PUBLIC_CLAIPPER_AGENT_URL ?? "http://127.0.0.1:43120").replace(/\/+$/, "");
const maxSizeMb = Number(process.env.NEXT_PUBLIC_CLAIPPER_LOCAL_MAX_UPLOAD_SIZE_MB ?? 20000);
const agentTokenKey = "claipper_local_agent_token";

export function ContentLabIngest() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatOffsetSeconds, setChatOffsetSeconds] = useState("0");
  const [agentToken, setAgentToken] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAgentToken(window.localStorage.getItem("claipper_local_agent_token") ?? "");
  }, []);

  function updateAgentToken(value: string) {
    setAgentToken(value);
    if (value) window.localStorage.setItem(agentTokenKey, value);
    else window.localStorage.removeItem(agentTokenKey);
  }

  async function uploadVideo() {
    if (!file) {
      setError("Choose a video file first.");
      return;
    }
    if (!agentToken.trim()) {
      setError("Enter the local agent token first.");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Video exceeds the ${maxSizeMb} MB local upload limit.`);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("Checking local agent.");
    setProgress(2);

    try {
      const health = await fetch(`${agentUrl}/health`, { cache: "no-store" });
      if (!health.ok) throw new Error("Local agent is offline. Start npm run dev:local and try again.");
      const healthPayload = await health.json();
      if (!healthPayload.ok || !healthPayload.tools?.ffmpeg || !healthPayload.tools?.ffprobe || !healthPayload.tools?.openai) {
        throw new Error("Local agent is online, but FFmpeg, FFprobe or OpenAI is not ready.");
      }

      const formData = new FormData();
      formData.append("title", title.trim() || file.name);
      formData.append("video", file, file.name);
      formData.append("chat_offset_seconds", chatOffsetSeconds || "0");
      if (chatFile) formData.append("chat", chatFile, chatFile.name);

      setMessage("Uploading to local Claipper agent.");
      const payload = await uploadToLocalAgent(formData, agentToken.trim(), (nextProgress) => {
        setProgress(Math.max(2, Math.min(99, nextProgress)));
      });
      setProgress(100);
      setMessage("Upload complete. Opening analysis.");
      window.location.href = payload.href;
    } catch (caught) {
      const caughtMessage = caught instanceof Error ? caught.message : "Local upload failed.";
      setError(/failed to fetch|networkerror|load failed/i.test(caughtMessage)
        ? "Local agent is offline. Start npm run dev:local and try again."
        : caughtMessage);
      setMessage(null);
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  const fileSize = file ? formatBytes(file.size) : null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} label="Video title" placeholder="Optional title" />

        <button
          type="button"
          aria-label="Upload video"
          onClick={() => fileInputRef.current?.click()}
          className="content-lab-dropzone grid min-h-44 gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.045] p-6 text-left transition hover:border-emerald-400/45 hover:bg-emerald-400/[0.07]"
        >
          <span className="relative flex flex-col gap-4 font-medium text-white sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              <UploadCloud className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block break-words text-lg font-semibold">{file ? file.name : "Drop a video here"}</span>
              <span className="mt-2 block text-sm font-normal text-slate-400">
                {fileSize ? `${fileSize} selected.` : "Choose an MP4, MOV, MKV, WEBM, MPG or MPEG file."}
              </span>
            </span>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.mkv,.webm,.mpg,.mpeg,video/mp4,video/quicktime,video/x-matroska,video/webm,video/mpeg"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-end">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-300">Kick chat JSON <span className="text-slate-500">(optional)</span></p>
            <button
              type="button"
              onClick={() => chatInputRef.current?.click()}
              className="mt-2 inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-300/10"
            >
              <FileJson className="h-4 w-4 shrink-0" />
              <span className="truncate">{chatFile?.name ?? "Choose JSON"}</span>
            </button>
            <input
              ref={chatInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => setChatFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <Input
            type="number"
            step="0.1"
            value={chatOffsetSeconds}
            onChange={(event) => setChatOffsetSeconds(event.target.value)}
            label="Chat offset (seconds)"
          />
        </div>

        <label className="grid gap-1 text-sm text-slate-300">
          Local agent token
          <span className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              autoComplete="off"
              value={agentToken}
              onChange={(event) => updateAgentToken(event.target.value)}
              className="h-11 w-full rounded-md border border-white/10 bg-black/20 pl-10 pr-3 text-white outline-none focus:border-emerald-400/60"
            />
          </span>
        </label>

        <p className="text-xs text-slate-500">Current local upload limit: {maxSizeMb} MB · MP4, MOV, MKV, WEBM, MPG, MPEG</p>
        <ProgressBar progress={progress} />
        <button
          type="button"
          disabled={busy || !file}
          onClick={uploadVideo}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Start analysis
        </button>
      </div>

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

async function uploadToLocalAgent(formData: FormData, token: string, onProgress: (progress: number) => void) {
  return new Promise<LocalUploadResponse>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${agentUrl}/uploads`);
    request.setRequestHeader("X-Claipper-Agent-Token", token);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 98));
    };
    request.onload = () => {
      let payload: LocalUploadResponse;
      try {
        payload = JSON.parse(request.responseText) as LocalUploadResponse;
      } catch {
        reject(new Error(`Local agent returned an invalid response (${request.status}).`));
        return;
      }
      if (request.status >= 200 && request.status < 300 && payload.href) {
        onProgress(100);
        resolve(payload);
      } else {
        reject(new Error(payload.error ?? `Local upload failed with status ${request.status}.`));
      }
    };
    request.onerror = () => reject(new Error("Local agent is offline. Start npm run dev:local and try again."));
    request.send(formData);
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
