"use client";

import { NativeAppleSignIn } from "@/lib/capacitor/sign-in-with-apple";
import { openNativeOAuthUrl } from "@/lib/capacitor/oauth-browser";
import { startNativeOAuthReturnListener } from "@/lib/capacitor/oauth-return";
import { safeNextPath } from "@/lib/config";
import {
  isAndroidCapacitor,
  isCapacitorNative,
  isIosCapacitor,
} from "@/lib/capacitor/platform";
import { createClient } from "@/lib/supabase/client";
import { signupConsentPath } from "@/lib/terms/consent";

function randomNonce() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function completeWithTicket(tokenHash: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (error) throw new Error(error.message);
}

/** Carries the Capacitor plugin error code (e.g. "CANCELED") to the UI. */
export class AppleSignInError extends Error {
  code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "AppleSignInError";
    this.code = code;
  }
}

async function nativeIosAppleSignIn(next: string) {
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);
  let result: Awaited<ReturnType<typeof NativeAppleSignIn.authorize>>;
  try {
    result = await NativeAppleSignIn.authorize({
      nonce: hashedNonce,
      state: randomNonce(),
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : null;
    throw new AppleSignInError(err instanceof Error ? err.message : String(err), code);
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch("/api/auth/apple/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        identityToken: result.identityToken,
        authorizationCode: result.authorizationCode,
        rawNonce,
        email: result.email,
        givenName: result.givenName,
        familyName: result.familyName,
      }),
    });
  } catch {
    throw new AppleSignInError("network: Apple sign-in request failed");
  } finally {
    window.clearTimeout(timer);
  }
  const json = (await res.json().catch(() => ({}))) as {
    tokenHash?: string;
    created?: boolean;
    error?: string;
  };
  if (!res.ok || !json.tokenHash) {
    throw new AppleSignInError(json.error || `Apple sign-in failed (HTTP ${res.status})`);
  }
  await completeWithTicket(json.tokenHash);
  if (json.created) {
    window.location.replace(signupConsentPath(next));
    return;
  }
  window.location.replace(safeNextPath(next));
}

export async function startAppleSignIn(next = "/") {
  if (isIosCapacitor()) {
    try {
      await nativeIosAppleSignIn(next);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const code = err instanceof AppleSignInError ? err.code : null;
      const pluginMissing =
        code === "UNIMPLEMENTED" ||
        code === "UNAVAILABLE" ||
        /not implemented|unimplemented|plugin is not available/i.test(message);
      if (!pluginMissing) throw err;
    }
  }

  const start = new URL("/api/auth/apple/start", window.location.origin);
  start.searchParams.set("next", next);
  if (isIosCapacitor()) start.searchParams.set("platform", "ios");
  if (isAndroidCapacitor()) start.searchParams.set("platform", "android");

  if (isCapacitorNative()) {
    // The web flow returns through app.newfind.social://auth/callback?token_hash=…
    await startNativeOAuthReturnListener();
    await openNativeOAuthUrl(start.toString());
    return;
  }

  window.location.assign(start.toString());
}
