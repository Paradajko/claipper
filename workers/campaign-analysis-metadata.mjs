export function buildCampaignMetadataArgs(url) {
  return [
    "--skip-download",
    "--ignore-errors",
    "--no-warnings",
    "--playlist-end", "100",
    "--print", "%(.{id,timestamp,release_timestamp,upload_date,duration,view_count,webpage_url,is_short,is_shorts,short,extractor_key,extractor})j",
    "--", url
  ];
}

export function parseKickChannelSlug(value) {
  const url = new URL(value);
  const parts = url.pathname.split("/").filter(Boolean);
  const reserved = new Set(["categories", "dashboard", "following", "search"]);
  const slug = parts[0];
  if (
    url.protocol !== "https:" ||
    !["kick.com", "www.kick.com"].includes(url.hostname.toLowerCase()) ||
    !slug ||
    reserved.has(slug.toLowerCase()) ||
    !/^[a-zA-Z0-9_-]+$/.test(slug) ||
    (parts.length > 1 && (parts.length !== 2 || parts[1] !== "videos"))
  ) {
    throw new Error("Kick URL must identify a public channel.");
  }
  return slug;
}

export function buildKickMetadataArgs(url) {
  return ["workers/kick-vod-metadata.py", parseKickChannelSlug(url)];
}

export function parseKickMetadata(value, { now = new Date() } = {}) {
  if (!Array.isArray(value)) throw new Error("Kick returned invalid VOD metadata.");
  const entries = value
    .filter((entry) => entry && typeof entry === "object" && entry.is_live !== true)
    .map((entry) => ({
      timestamp: isoTimestamp(entry.created_at ?? entry.start_time),
      duration: kickDurationSeconds(entry.duration),
      view_count: entry.video?.views ?? entry.views
    }));
  return parseCampaignMetadata({ entries }, { source: "kick", now });
}

export function parseCampaignMetadata(value, { source, now = new Date() }) {
  const cutoffMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const entries = flattenEntries(value)
    .map(normalizeEntry)
    .filter((entry) => entry.publishedAt !== null && entry.publishedAt >= cutoffMs && entry.publishedAt <= now.getTime());
  const views = entries.map((entry) => entry.views).filter(Number.isFinite);
  const durations = entries.map((entry) => entry.duration).filter(Number.isFinite);
  const shortsViews = source === "youtube" || source === "clipper"
    ? entries.filter(isShort).map((entry) => entry.views).filter(Number.isFinite)
    : [];

  return {
    item_count: entries.length,
    total_duration_seconds: durations.length ? durations.reduce((sum, duration) => sum + duration, 0) : null,
    average_views: views.length ? views.reduce((sum, views) => sum + views, 0) / views.length : null,
    median_views: median(views),
    top_views: views.length ? Math.max(...views) : null,
    sample_size: views.length,
    shorts_median_views: median(shortsViews),
    shorts_sample_size: shortsViews.length
  };
}

export function parseCampaignMetadataCommandResult({ stdout, error }) {
  const candidate = typeof stdout === "string" && stdout.trim()
    ? stdout
    : typeof error?.stdout === "string"
      ? error.stdout
      : "";
  if (candidate.trim()) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      const entries = candidate
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .flatMap((line) => {
          try {
            const parsed = JSON.parse(line);
            return parsed && typeof parsed === "object" ? [parsed] : [];
          } catch {
            return [];
          }
        });
      if (entries.length) return { entries };
    }
  }
  if (error) throw error;
  if (typeof stdout === "string") return { entries: [] };
  throw new Error("yt-dlp returned no metadata.");
}

export function safeCampaignSourceError() {
  return "Zdrojové metadáta sa nepodarilo načítať.";
}

export function mergeCampaignSourceResult({ automaticMetadata, sourceStatuses, result, collectedAt }) {
  const nextAutomaticMetadata = { ...automaticMetadata };
  if (result.status === "completed" && result.metrics) {
    nextAutomaticMetadata[result.source] = result.metrics;
  } else if (result.status === "not_provided") {
    delete nextAutomaticMetadata[result.source];
  }

  const hasPreviousMetrics = automaticMetadata[result.source] !== undefined;
  const nextStatus = result.status === "not_provided"
    ? { status: "not_provided", error: null, collected_at: null, stale: false }
    : {
        status: result.status,
        error: result.error,
        collected_at: collectedAt,
        stale: result.status === "failed" && hasPreviousMetrics
      };

  return {
    automaticMetadata: nextAutomaticMetadata,
    sourceStatuses: { ...sourceStatuses, [result.source]: nextStatus }
  };
}

function flattenEntries(value) {
  if (Array.isArray(value)) return value.flatMap(flattenEntries);
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.entries)) return value.entries.flatMap(flattenEntries);
  return [value];
}

function normalizeEntry(entry) {
  const timestamp = finiteNumber(entry.timestamp) ?? finiteNumber(entry.release_timestamp);
  const publishedAt = timestamp === null ? uploadDateMs(entry.upload_date) : timestamp * 1000;

  return {
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : null,
    duration: finiteNumber(entry.duration),
    views: finiteNumber(entry.view_count),
    webpageUrl: typeof entry.webpage_url === "string" ? entry.webpage_url : "",
    shortMarker: entry.is_short === true || entry.is_shorts === true || entry.short === true || entry._type === "short" || /shorts/i.test(String(entry.extractor_key ?? entry.extractor ?? ""))
  };
}

function finiteNumber(value) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function kickDurationSeconds(value) {
  const durationMs = finiteNumber(value);
  return durationMs === null ? null : durationMs / 1000;
}

function uploadDateMs(value) {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const result = Date.UTC(year, month - 1, day);
  const date = new Date(result);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? result : null;
}

function isoTimestamp(value) {
  if (typeof value !== "string") return null;
  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs) ? timestampMs / 1000 : null;
}

function isShort(entry) {
  return entry.shortMarker || entry.webpageUrl.includes("/shorts/") || (Number.isFinite(entry.duration) && entry.duration <= 180);
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
