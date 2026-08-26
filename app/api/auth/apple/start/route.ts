import { NextResponse } from "next/server";
import { isSupabaseConfigured, safeNextPath } from "@/lib/config";
import {
  APPLE_AUTHORIZE_URL,
  APPLE_SERVICES_ID,
  appleConfigured,
  appleWebRedirectUri,
} from "@/lib/apple/config";
import { randomAppleValue } from "@/lib/apple/crypto";
import { encodeAppleState } from "@/lib/apple/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isSupabaseConfigured() || !appleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=apple_not_configured", url.origin),
    );
  }

  const next = safeNextPath(url.searchParams.get("next"));
  const platformParam = url.searchParams.get("platform");
  const platform =
    platformParam === "android" || platformParam === "ios" ? platformParam : "web";

  const nonce = randomAppleValue();
  const state = encodeAppleState({
    nonce,
    next,
    platform,
    t: Date.now(),
  });

  const authorize = new URL(APPLE_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", APPLE_SERVICES_ID);
  authorize.searchParams.set("redirect_uri", appleWebRedirectUri());
  authorize.searchParams.set("response_type", "code id_token");
  authorize.searchParams.set("response_mode", "form_post");
  authorize.searchParams.set("scope", "name email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);

  return NextResponse.redirect(authorize.toString());
}
