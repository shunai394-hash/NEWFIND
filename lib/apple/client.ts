"use client";

import { NativeAppleSignIn } from "@/lib/capacitor/sign-in-with-apple";
import {
  isAndroidCapacitor,
  isIosCapacitor,
} from "@/lib/capacitor/platform";
import { createClient } from "@/lib/supabase/client";

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

async function nativeIosAppleSignIn() {
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);
  const result = await NativeAppleSignIn.authorize({
    nonce: hashedNonce,
    state: randomNonce(),
  });

  const res = await fetch("/api/auth/apple/native", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identityToken: result.identityToken,
      authorizationCode: result.authorizationCode,
      rawNonce,
      email: result.email,
      givenName: result.givenName,
      familyName: result.familyName,
    }),
  });
  const json = (await res.json()) as { tokenHash?: string; error?: string };
  if (!res.ok || !json.tokenHash) {
    throw new Error(json.error || "Apple ログインに失敗しました");
  }
  await completeWithTicket(json.tokenHash);
}

export async function startAppleSignIn(next = "/") {
  if (isIosCapacitor()) {
    try {
      await nativeIosAppleSignIn();
      window.location.replace(next.startsWith("/") ? next : "/");
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!/not implemented|unimplemented|unavailable/i.test(message)) {
        throw err;
      }
    }
  }

  const start = new URL("/api/auth/apple/start", window.location.origin);
  start.searchParams.set("next", next);
  if (isAndroidCapacitor()) start.searchParams.set("platform", "android");
  window.location.assign(start.toString());
}
