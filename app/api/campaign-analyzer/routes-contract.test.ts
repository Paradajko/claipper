import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = [
  "app/api/campaign-analyzer/route.ts",
  "app/api/campaign-analyzer/[id]/route.ts",
  "app/api/campaign-analyzer/[id]/analyze/route.ts"
];

describe("campaign analyzer route contracts", () => {
  it("authenticates every handler before campaign access", () => {
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toContain("isAuthenticated");
      expect(source).toContain('status: 401');
    }
  });

  it("uses validation and reports invalid or unavailable services", () => {
    for (const route of [routes[0], routes[1], routes[2]]) {
      const source = readFileSync(route, "utf8");
      expect(source).toContain("status: 503");
    }
    for (const route of [routes[0], routes[1], routes[2]]) {
      const source = readFileSync(route, "utf8");
      expect(source).toMatch(/campaign(?:Input|Update)Schema/);
      expect(source).toContain("status: 400");
    }
  });

  it("queues analysis only through the campaign RPC service", () => {
    const source = readFileSync("app/api/campaign-analyzer/[id]/analyze/route.ts", "utf8");
    expect(source).toContain("queueCampaignAnalysis");
    expect(source).not.toContain('from("processing_jobs")');
  });
});
