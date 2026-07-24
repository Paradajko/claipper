export const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export function resolveMomentAiConfig(env = process.env) {
  const apiKey = String(env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for Moment Finder text analysis.");
  }

  return {
    apiKey,
    baseURL: GEMINI_OPENAI_BASE_URL,
    model: String(env.GEMINI_MODEL ?? "").trim() || "gemini-3.6-flash"
  };
}

