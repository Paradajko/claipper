export function buildCampaignMetadataArgs(url) {
  return [
    "--skip-download",
    "--dump-single-json",
    "--ignore-errors",
    "--no-warnings",
    "--playlist-end", "200",
    "--", url
  ];
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

function uploadDateMs(value) {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const result = Date.UTC(year, month - 1, day);
  const date = new Date(result);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? result : null;
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
