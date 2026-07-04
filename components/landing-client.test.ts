import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MyLaura x Claipper landing cards", () => {
  const source = readFileSync("components/landing-client.tsx", "utf8");
  const heroSource = readFileSync("components/hero.tsx", "utf8");

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

  it("uses the requested public landing navigation and CTA copy", () => {
    expect(source).toContain('href="#how-it-works"');
    expect(source).toContain('href="#mylaura"');
    expect(source).toContain('href="/app"');
    expect(source).toContain("Open App");
    expect(source).not.toContain("Get Clips");

    expect(heroSource).toContain("Find Moments");
    expect(heroSource).toContain("See Workflow");
    expect(heroSource).toContain("from-cyan-300");
    expect(heroSource).toContain("to-emerald-400");
  });

  it("keeps the Claipper card benefit icons green", () => {
    expect(source).toContain("text-emerald-300");
    expect(source).not.toContain('Icon className="h-4 w-4 text-cyan-300"');
  });

  it("uses the cropped MyLaura logo asset so left alignment is real", () => {
    expect(source).toContain('src="/images/my-laura-logo-dark-bg.png"');
    expect(source).toContain("width={577}");
    expect(source).toContain("height={176}");
    expect(source).not.toContain("width={1304}");
  });

  it("renders the MyLaura logo at the same visual scale as the Claipper logo", () => {
    expect(source).toContain('sizes="260px"');
    expect(source).toContain("w-[min(260px,100%)]");
  });
});
