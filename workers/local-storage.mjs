import path from "node:path";
import { mkdir } from "node:fs/promises";

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "webm", "mpg", "mpeg"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createLocalVideoLayout(root, videoId, extension) {
  if (!UUID_PATTERN.test(String(videoId ?? ""))) throw new Error("Video ID must be a valid UUID.");
  const normalizedExtension = String(extension ?? "").replace(/^\./, "").toLowerCase();
  if (!VIDEO_EXTENSIONS.has(normalizedExtension)) throw new Error("Unsupported video extension.");

  const originalRelativeDir = localRelativePath(videoId, "original");
  const workingRelativeDir = localRelativePath(videoId, "working");
  const clipsRelativeDir = localRelativePath(videoId, "clips");
  const originalDir = resolveLocalMediaPath(root, originalRelativeDir);
  const workingDir = resolveLocalMediaPath(root, workingRelativeDir);
  const clipsDir = resolveLocalMediaPath(root, clipsRelativeDir);
  await Promise.all([
    mkdir(originalDir, { recursive: true }),
    mkdir(workingDir, { recursive: true }),
    mkdir(clipsDir, { recursive: true })
  ]);

  return {
    videoId,
    root: path.resolve(root),
    originalDir,
    workingDir,
    clipsDir,
    clipsRelativeDir,
    sourceRelativePath: localRelativePath(videoId, "original", `source.${normalizedExtension}`),
    chatRelativePath: localRelativePath(videoId, "original", "chat.json"),
    normalizedChatRelativePath: localRelativePath(videoId, "working", "normalized-chat.json"),
    metadataRelativePath: localRelativePath(videoId, "metadata.json")
  };
}

export function resolveLocalMediaPath(root, relativePath) {
  if (!root || !path.isAbsolute(root)) throw new Error("Local storage root must be absolute.");
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error("Local media path must be relative.");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Path is outside local storage root.");
  }
  return resolved;
}

export function localRelativePath(...segments) {
  if (segments.length === 0 || segments.some((segment) => !isSafeSegment(segment))) {
    throw new Error("Unsafe local path segment.");
  }
  return path.posix.join(...segments.map(String));
}

function isSafeSegment(value) {
  const segment = String(value ?? "");
  return Boolean(segment) && segment !== "." && segment !== ".." && !segment.includes("/") && !segment.includes("\\") && !segment.includes("\0");
}
