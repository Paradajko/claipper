import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("AI-first app workflow naming", () => {
  it("uses the requested English sidebar items", () => {
    const shell = read("components/ui.tsx");

    for (const label of ["Dashboard", "MyLaura Brief", "Content Lab", "Clips", "Schedule", "Reports", "Settings"]) {
      expect(shell).toContain(`label: "${label}"`);
    }

    expect(shell).not.toContain("Zdroje");
    expect(shell).not.toContain("Reporty");
    expect(shell).not.toContain("Sources");
  });

  it("frames the dashboard around the AI clipping workflow", () => {
    const dashboard = read("app/app/page.tsx");

    expect(dashboard).toContain("Start with context. Finish with clips.");
    expect(dashboard).toContain("Brief / Content");
    expect(dashboard).toContain("AI Analysis");
    expect(dashboard).toContain("Clip Ideas");
    expect(dashboard).toContain("Production");
    expect(dashboard).toContain("Reports");
    expect(dashboard).toContain("Start with MyLaura Brief");
    expect(dashboard).toContain("Start with Content");
    expect(dashboard).toContain("Goal found");
    expect(dashboard).toContain("Tone found");
    expect(dashboard).toContain("CTA found");
    expect(dashboard).toContain("Angles ready");
    expect(dashboard).toContain("Video source");
    expect(dashboard).toContain("Transcript");
    expect(dashboard).toContain("Moments found");
    expect(dashboard).toContain("Content Runs");
    expect(dashboard).toContain("Ready Clips");
    expect(dashboard).toContain("Recent analyses");
    expect(dashboard).toContain("No analyses yet.");
    expect(dashboard).not.toContain("Operator dashboard");
    expect(dashboard).not.toContain("MyLaura Brief → Content Lab → Clips → Schedule → Reports");
  });

  it("keeps Content Lab simple and AI-first", () => {
    const contentLab = read("app/app/content-lab/page.tsx");

    expect(contentLab).toContain("Content Lab");
    expect(contentLab).toContain("Add a video link or upload long-form content. Claipper will analyze it and turn it into clip ideas.");
    expect(contentLab).toContain("Paste content/video URL");
    expect(contentLab).toContain("Upload video");
    expect(contentLab).toContain("Attach to MyLaura Brief");
    expect(contentLab).toContain("Analyze Content");

    for (const manualField of ["Platform", "Duration seconds", "Status", "Transcript"]) {
      expect(contentLab).not.toContain(manualField);
    }
  });

  it("defines MyLaura Brief as a simple campaign-context analyzer", () => {
    const brief = read("app/app/mylaura-brief/page.tsx");

    expect(brief).toContain("MyLaura Brief");
    expect(brief).toContain("MyLaura campaign URL");
    expect(brief).toContain("Analyze Brief");
    for (const output of ["Goal", "Audience", "Tone", "CTA", "Content rules", "Recommended clip angles"]) {
      expect(brief).toContain(output);
    }
  });

  it("keeps clip ideas inside the Clips page tabs", () => {
    const clips = read("app/app/clips/page.tsx");
    const shell = read("components/ui.tsx");

    expect(clips).toContain("Ideas");
    expect(clips).toContain("Production");
    expect(clips).toContain("timestamp range");
    expect(clips).toContain("campaign relevance");
    expect(clips).toContain("Create Clip");
    expect(clips).not.toContain("Kanban production board");
    expect(shell).not.toContain("Clip Ideas");
  });
});
