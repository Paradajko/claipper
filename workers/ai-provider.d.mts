export const GEMINI_OPENAI_BASE_URL: string;

export function resolveMomentAiConfig(env?: Record<string, string | undefined>): {
  apiKey: string;
  baseURL: string;
  model: string;
};

