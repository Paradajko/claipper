import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MyLaura x Claipper landing cards", () => {
  const source = readFileSync("components/landing-client.tsx", "utf8");

  it("uses the simplified clip production structure for the Claipper card", () => {
    expect(source).toContain("Clip production workspace");
    expect(source).toContain("moment scanning");
    expect(source).toContain("clip ideas");
    expect(source).toContain("hooks & captions");
    expect(source).toContain("ready-to-edit outputs");
    expect(source).toContain("Long video becomes short clips");

    expect(source).not.toContain("Clips ready from Laura&apos;s brief");
    expect(source).not.toContain("Laura brief received");
    expect(source).not.toContain("clips ready</p>");
  });
});
