import { createReadStream, createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { normalizeKickChat } from "./kick-chat.mjs";
import { createLocalVideoLayout, resolveLocalMediaPath } from "./local-storage.mjs";

const CHAT_MAX_BYTES = 25 * 1024 * 1024;
const CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".json": "application/json",
  ".ass": "text/x-ssa"
};

export async function buildLocalAgent({
  storageRoot,
  agentToken,
  allowedOrigins = [],
  maxUploadBytes,
  createUploadRecords,
  toolChecks
}) {
  if (!storageRoot || !path.isAbsolute(storageRoot)) throw new Error("Local agent storage root must be absolute.");
  if (!agentToken) throw new Error("CLAIPPER_LOCAL_AGENT_TOKEN is required.");
  if (!Number.isFinite(maxUploadBytes) || maxUploadBytes <= 0) throw new Error("Local upload limit must be positive.");
  if (typeof createUploadRecords !== "function") throw new Error("Local upload record handler is required.");

  const app = Fastify({ logger: false, bodyLimit: maxUploadBytes });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Origin is not allowed."), false);
    },
    allowedHeaders: ["Content-Type", "X-Claipper-Agent-Token", "Range"],
    exposedHeaders: ["Accept-Ranges", "Content-Length", "Content-Range"]
  });
  await app.register(multipart, {
    limits: { files: 2, fileSize: maxUploadBytes, fields: 8, parts: 10 }
  });

  app.get("/health", async () => ({
    ok: true,
    mode: "local",
    tools: await toolChecks()
  }));

  app.post("/uploads", { preHandler: requireAgentToken(agentToken) }, async (request, reply) => {
    const videoId = randomUUID();
    let layout = null;
    let title = "Untitled video";
    let chatOffsetSeconds = 0;
    let sourceFilename = null;
    let sourceMimeType = null;
    let chatBytes = null;

    try {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          if (part.fieldname === "title") title = String(part.value ?? "").trim() || title;
          if (part.fieldname === "chat_offset_seconds") {
            chatOffsetSeconds = Number(part.value ?? 0);
            if (!Number.isFinite(chatOffsetSeconds)) throw new Error("Chat offset must be a number.");
          }
          continue;
        }

        if (part.fieldname === "video") {
          if (layout) throw new Error("Only one video file is allowed.");
          const extension = path.extname(part.filename ?? "").slice(1).toLowerCase();
          layout = await createLocalVideoLayout(storageRoot, videoId, extension);
          sourceFilename = path.basename(part.filename ?? `source.${extension}`);
          sourceMimeType = part.mimetype || CONTENT_TYPES[`.${extension}`] || "application/octet-stream";
          await pipeline(part.file, createWriteStream(resolveLocalMediaPath(storageRoot, layout.sourceRelativePath), { flags: "wx" }));
          if (part.file.truncated) throw new Error("Video exceeds the configured local upload limit.");
          continue;
        }

        if (part.fieldname === "chat") {
          if (part.mimetype !== "application/json" && path.extname(part.filename ?? "").toLowerCase() !== ".json") {
            throw new Error("Kick chat must be a JSON file.");
          }
          chatBytes = await part.toBuffer();
          if (chatBytes.byteLength > CHAT_MAX_BYTES) throw new Error("Kick chat JSON is too large.");
          continue;
        }

        part.file.resume();
      }

      if (!layout) throw new Error("A supported video file is required.");
      const sourcePath = resolveLocalMediaPath(storageRoot, layout.sourceRelativePath);
      const sourceStats = await stat(sourcePath);
      let normalizedChat = [];
      if (chatBytes) {
        const rawChat = JSON.parse(chatBytes.toString("utf8"));
        normalizedChat = normalizeKickChat(rawChat, { offsetSeconds: chatOffsetSeconds });
        await writeFile(resolveLocalMediaPath(storageRoot, layout.chatRelativePath), chatBytes);
        await writeFile(
          resolveLocalMediaPath(storageRoot, layout.normalizedChatRelativePath),
          JSON.stringify(normalizedChat),
          "utf8"
        );
      }

      const record = {
        videoId,
        title,
        originalFilename: sourceFilename,
        mimeType: sourceMimeType,
        sizeBytes: sourceStats.size,
        sourceStorageProvider: "local",
        sourceStoragePath: layout.sourceRelativePath,
        chatStoragePath: chatBytes ? layout.chatRelativePath : null,
        normalizedChatStoragePath: chatBytes ? layout.normalizedChatRelativePath : null,
        chatMessageCount: normalizedChat.length,
        chatOffsetSeconds
      };
      await createUploadRecords(record);
      await writeFile(
        resolveLocalMediaPath(storageRoot, layout.metadataRelativePath),
        JSON.stringify({ ...record, createdAt: new Date().toISOString() }, null, 2),
        "utf8"
      );

      return reply.code(201).send({ videoId, href: `/app/content-lab/${videoId}` });
    } catch (error) {
      await rm(path.join(storageRoot, videoId), { recursive: true, force: true });
      request.log.error(error);
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Local upload failed." });
    }
  });

  app.get("/media/*", async (request, reply) => {
    try {
      const wildcard = String(request.params["*"] ?? "");
      const relativePath = decodeURIComponent(wildcard);
      const filepath = resolveLocalMediaPath(storageRoot, relativePath);
      const fileStats = await stat(filepath);
      if (!fileStats.isFile()) return reply.code(404).send({ error: "Local media file not found." });

      const range = parseRange(request.headers.range, fileStats.size);
      reply.header("Accept-Ranges", "bytes");
      reply.type(CONTENT_TYPES[path.extname(filepath).toLowerCase()] ?? "application/octet-stream");
      if (!range) {
        reply.header("Content-Length", fileStats.size);
        return reply.send(createReadStream(filepath));
      }
      reply.code(206);
      reply.header("Content-Range", `bytes ${range.start}-${range.end}/${fileStats.size}`);
      reply.header("Content-Length", range.end - range.start + 1);
      return reply.send(createReadStream(filepath, range));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local media request failed.";
      const statusCode = /outside local storage root|must be relative|URI malformed/i.test(message) ? 400 : 404;
      return reply.code(statusCode).send({ error: message });
    }
  });

  return app;
}

function requireAgentToken(agentToken) {
  return async function localAgentAuth(request, reply) {
    if (request.headers["x-claipper-agent-token"] !== agentToken) {
      return reply.code(401).send({ error: "Local agent token is invalid." });
    }
  };
}

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}
