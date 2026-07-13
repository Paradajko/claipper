const defaultLocalAgentUrl = "http://127.0.0.1:43120";

export function createLocalMediaUrl(storagePath: string | null | undefined, agentUrl = defaultLocalAgentUrl) {
  const relativePath = String(storagePath ?? "").trim();
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\")) return null;
  const segments = relativePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;

  try {
    const base = new URL(agentUrl);
    if (base.protocol !== "http:" && base.protocol !== "https:") return null;
    const encodedPath = segments.map((segment) => encodeURIComponent(segment)).join("/");
    return new URL(`/media/${encodedPath}`, base).toString();
  } catch {
    return null;
  }
}
