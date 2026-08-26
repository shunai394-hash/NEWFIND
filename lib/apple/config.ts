import { siteUrl } from "@/lib/config";

export const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID?.trim() || "R35GA3276S";
export const APPLE_SERVICES_ID =
  process.env.APPLE_SERVICES_ID?.trim() || "com.newfind.web";
export const APPLE_BUNDLE_ID =
  process.env.APPLE_BUNDLE_ID?.trim() || "app.newfind.social";
export const APPLE_KEY_ID = process.env.APPLE_KEY_ID?.trim() || "";

export function applePrivateKeyPem() {
  const raw = process.env.APPLE_PRIVATE_KEY?.trim() || "";
  if (!raw) return "";
  return raw.includes("-----BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : `-----BEGIN PRIVATE KEY-----\n${raw.replace(/\\n/g, "\n").replace(/\s+/g, "\n")}\n-----END PRIVATE KEY-----`;
}

export function appleWebRedirectUri() {
  const fromEnv = process.env.APPLE_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  return `${siteUrl()}/api/auth/callback/apple`;
}

export function appleConfigured() {
  return Boolean(APPLE_TEAM_ID && APPLE_SERVICES_ID && APPLE_KEY_ID && applePrivateKeyPem());
}

export const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_ISSUER = "https://appleid.apple.com";

export const APPLE_STATE_COOKIE = "nf_apple_state";
export const APPLE_NONCE_COOKIE = "nf_apple_nonce";
export const APPLE_NEXT_COOKIE = "nf_apple_next";
export const APPLE_PLATFORM_COOKIE = "nf_apple_platform";
