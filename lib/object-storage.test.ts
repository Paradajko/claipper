import { afterEach, describe, expect, it } from "vitest";
import { getConfiguredObjectStorage } from "@/lib/object-storage";

const objectEnvKeys = [
  "OBJECT_STORAGE_PROVIDER",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_REGION",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL"
];

describe("object storage configuration", () => {
  afterEach(() => {
    for (const key of objectEnvKeys) {
      delete process.env[key];
    }
  });

  it("uses generic S3-compatible object storage env vars when configured", () => {
    process.env.OBJECT_STORAGE_PROVIDER = "s3";
    process.env.OBJECT_STORAGE_REGION = "us-east-1";
    process.env.OBJECT_STORAGE_BUCKET = "source-videos";
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID = "access";
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY = "secret";

    expect(getConfiguredObjectStorage()).toMatchObject({
      provider: "s3",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      region: "us-east-1",
      bucket: "source-videos"
    });
  });

  it("keeps existing R2 env vars as a backwards-compatible fallback", () => {
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_ACCESS_KEY_ID = "access";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET_NAME = "source-videos";

    expect(getConfiguredObjectStorage()).toMatchObject({
      provider: "r2",
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "source-videos"
    });
  });
});
