import { createHash, createHmac } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const MULTIPART_PART_SIZE = 64 * 1024 * 1024;

export async function uploadOriginalVideo({ provider, storagePath, inputPath, contentType = "video/mp4" }) {
  if (provider === "supabase") {
    throw new Error("Supabase original video uploads must use the Supabase Storage client.");
  }

  const config = requireObjectStorageConfigForProvider(provider);
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
  const upload = new Upload({
    client,
    params: {
      Bucket: config.bucket,
      Key: storagePath,
      Body: createReadStream(inputPath),
      ContentType: contentType
    },
    queueSize: 2,
    partSize: MULTIPART_PART_SIZE,
    leavePartsOnError: false
  });

  await upload.done();
}

export async function downloadOriginalVideo({ provider, storagePath, outputPath }) {
  if (provider === "supabase") {
    throw new Error("Supabase original video downloads must use the Supabase Storage client.");
  }

  const config = requireObjectStorageConfigForProvider(provider);
  const { signedUrl } = createPresignedUrl(config, { method: "GET", key: storagePath, expiresIn: 3600 });
  const response = await fetch(signedUrl);
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Object storage download failed (${response.status}): ${details.slice(0, 240) || response.statusText}`);
  }
  if (!response.body) throw new Error("Object storage download failed: empty response body.");
  await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
}

export function normalizeOriginalStorageProvider(value) {
  if (value === "r2" || value === "s3" || value === "supabase") return value;
  return "supabase";
}

function getConfiguredObjectStorage() {
  const genericProvider = normalizeObjectProvider(process.env.OBJECT_STORAGE_PROVIDER);
  if (genericProvider && hasGenericObjectStorageEnv(genericProvider)) {
    return {
      provider: genericProvider,
      endpoint: objectStorageEndpoint(genericProvider),
      region: process.env.OBJECT_STORAGE_REGION || defaultRegion(genericProvider),
      bucket: process.env.OBJECT_STORAGE_BUCKET ?? "",
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? ""
    };
  }

  if (hasLegacyR2Env()) {
    return {
      provider: "r2",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
      bucket: process.env.R2_BUCKET_NAME ?? "",
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL
    };
  }

  return null;
}

function hasGenericObjectStorageEnv(provider) {
  return Boolean(
    process.env.OBJECT_STORAGE_PROVIDER &&
    process.env.OBJECT_STORAGE_BUCKET &&
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID &&
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY &&
    (provider !== "r2" || process.env.OBJECT_STORAGE_ENDPOINT || process.env.R2_ACCOUNT_ID)
  );
}

function hasLegacyR2Env() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME);
}

function normalizeObjectProvider(value) {
  if (value === "r2" || value === "s3") return value;
  return null;
}

function objectStorageEndpoint(provider) {
  if (process.env.OBJECT_STORAGE_ENDPOINT) return process.env.OBJECT_STORAGE_ENDPOINT.replace(/\/$/, "");
  if (provider === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) throw new Error("R2_ACCOUNT_ID or OBJECT_STORAGE_ENDPOINT is required for R2 storage.");
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }
  const region = process.env.OBJECT_STORAGE_REGION || defaultRegion(provider);
  return `https://s3.${region}.amazonaws.com`;
}

function defaultRegion(provider) {
  return provider === "r2" ? "auto" : "us-east-1";
}

function requireObjectStorageConfigForProvider(provider) {
  const config = getConfiguredObjectStorage();
  if (!config) throw new Error("Object storage is not configured.");
  if (config.provider !== provider) {
    throw new Error(`Video source is stored in ${provider}, but object storage is configured for ${config.provider}.`);
  }
  return config;
}

function createPresignedUrl(config, { contentType, expiresIn = 3600, key, method }) {
  const endpoint = new URL(config.endpoint);
  const host = endpoint.host;
  const amzDate = toAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders = method === "PUT" && contentType ? "content-type;host" : "host";
  const basePath = endpoint.pathname.replace(/\/$/, "");
  const canonicalUri = `${basePath}/${uriEncode(config.bucket)}/${key.split("/").map(uriEncode).join("/")}`;
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(1, Math.min(604800, expiresIn))),
    "X-Amz-SignedHeaders": signedHeaders
  };
  const canonicalQuery = canonicalQueryString(query);
  const canonicalHeaders = method === "PUT" && contentType ? `content-type:${contentType}\nhost:${host}\n` : `host:${host}\n`;
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region, "s3");
  const signature = hmacHex(signingKey, stringToSign);

  return {
    signedUrl: `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    headers: method === "PUT" && contentType ? { "Content-Type": contentType } : {}
  };
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalQueryString(query) {
  return Object.entries(query)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${uriEncode(key)}=${uriEncode(value)}`)
    .join("&");
}

function uriEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSignatureKey(secretAccessKey, dateStamp, region, service) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}
