export function isKickUrl(sourceUrl) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    return hostname === "kick.com" || hostname.endsWith(".kick.com");
  } catch {
    return false;
  }
}

export function buildYtDlpDownloadArgs({ sourceUrl, outputTemplate }) {
  const kick = isKickUrl(sourceUrl);
  return [
    "--verbose",
    ...(kick ? ["--impersonate", "chrome", "--fixup", "never"] : []),
    sourceUrl,
    "--no-playlist",
    "--restrict-filenames",
    "--merge-output-format",
    "mp4",
    "--print",
    "after_move:filepath",
    "--format",
    "bv*+ba/b",
    "--output",
    outputTemplate
  ];
}

export function findAvailableChromeImpersonationTarget(output) {
  return String(output ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^chrome(?:-|\s)/i.test(line) && /curl_cffi/i.test(line) && !/unavailable/i.test(line)) ?? null;
}

export function createPlatformImportError(cause, { sourceUrl, args }) {
  const kick = isKickUrl(sourceUrl);
  const userMessage = kick
    ? "Kick VOD sa nepodarilo stiahnuť. Skúste to znova alebo nahrajte video priamo."
    : "Video z odkazu sa nepodarilo stiahnuť. Skúste to znova alebo nahrajte video priamo.";
  const failure = new Error(userMessage, { cause });
  failure.userMessage = userMessage;
  failure.technicalError = [
    `yt-dlp platform import failed (${kick ? "kick" : "other"})`,
    `source_url=${sourceUrl}`,
    `exit_code=${cause?.code ?? "unknown"}`,
    `signal=${cause?.signal ?? "none"}`,
    `args=${JSON.stringify(args)}`,
    `message=${cause instanceof Error ? cause.message : String(cause ?? "Unknown yt-dlp failure")}`,
    `stdout=${String(cause?.stdout ?? "").trim() || "<empty>"}`,
    `stderr=${String(cause?.stderr ?? "").trim() || "<empty>"}`
  ].join("\n");
  return failure;
}
