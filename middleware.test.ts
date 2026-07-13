import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";
import { signPassword } from "@/lib/auth-token";
import { cookieName } from "@/lib/auth";

function request(pathname: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);

  return new NextRequest(`https://claipper.test${pathname}`, { headers });
}

describe("middleware app password guard", () => {
  it("matches app and Stream Scan file routes explicitly", () => {
    expect(config.matcher).toEqual(["/app/:path*", "/api/stream-scan/:path*"]);
  });

  it("leaves public landing routes unprotected when APP_PASSWORD is configured", async () => {
    process.env.APP_PASSWORD = "secret";

    const response = await middleware(request("/"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not password-protect non-/app routes", async () => {
    process.env.APP_PASSWORD = "secret";

    const response = await middleware(request("/reports"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated /app requests to the password page", async () => {
    process.env.APP_PASSWORD = "secret";

    const response = await middleware(request("/app"));

    expect(response.headers.get("location")).toBe("https://claipper.test/login?next=%2Fapp");
  });

  it("allows /app requests with the simple APP_PASSWORD cookie", async () => {
    process.env.APP_PASSWORD = "secret";
    const token = await signPassword("secret");

    const response = await middleware(request("/app/clips", `${cookieName}=${token}`));

    expect(response.headers.get("location")).toBeNull();
  });

  it("rejects unauthenticated Stream Scan API requests without redirecting", async () => {
    process.env.APP_PASSWORD = "secret";

    const response = await middleware(request("/api/stream-scan/videos"));

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("allows authenticated Stream Scan API requests", async () => {
    process.env.APP_PASSWORD = "secret";
    const token = await signPassword("secret");

    const response = await middleware(request("/api/stream-scan/videos", `${cookieName}=${token}`));

    expect(response.status).not.toBe(401);
  });
});
