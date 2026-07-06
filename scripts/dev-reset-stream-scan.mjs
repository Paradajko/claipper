#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CONFIRM_FLAG = "--confirm";
const TABLES = ["clips", "clip_ideas", "transcript_segments", "transcripts", "processing_jobs", "video_imports", "videos", "scheduled_posts", "source_videos"];
const OPTIONAL_TABLES = new Set(["video_imports"]);
const BUCKETS = ["original-videos", "extracted-audio", "rendered-clips", "subtitles"];
const OPTIONAL_BUCKETS = new Set(["subtitles"]);

loadDotEnv();

if (!process.argv.includes(CONFIRM_FLAG)) {
  console.error("Claipper Stream Scan reset is DEVELOPMENT/TESTING ONLY.");
  console.error(`This deletes Content Lab videos, source videos, scheduled posts, clip ideas, jobs, transcripts, rendered clips, and related storage files.`);
  console.error(`Run explicitly with: npm run dev:reset-stream-scan -- ${CONFIRM_FLAG}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

console.log("Claipper Stream Scan reset - DEVELOPMENT/TESTING ONLY");
console.log("Deleting stream scan and test content storage files and database rows. Users/auth/settings are not touched.");

const deleted = {
  storage: {},
  tables: {}
};

for (const bucket of BUCKETS) {
  deleted.storage[bucket] = await deleteStorageBucketContents(bucket, OPTIONAL_BUCKETS.has(bucket));
}

for (const table of TABLES) {
  deleted.tables[table] = await deleteTableRows(table, OPTIONAL_TABLES.has(table));
}

console.log("\nDeleted storage files:");
for (const [bucket, result] of Object.entries(deleted.storage)) {
  console.log(`- ${bucket}: ${formatResult(result, "files")}`);
}

console.log("\nDeleted database rows:");
for (const [table, result] of Object.entries(deleted.tables)) {
  console.log(`- ${table}: ${formatResult(result, "rows")}`);
}

async function deleteTableRows(table, optional = false) {
  const { count, error } = await supabase.from(table).delete({ count: "exact" }).not("id", "is", null);
  if (error) {
    if (optional && isMissingRelationError(error)) {
      return { skipped: true, reason: "table does not exist" };
    }
    throw new Error(`Failed to delete ${table}: ${error.message}`);
  }
  return { count: count ?? 0 };
}

async function deleteStorageBucketContents(bucket, optional = false) {
  const paths = [];
  const collectResult = await collectStoragePaths(bucket, "", paths, optional);
  if (collectResult?.skipped) return collectResult;
  if (paths.length === 0) return { count: 0 };

  let removed = 0;
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`Failed to delete files from ${bucket}: ${error.message}`);
    removed += batch.length;
  }
  return { count: removed };
}

async function collectStoragePaths(bucket, prefix, paths, optional) {
  const limit = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" }
    });

    if (error) {
      if (optional && isMissingBucketError(error)) {
        return { skipped: true, reason: "bucket does not exist" };
      }
      throw new Error(`Failed to list ${bucket}${prefix ? `/${prefix}` : ""}: ${error.message}`);
    }

    for (const item of data ?? []) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (isStorageFolder(item)) {
        await collectStoragePaths(bucket, itemPath, paths, optional);
      } else {
        paths.push(itemPath);
      }
    }

    if (!data || data.length < limit) break;
    offset += limit;
  }

  return null;
}

function isStorageFolder(item) {
  return !item.id && !item.metadata;
}

function isMissingRelationError(error) {
  return /does not exist|could not find|schema cache|relation/i.test(error.message ?? "");
}

function isMissingBucketError(error) {
  return /bucket.*not.*found|not found|does not exist/i.test(error.message ?? "");
}

function formatResult(result, label) {
  if (result.skipped) return `skipped (${result.reason})`;
  return `${result.count} ${label}`;
}

function loadDotEnv(cwd = process.cwd()) {
  for (const filename of [".env.local", ".env"]) {
    const filepath = `${cwd}/${filename}`;
    if (!existsSync(filepath)) continue;
    const content = readFileSync(filepath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [rawKey, ...rawValue] = trimmed.split("=");
      const key = rawKey.trim();
      if (process.env[key]) continue;
      process.env[key] = rawValue.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}
