import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampaignAnalyzerWorkspace } from "./campaign-analyzer-workspace";

describe("Campaign Analyzer workspace", () => {
  it("renders the compact Slovak editing and result workspace", () => {
    const initialAnalysis = {
      id: "analysis-1", creator_name: "Creator", status: "completed",
      automatic_metadata: { youtube: { item_count: 3 } }, manual_overrides: {},
      source_statuses: { youtube: { status: "completed", stale: false } }
    } as never;
    const markup = renderToStaticMarkup(createElement(CampaignAnalyzerWorkspace, { analyses: [], initialAnalysis }));
    for (const copy of ["Campaign Analyzer", "Analyzovať", "Uložiť zmeny", "Nová analýza", "Automaticky", "Nezistené"]) {
      expect(markup).toContain(copy);
    }
  });

  it("wires immediate calculations, polling and origin states", () => {
    const source = readFileSync("components/campaign-analyzer-workspace.tsx", "utf8") + readFileSync("components/campaign-analyzer-fields.tsx", "utf8");
    expect(source).toContain("calculateCampaign(");
    expect(source).toContain("setInterval");
    expect(source).toContain("2500");
    expect(source).toContain("Ručne upravené");
    expect(source).toContain("Staršie dáta");
    expect(source).toContain("Hotovo s upozornením");
  });
});
