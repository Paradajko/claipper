import { describe, expect, it } from "vitest";
import { isSupportedVideoFile, safeStorageExtension } from "./stream-scan-config";

describe("stream scan video formats", () => {
  it.each(["recording.mpg", "recording.mpeg"])("accepts MPEG upload %s", (filename) => {
    expect(isSupportedVideoFile(filename, "video/mpeg")).toBe(true);
    expect(safeStorageExtension(filename)).toBe(filename.split(".").pop());
  });
});
