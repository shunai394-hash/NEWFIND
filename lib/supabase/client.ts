import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

let nativeClient: SupabaseClient | null = null;

function isCapacitorNative() {
  if (typeof window === "undefined") return false;
  try {
    const cap = (
      window as Window & {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
  } catch {
    // ignore
  }
  // Android System WebView user-agent marker (Capacitor)
  return /;\s*wv\)/i.test(navigator.userAgent || "");
}

/**
 * Web: cookie-based SSR browser client (middleware session).
 * Capacitor WebView: localStorage client — cookie/SSR auth locks hang the WebView.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です",
    );
  }

  if (isCapacitorNative()) {
    if (!nativeClient) {
      nativeClient = createSupabaseJsClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storage: window.localStorage,
          flowType: "pkce",
        },
      });
      console.info("[supabase] using native localStorage client");
    }
    return nativeClient;
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
