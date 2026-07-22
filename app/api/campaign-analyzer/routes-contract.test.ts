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
    const itemRoute = readFileSync(routes[1], "utf8");
    for (const handler of ["GET", "PATCH"]) {
      const body = itemRoute.slice(itemRoute.indexOf(`export async function ${handler}`), itemRoute.indexOf("\n}", itemRoute.indexOf(`export async function ${handler}`)) + 2);
      expect(body.indexOf("isAuthenticated")).toBeGreaterThan(-1);
      expect(body.indexOf("isAuthenticated")).toBeLessThan(body.indexOf(handler === "GET" ? "getCampaignAnalysis" : "campaignUpdateSchema.safeParse"));
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

  it("preserves success and not-found response contracts", () => {
    expect(readFileSync(routes[0], "utf8")).toContain("status: 201");
    const itemRoute = readFileSync(routes[1], "utf8");
    expect(itemRoute).toContain("activeJob");
    expect(itemRoute).toContain("status: 404");
    expect(readFileSync(routes[2], "utf8")).toContain("status: 202");
  });
});
