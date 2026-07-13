import { describe, expect, it } from "vitest";

const modulePath = "./platform-import.mjs";

async function loadPlatformImport() {
  return import(modulePath).catch(() => ({}));
}

describe("platform import helpers", () => {
  it("adds Chrome impersonation only for Kick URLs", async () => {
    const helpers = await loadPlatformImport();
    const kickArgs = helpers.buildYtDlpDownloadArgs?.({
      sourceUrl: "https://kick.com/creator/videos/vod-id",
      outputTemplate: "/tmp/source.%(ext)s"
    });
    const youtubeArgs = helpers.buildYtDlpDownloadArgs?.({
      sourceUrl: "https://www.youtube.com/watch?v=video-id",
      outputTemplate: "/tmp/source.%(ext)s"
    });

    expect(kickArgs).toContain("--verbose");
    expect(kickArgs).toEqual(expect.arrayContaining(["--impersonate", "chrome"]));
    expect(youtubeArgs).toContain("--verbose");
    expect(youtubeArgs).not.toContain("--impersonate");
  });

  it("skips the disk-heavy MP4 fixup only for Kick downloads", async () => {
    const helpers = await loadPlatformImport();
    const kickArgs = helpers.buildYtDlpDownloadArgs?.({
      sourceUrl: "https://kick.com/creator/videos/vod-id",
      outputTemplate: "/tmp/source.%(ext)s"
    });
    const youtubeArgs = helpers.buildYtDlpDownloadArgs?.({
      sourceUrl: "https://www.youtube.com/watch?v=video-id",
      outputTemplate: "/tmp/source.%(ext)s"
    });

    expect(kickArgs).toEqual(expect.arrayContaining(["--fixup", "never"]));
    expect(youtubeArgs).not.toContain("--fixup");
  });

  it("accepts an available Chrome target and rejects unavailable rows", async () => {
    const helpers = await loadPlatformImport();
    const output = [
      "Client   OS          Source",
      "Chrome   -           curl_cffi (unavailable)",
      "Chrome-124 macOS-14  curl_cffi"
    ].join("\n");

    expect(helpers.findAvailableChromeImpersonationTarget?.(output)).toBe("Chrome-124 macOS-14  curl_cffi");
    expect(helpers.findAvailableChromeImpersonationTarget?.("Chrome - curl_cffi (unavailable)")).toBeNull();
  });

  it("separates a clean Kick user error from verbose technical diagnostics", async () => {
    const helpers = await loadPlatformImport();
    const cause = Object.assign(new Error("Command failed"), {
      code: 1,
      signal: null,
      stdout: "[debug] yt-dlp version stable@2026.06.30",
      stderr: "ERROR: [kick:vod] HTTP Error 403: Forbidden"
    });
    const failure = helpers.createPlatformImportError?.(cause, {
      sourceUrl: "https://kick.com/creator/videos/vod-id",
      args: ["--verbose", "--impersonate", "chrome"]
    });

    expect(failure?.userMessage).toBe("Kick VOD sa nepodarilo stiahnuť. Skúste to znova alebo nahrajte video priamo.");
    expect(failure?.message).toBe(failure?.userMessage);
    expect(failure?.technicalError).toContain("HTTP Error 403: Forbidden");
    expect(failure?.technicalError).toContain("exit_code=1");
    expect(failure?.technicalError).toContain('--impersonate","chrome');
    expect(failure?.userMessage).not.toContain("403");
  });
});
