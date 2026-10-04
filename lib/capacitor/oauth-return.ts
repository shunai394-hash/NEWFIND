import { Browser } from "@capacitor/browser";
import { createClient } from "@/lib/supabase/client";
import { isCapacitorNative } from "@/lib/capacitor/platform";
import {
  createAppUrlListener,
  createOAuthReturnHandler,
  rememberNativeOAuthNext,
} from "@/lib/capacitor/oauth-return-core";
import {
  needsSignupTermsConsent,
  signupConsentPath,
} from "@/lib/terms/consent";

function storage(kind: "sessionStorage" | "localStorage"): Storage | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null;
  }
}

async function destinationAfterNativeSession(next: string): Promise<string> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return next;
    const profile = await supabase
      .from("profiles")
      .select("terms_accepted_at, terms_version")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile.error || !profile.data) return next;
    if (needsSignupTermsConsent(profile.data)) {
      return signupConsentPath(next);
    }
  } catch {
    return next;
  }
  return next;
}

let handler: ReturnType<typeof createOAuthReturnHandler> | null = null;

function oauthReturnHandler() {
  if (!handler) {
    handler = createOAuthReturnHandler({
      appOrigin: window.location.origin,
      sessionStore: storage("sessionStorage"),
      persistentStore: storage("localStorage"),
      closeBrowser: () => Browser.close(),
      exchangeCodeForSession: (code) => createClient().auth.exchangeCodeForSession(code),
      verifyMagicLink: (tokenHash) =>
        createClient().auth.verifyOtp({ type: "magiclink", token_hash: tokenHash }),
      hasSession: async () => {
        const { data } = await createClient().auth.getSession();
        return Boolean(data.session);
      },
      destinationAfterSession: destinationAfterNativeSession,
      signupConsentPath,
      navigate: (path) => window.location.replace(path),
    });
  }
  return handler;
}

/**
 * Handle an OAuth return URL on Capacitor iOS / Android.
 * Uses the native localStorage PKCE client + exchangeCodeForSession.
 * Does not touch the Next.js /auth/callback route (web keeps that path).
 */
export function handleOAuthReturnUrl(rawUrl: string): Promise<boolean> {
  return oauthReturnHandler()(rawUrl);
}

/** Store the post-login destination before leaving the app for OAuth. */
export function rememberOAuthNext(next: string) {
  rememberNativeOAuthNext(storage("localStorage"), next);
}

let appUrlListener: ReturnType<typeof createAppUrlListener> | null = null;

/**
 * Register native deep-link listeners for OAuth return. The listener lives for
 * the whole app session: it is shared by <OAuthReturnListener> and by
 * signInOAuth, so one caller unmounting never removes it from the other.
 * No-op on web.
 */
export async function startNativeOAuthReturnListener(): Promise<() => void> {
  if (typeof window === "undefined" || !isCapacitorNative()) {
    return () => {};
  }
  if (!appUrlListener) {
    appUrlListener = createAppUrlListener(
      {
        addUrlListener: async (onUrl) => {
          const { App } = await import("@capacitor/app");
          return App.addListener("appUrlOpen", (event) => onUrl(event.url));
        },
        getLaunchUrl: async () => {
          const { App } = await import("@capacitor/app");
          return (await App.getLaunchUrl())?.url;
        },
      },
      (url) => {
        void handleOAuthReturnUrl(url ?? "").catch((err) => {
          console.error("[oauth-return] handle failed", err instanceof Error ? err.message : err);
        });
      },
    );
  }
  await appUrlListener.start();
  return () => {};
}
