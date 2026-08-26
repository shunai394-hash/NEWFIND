import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  APPLE_ISSUER,
  APPLE_JWKS_URL,
  APPLE_TOKEN_URL,
  appleWebRedirectUri,
} from "@/lib/apple/config";
import { createAppleClientSecret } from "@/lib/apple/client-secret";
import { sha256Hex } from "@/lib/apple/crypto";

const appleJwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));

export type AppleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  isPrivateEmail: boolean;
};

export async function verifyAppleIdentityToken(params: {
  idToken: string;
  audience: string | string[];
  nonce?: string;
}): Promise<AppleIdentity & { payload: JWTPayload }> {
  const { payload } = await jwtVerify(params.idToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: params.audience,
  });

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) {
    throw new Error("Apple identity token に sub がありません");
  }

  if (params.nonce) {
    const expected = sha256Hex(params.nonce);
    const actual = typeof payload.nonce === "string" ? payload.nonce : "";
    if (actual !== expected && actual !== params.nonce) {
      throw new Error("Apple nonce が一致しません");
    }
  }

  const email = typeof payload.email === "string" ? payload.email : null;
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  const isPrivateEmail =
    payload.is_private_email === true ||
    payload.is_private_email === "true" ||
    Boolean(email?.toLowerCase().endsWith("@privaterelay.appleid.com"));

  return {
    sub,
    email,
    emailVerified,
    isPrivateEmail,
    payload,
  };
}

export async function exchangeAppleAuthorizationCode(params: {
  code: string;
  clientId: string;
  redirectUri?: string | null;
}) {
  const clientSecret = await createAppleClientSecret(params.clientId);
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: clientSecret,
    code: params.code,
    grant_type: "authorization_code",
  });
  if (params.redirectUri === undefined) {
    body.set("redirect_uri", appleWebRedirectUri());
  } else if (params.redirectUri) {
    body.set("redirect_uri", params.redirectUri);
  }

  const res = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    error?: string;
    error_description?: string;
    id_token?: string;
    access_token?: string;
  };
  if (!res.ok || json.error) {
    throw new Error(
      json.error_description || json.error || "Apple authorization code の検証に失敗しました",
    );
  }
  if (!json.id_token) {
    throw new Error("Apple から identity token が返りませんでした");
  }
  return json as { id_token: string; access_token?: string };
}
