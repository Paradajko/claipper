import { createHash, createHmac, randomUUID } from "node:crypto";

export type R2StorageProvider = "r2" | "supabase";

type PresignOptions = {
  method: "GET" | "PUT";
  key: string;
  contentType?: string;
  expiresIn?: number;
};

export function isR2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME);
}

export function r2BucketName() {
  return process.env.R2_BUCKET_NAME ?? "";
}

export function buildR2ObjectKey(videoId: string, extension: string) {
  return `originals/${videoId}/source.${extension}`;
}

export function createR2VideoId() {
  return randomUUID();
}

export function createR2PresignedUrl({ contentType, expiresIn = 3600, key, method }: PresignOptions) {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = method === "PUT" && contentType ? "content-type;host" : "host";
  const canonicalUri = `/${uriEncode(bucket)}/${key.split("/").map(uriEncode).join("/")}`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(1, Math.min(604800, expiresIn))),
    "X-Amz-SignedHeaders": signedHeaders
  };
  const canonicalQuery = canonicalQueryString(query);
  const canonicalHeaders = method === "PUT" && contentType ? `content-type:${contentType}\nhost:${host}\n` : `host:${host}\n`;
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, "auto", "s3");
  const signature = hmacHex(signingKey, stringToSign);
  const signedUrl = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  return {
    signedUrl,
    headers: method === "PUT" && contentType ? { "Content-Type": contentType } : {}
  };
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for R2 storage.`);
  return value;
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
