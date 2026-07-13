import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLocalAgent } from "./local-agent-server.mjs";

const roots: string[] = [];

describe("Claipper local agent", () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("reports loopback readiness without exposing secrets", async () => {
    const { app } = await createAgent();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      mode: "local",
      tools: { ffmpeg: true, ffprobe: true, openai: true }
    });
    expect(response.body).not.toContain("test-token");
    await app.close();
  });

  it("requires the local agent token for uploads", async () => {
    const { app } = await createAgent();
    const response = await app.inject({ method: "POST", url: "/uploads" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("streams a video and optional Kick chat into the local layout", async () => {
    const createUploadRecords = vi.fn(async () => undefined);
    const { app, root } = await createAgent(createUploadRecords);
    const multipart = multipartBody([
      { name: "title", value: "Test stream" },
      { name: "chat_offset_seconds", value: "2.5" },
      { name: "video", filename: "stream.mp4", contentType: "video/mp4", value: Buffer.from("video-bytes") },
      {
        name: "chat",
        filename: "chat.json",
        contentType: "application/json",
        value: Buffer.from(JSON.stringify([
          { content: "[emote:37226:KEKW]", createdAt: "2026-06-28T15:49:43Z", username: "viewer" }
        ]))
      }
    ]);
    const response = await app.inject({
      method: "POST",
      url: "/uploads",
      headers: {
        "x-claipper-agent-token": "test-token",
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`
      },
      payload: multipart.body
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload.videoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.href).toBe(`/app/content-lab/${payload.videoId}`);
    await expect(readFile(path.join(root, payload.videoId, "original", "source.mp4"), "utf8")).resolves.toBe("video-bytes");
    await expect(readFile(path.join(root, payload.videoId, "original", "chat.json"), "utf8")).resolves.toContain("KEKW");
    const normalized = JSON.parse(await readFile(path.join(root, payload.videoId, "working", "normalized-chat.json"), "utf8"));
    expect(normalized[0]).toMatchObject({ timestamp_seconds: 2.5, message: "KEKW", emotes: ["KEKW"] });
    expect(createUploadRecords).toHaveBeenCalledWith(expect.objectContaining({
      videoId: payload.videoId,
      title: "Test stream",
      sourceStorageProvider: "local",
      chatOffsetSeconds: 2.5
    }));
    await app.close();
  });

  it("serves byte ranges and blocks paths outside local storage", async () => {
    const { app, root } = await createAgent();
    const relativePath = "e9ac4e02-6176-477c-a0ee-73b969b4493a/clips/clip/ready.mp4";
    const filepath = path.join(root, relativePath);
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(filepath), { recursive: true }));
    await writeFile(filepath, "0123456789");

    const rangeResponse = await app.inject({
      method: "GET",
      url: `/media/${relativePath}`,
      headers: { range: "bytes=2-5" }
    });
    expect(rangeResponse.statusCode).toBe(206);
    expect(rangeResponse.body).toBe("2345");
    expect(rangeResponse.headers["content-range"]).toBe("bytes 2-5/10");

    const traversalResponse = await app.inject({ method: "GET", url: "/media/%2e%2e%2fsecret" });
    expect(traversalResponse.statusCode).toBe(400);
    await app.close();
  });
});

async function createAgent(createUploadRecords = vi.fn(async () => undefined)) {
  const root = await mkdtemp(path.join(os.tmpdir(), "claipper-local-agent-"));
  roots.push(root);
  const app = await buildLocalAgent({
    storageRoot: root,
    agentToken: "test-token",
    allowedOrigins: ["http://localhost:3000"],
    maxUploadBytes: 1024 * 1024,
    createUploadRecords,
    toolChecks: async () => ({ ffmpeg: true, ffprobe: true, openai: true })
  });
  return { app, root };
}

type MultipartPart = {
  name: string;
  value: string | Buffer;
  filename?: string;
  contentType?: string;
};

function multipartBody(parts: MultipartPart[]) {
  const boundary = "claipper-test-boundary";
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: ${part.contentType}\r\n\r\n`
      : `Content-Disposition: form-data; name="${part.name}"\r\n\r\n`;
    chunks.push(Buffer.from(disposition));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(chunks) };
}
