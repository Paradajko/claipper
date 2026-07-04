import { cookies } from "next/headers";
import { signPassword } from "@/lib/auth-token";

const cookieName = "claipper_auth";

export function appPasswordConfigured() {
  return Boolean(process.env.APP_PASSWORD);
}

export async function isAuthenticated() {
  if (!appPasswordConfigured()) return true;

  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return false;

  const expected = await signPassword(process.env.APP_PASSWORD ?? "");
  return token === expected;
}

export async function setAuthCookie(password: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, await signPassword(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export { cookieName };
