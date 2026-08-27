import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { isSupabaseConfigured } from "@/lib/config";

const AUTH_REFRESH_MS = 1500;

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name.toLowerCase();
    return name.includes("auth-token") || name.startsWith("sb-");
  });
}

function isPublicPath(pathname: string, method: string) {
  if (pathname === "/") return true;
  if (
    pathname.startsWith("/products") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/discover") ||
    pathname.startsWith("/u/")
  ) {
    return true;
  }
  if (method === "GET" && pathname === "/api/discovery") return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const passThrough = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    });

  if (
    isPublicPath(request.nextUrl.pathname, request.method) ||
    !isSupabaseConfigured() ||
    !hasSupabaseAuthCookie(request)
  ) {
    return passThrough();
  }

  let supabaseResponse = passThrough();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = passThrough();

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("auth-refresh-timeout")), AUTH_REFRESH_MS);
      }),
    ]);
  } catch {
    return supabaseResponse;
  }

  return supabaseResponse;
}
