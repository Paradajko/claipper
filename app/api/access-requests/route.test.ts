import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createClientMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

function jsonRequest(body: unknown) {
  return new Request("https://claipper.test/api/access-requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

describe("access request API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    insertMock.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "request-1" }, error: null })
      })
    });
  });

  it("validates and stores access requests with the service role client", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({
        email: "clipper@example.com",
        name: "Fabian",
        use_case: "youtube-shorts",
        videos_per_week: "10+",
        how_did_you_hear: "Twitter",
        honeypot: ""
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: true, id: "request-1" });
    expect(response.status).toBe(200);
    expect(createClientMock).toHaveBeenCalledWith("https://project.supabase.co", "service-role-key", {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    expect(fromMock).toHaveBeenCalledWith("access_requests");
    expect(insertMock).toHaveBeenCalledWith({
      email: "clipper@example.com",
      name: "Fabian",
      use_case: "youtube-shorts",
      videos_per_week: "10+",
      how_did_you_hear: "Twitter"
    });
  });

  it("rejects invalid payloads before inserting", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({
        email: "not-email",
        use_case: "unknown",
        videos_per_week: "10+",
        honeypot: ""
      })
    );

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns silent success for honeypot submissions", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({
        email: "bot@example.com",
        use_case: "tiktok",
        videos_per_week: "1-5",
        honeypot: "filled-by-bot"
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
