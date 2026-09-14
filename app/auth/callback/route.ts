import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured, safeNextPath } from "@/lib/config";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { postAuthRedirectPath } from "@/lib/terms/post-auth";

export const dynamic = "force-dynamic";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function redirectOrigin(request: Request, origin: string) {
  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto");
  if (host && proto) return `${proto}://${host}`;
  return origin;
}

function applyCookies(response: NextResponse, pending: CookieToSet[]) {
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const destinationBase = redirectOrigin(request, origin);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${destinationBase}/login?error=oauth`);
  }

  if (!code) {
    return NextResponse.redirect(`${destinationBase}/login?error=oauth`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Route Handler can still attach cookies to NextResponse below.
          }
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return applyCookies(
      NextResponse.redirect(
        `${destinationBase}/login?error=oauth&detail=${encodeURIComponent(error.message)}`,
      ),
      pendingCookies,
    );
  }

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  const destination = userId
    ? await postAuthRedirectPath(userId, next)
    : next;

  return applyCookies(
    NextResponse.redirect(`${destinationBase}${destination}`),
    pendingCookies,
  );
}
