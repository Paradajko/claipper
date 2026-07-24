import { describe, expect, it } from "vitest";
import { GEMINI_OPENAI_BASE_URL, resolveMomentAiConfig } from "./ai-provider.mjs";

describe("Moment Finder AI provider", () => {
  it("uses the official Gemini OpenAI-compatible endpoint", () => {
    expect(GEMINI_OPENAI_BASE_URL).toBe("https://generativelanguage.googleapis.com/v1beta/openai/");
  });

  it("requires a Gemini API key", () => {
    expect(() => resolveMomentAiConfig({ GEMINI_MODEL: "gemini-3.6-flash" })).toThrow("GEMINI_API_KEY");
  });

  it("uses the configured Gemini model", () => {
    expect(
      resolveMomentAiConfig({
        GEMINI_API_KEY: "gemini-key",
        GEMINI_MODEL: "gemini-3.6-flash"
      })
    ).toEqual({
      apiKey: "gemini-key",
      baseURL: GEMINI_OPENAI_BASE_URL,
      model: "gemini-3.6-flash"
    });
  });
});

