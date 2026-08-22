import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です",
    );
  }

  return createBrowserClient(url, key, {
    isSingleton: true,
    cookieOptions: AUTH_COOKIE_OPTIONS,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}
