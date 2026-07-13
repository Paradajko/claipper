import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createLocalVideoLayout, localRelativePath, resolveLocalMediaPath } from "./local-storage.mjs";

const roots: string[] = [];
const videoId = "e9ac4e02-6176-477c-a0ee-73b969b4493a";

describe("local media storage", () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("creates a stable per-video layout with relative database paths", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claipper-local-storage-"));
    roots.push(root);

    const layout = await createLocalVideoLayout(root, videoId, "MP4");

    expect(layout.sourceRelativePath).toBe(`${videoId}/original/source.mp4`);
    expect(layout.chatRelativePath).toBe(`${videoId}/original/chat.json`);
    expect(layout.normalizedChatRelativePath).toBe(`${videoId}/working/normalized-chat.json`);
    expect(layout.clipsRelativeDir).toBe(`${videoId}/clips`);
    await expect(stat(layout.originalDir)).resolves.toMatchObject({});
    await expect(stat(layout.workingDir)).resolves.toMatchObject({});
    await expect(stat(layout.clipsDir)).resolves.toMatchObject({});
  });

  it.each(["mpg", "mpeg"])("accepts MPEG source extension %s", async (extension) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claipper-local-storage-"));
    roots.push(root);

    const layout = await createLocalVideoLayout(root, videoId, extension);

    expect(layout.sourceRelativePath).toBe(`${videoId}/original/source.${extension}`);
  });

  it("rejects invalid IDs and unsupported source extensions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claipper-local-storage-"));
    roots.push(root);

    await expect(createLocalVideoLayout(root, "../escape", "mp4")).rejects.toThrow("valid UUID");
    await expect(createLocalVideoLayout(root, videoId, "exe")).rejects.toThrow("Unsupported video extension");
  });

  it("never resolves a media path outside the configured root", () => {
    const root = "/tmp/claipper-storage";

    expect(resolveLocalMediaPath(root, `${videoId}/clips/clip.mp4`)).toBe(
      path.join(root, videoId, "clips", "clip.mp4")
    );
    expect(() => resolveLocalMediaPath(root, "../secret")).toThrow("outside local storage root");
    expect(() => resolveLocalMediaPath(root, "/etc/passwd")).toThrow("relative");
  });

  it("builds portable relative paths and rejects traversal segments", () => {
    expect(localRelativePath(videoId, "clips", "clip-id", "ready.mp4")).toBe(
      `${videoId}/clips/clip-id/ready.mp4`
    );
    expect(() => localRelativePath(videoId, "..", "ready.mp4")).toThrow("Unsafe local path segment");
  });
});
