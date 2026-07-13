import { NextResponse, type NextRequest } from "next/server";
import { signPassword } from "@/lib/auth-token";

const cookieName = "claipper_auth";

export async function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");
  const isStreamScanApi = pathname === "/api/stream-scan" || pathname.startsWith("/api/stream-scan/");
  if (!isAppRoute && !isStreamScanApi) return NextResponse.next();

  const token = request.cookies.get(cookieName)?.value;
  if (token === await signPassword(password)) return NextResponse.next();

  if (isStreamScanApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/api/stream-scan/:path*"]
};
