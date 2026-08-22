import type { CookieOptionsWithName } from "@supabase/ssr";

export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  maxAge: 400 * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
};
