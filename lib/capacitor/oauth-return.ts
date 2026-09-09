import { safeNextPath } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { isCapacitorNative } from "@/lib/capacitor/platform";
import {
  needsSignupTermsConsent,
  signupConsentPath,
} from "@/lib/terms/consent";

const processedCodes = new Set<string>();
let inFlightCode: string | null = null;
let started = false;

function isOAuthCallbackUrl(url: URL): boolean {
  const combined = `${url.hostname}${url.pathname}`.replace(/\/+/g, "/");
  return (
    combined.includes("auth/callback") ||
    url.pathname === "/auth/callback" ||
    url.pathname.endsWith("/auth/callback")
  );
}

function oauthErrorMessage(url: URL): string | null {
  const error = url.searchParams.get("error");
  if (!error) return null;
  return url.searchParams.get("error_description") || error;
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

/**
 * Handle an OAuth return URL on Capacitor iOS / Android.
 * Uses the native localStorage PKCE client + exchangeCodeForSession.
 * Does not touch the Next.js /auth/callback route (web keeps that path).
 */
export async function handleOAuthReturnUrl(rawUrl: string): Promise<boolean> {
  if (!rawUrl) return false;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!isOAuthCallbackUrl(url)) return false;

  const oauthError = oauthErrorMessage(url);
  if (oauthError) {
    const detail = encodeURIComponent(oauthError);
    window.location.replace(`/login?error=oauth&detail=${detail}`);
    return true;
  }

  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash) {
    if (processedCodes.has(tokenHash) || inFlightCode === tokenHash) {
      return true;
    }
    inFlightCode = tokenHash;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: tokenHash,
      });
      if (error) {
        const detail = encodeURIComponent(error.message);
        window.location.replace(`/login?error=apple&detail=${detail}`);
        return true;
      }
      processedCodes.add(tokenHash);
      const next = safeNextPath(url.searchParams.get("next"));
      if (url.searchParams.get("created") === "1") {
        window.location.replace(signupConsentPath(next));
        return true;
      }
      window.location.replace(next);
      return true;
    } finally {
      if (inFlightCode === tokenHash) inFlightCode = null;
    }
  }

  const code = url.searchParams.get("code");
  if (!code) return false;

  if (processedCodes.has(code) || inFlightCode === code) {
    return true;
  }

  inFlightCode = code;
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const detail = encodeURIComponent(error.message);
      window.location.replace(`/login?error=oauth&detail=${detail}`);
      return true;
    }

    processedCodes.add(code);
    const next = safeNextPath(url.searchParams.get("next"));
    window.location.replace(await destinationAfterNativeSession(next));
    return true;
  } finally {
    if (inFlightCode === code) inFlightCode = null;
  }
}

/**
 * Register native deep-link listeners for OAuth return.
 * Safe to call once from a client component; no-ops on web.
 */
export async function startNativeOAuthReturnListener(): Promise<() => void> {
  if (typeof window === "undefined" || started || !isCapacitorNative()) {
    return () => {};
  }

  started = true;
  const { App } = await import("@capacitor/app");

  const onUrl = (raw: string | undefined) => {
    if (!raw) return;
    void handleOAuthReturnUrl(raw).catch((err) => {
      console.error("[oauth-return] handle failed", err);
    });
  };

  const launch = await App.getLaunchUrl().catch(() => undefined);
  onUrl(launch?.url);

  const handle = await App.addListener("appUrlOpen", (event) => {
    onUrl(event.url);
  });

  return () => {
    started = false;
    void handle.remove();
  };
}
