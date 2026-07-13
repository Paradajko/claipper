import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Worker runtime modules are authored as ESM JavaScript.
import { downloadOriginalVideo, uploadOriginalVideo } from "./object-storage.mjs";

const objectEnvKeys = [
  "OBJECT_STORAGE_PROVIDER",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_REGION",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY"
];

describe("worker object storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of objectEnvKeys) {
      delete process.env[key];
    }
  });

  it("streams object storage downloads to disk without buffering the whole response", async () => {
    process.env.OBJECT_STORAGE_PROVIDER = "r2";
    process.env.OBJECT_STORAGE_ENDPOINT = "https://account.r2.cloudflarestorage.com";
    process.env.OBJECT_STORAGE_REGION = "auto";
    process.env.OBJECT_STORAGE_BUCKET = "source-videos";
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID = "access";
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY = "secret";

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "claipper-object-storage-test-"));
    const outputPath = path.join(tempDir, "source.mp4");
    const arrayBuffer = vi.fn(async () => {
      throw new Error("arrayBuffer should not be used for large object downloads.");
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      body: Readable.toWeb(Readable.from(["video", "-bytes"])),
      arrayBuffer
    })));

    try {
      await downloadOriginalVideo({ provider: "r2", storagePath: "originals/video/source.mp4", outputPath });

      await expect(readFile(outputPath, "utf8")).resolves.toBe("video-bytes");
      expect(arrayBuffer).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exposes a multipart upload helper for large original videos", () => {
    expect(typeof uploadOriginalVideo).toBe("function");
  });
});
