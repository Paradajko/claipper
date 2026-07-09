import { createHash, createHmac } from "node:crypto";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type OriginalStorageProvider = "r2" | "s3" | "supabase";

type ObjectStorageProvider = Exclude<OriginalStorageProvider, "supabase">;

type ObjectStorageConfig = {
  provider: ObjectStorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
};

type PresignOptions = {
  method: "GET" | "PUT";
  key: string;
  contentType?: string;
  expiresIn?: number;
};

type CreateUploadUrlOptions = {
  key: string;
  contentType: string;
  expiresIn?: number;
};

type DownloadOriginalVideoOptions = {
  provider: OriginalStorageProvider;
  storagePath: string;
  outputPath: string;
};

export function isObjectStorageConfigured() {
  return Boolean(getConfiguredObjectStorage());
}

export function getConfiguredObjectStorage(): ObjectStorageConfig | null {
  const genericProvider = normalizeProvider(process.env.OBJECT_STORAGE_PROVIDER);
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

export function configuredObjectStorageProvider(): OriginalStorageProvider {
  return getConfiguredObjectStorage()?.provider ?? "supabase";
}

export function configuredObjectStorageBucket() {
  return getConfiguredObjectStorage()?.bucket ?? "";
}

export function buildOriginalVideoObjectKey(videoId: string, extension: string) {
  return `originals/${videoId}/source.${extension}`;
}

export function createUploadUrl({ contentType, expiresIn = 3600, key }: CreateUploadUrlOptions) {
  const config = requireObjectStorageConfig();
  const { signedUrl, headers } = createPresignedUrl(config, { method: "PUT", key, contentType, expiresIn });
  return {
    provider: config.provider,
    bucket: config.bucket,
    storagePath: key,
    token: null,
    signedUrl,
    headers,
    uploadMethod: "object_storage_put" as const
  };
}

export async function downloadOriginalVideo({ provider, storagePath, outputPath }: DownloadOriginalVideoOptions) {
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
  await pipeline(Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(outputPath));
}

function hasGenericObjectStorageEnv(provider: ObjectStorageProvider) {
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

function normalizeProvider(value: string | undefined): ObjectStorageProvider | null {
  if (value === "r2" || value === "s3") return value;
  return null;
}

function objectStorageEndpoint(provider: ObjectStorageProvider) {
  if (process.env.OBJECT_STORAGE_ENDPOINT) return process.env.OBJECT_STORAGE_ENDPOINT.replace(/\/$/, "");
  if (provider === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) throw new Error("R2_ACCOUNT_ID or OBJECT_STORAGE_ENDPOINT is required for R2 storage.");
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }
  const region = process.env.OBJECT_STORAGE_REGION || defaultRegion(provider);
  return `https://s3.${region}.amazonaws.com`;
}

function defaultRegion(provider: ObjectStorageProvider) {
  return provider === "r2" ? "auto" : "us-east-1";
}

function requireObjectStorageConfig() {
  const config = getConfiguredObjectStorage();
  if (!config) throw new Error("Object storage is not configured.");
  return config;
}

function requireObjectStorageConfigForProvider(provider: ObjectStorageProvider) {
  const config = requireObjectStorageConfig();
  if (config.provider !== provider) {
    throw new Error(`Video source is stored in ${provider}, but object storage is configured for ${config.provider}.`);
  }
  return config;
}

function createPresignedUrl(config: ObjectStorageConfig, { contentType, expiresIn = 3600, key, method }: PresignOptions) {
  const endpoint = new URL(config.endpoint);
  const host = endpoint.host;
  const amzDate = toAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders = method === "PUT" && contentType ? "content-type;host" : "host";
  const basePath = endpoint.pathname.replace(/\/$/, "");
  const canonicalUri = `${basePath}/${uriEncode(config.bucket)}/${key.split("/").map(uriEncode).join("/")}`;
  const query: Record<string, string> = {
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

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalQueryString(query: Record<string, string>) {
  return Object.entries(query)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${uriEncode(key)}=${uriEncode(value)}`)
    .join("&");
}

function uriEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSignatureKey(secretAccessKey: string, dateStamp: string, region: string, service: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}
