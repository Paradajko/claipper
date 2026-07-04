import { NextResponse, type NextRequest } from "next/server";
import { setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!process.env.APP_PASSWORD || password === process.env.APP_PASSWORD) {
    await setAuthCookie(password);
    return NextResponse.redirect(new URL(next, request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, request.url), {
    status: 303
  });
}
