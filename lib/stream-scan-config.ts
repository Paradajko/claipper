export const storageBuckets = {
  originals: process.env.STORAGE_BUCKET_ORIGINALS ?? "original-videos",
  audio: process.env.STORAGE_BUCKET_AUDIO ?? "extracted-audio",
  clips: process.env.STORAGE_BUCKET_CLIPS ?? "rendered-clips",
  subtitles: process.env.STORAGE_BUCKET_SUBTITLES ?? "subtitles"
} as const;

export const streamScanFlags = {
  directUploads: process.env.ENABLE_DIRECT_UPLOADS !== "false",
  platformImports: process.env.ENABLE_PLATFORM_IMPORTS !== "false",
  workerProcessing: process.env.ENABLE_WORKER_PROCESSING !== "false"
} as const;

export const supportedVideoExtensions = ["mp4", "mov", "mkv", "webm"] as const;
export const supportedVideoMimeTypes = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"] as const;

export function maxUploadSizeBytes() {
  const mb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 5120);
  return Math.max(1, mb) * 1024 * 1024;
}

export function detectPlatform(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
    if (hostname === "youtu.be" || hostname === "youtube.com" || hostname.endsWith(".youtube.com")) return "youtube";
    if (hostname === "twitch.tv" || hostname === "clips.twitch.tv" || hostname.endsWith(".twitch.tv")) return "twitch";
    if (hostname === "kick.com" || hostname.endsWith(".kick.com")) return "kick";
    return null;
  } catch {
    return null;
  }
}

export function isSupportedVideoFile(filename: string, mimeType: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return Boolean(
    extension &&
      (supportedVideoExtensions as readonly string[]).includes(extension) &&
      ((supportedVideoMimeTypes as readonly string[]).includes(mimeType) || mimeType === "application/octet-stream")
  );
}

export function safeStorageExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension && (supportedVideoExtensions as readonly string[]).includes(extension) ? extension : "mp4";
}
