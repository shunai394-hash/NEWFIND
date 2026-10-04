import { NextResponse } from "next/server";
import { APPLE_BUNDLE_ID } from "@/lib/apple/config";
import { findOrCreateAppleUser, issueAppleLoginTicket } from "@/lib/apple/session";
import { saveAppleRefreshToken } from "@/lib/apple/token-store";
import {
  exchangeAppleAuthorizationCode,
  verifyAppleIdentityToken,
} from "@/lib/apple/verify";
import { isSupabaseConfigured } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NativeBody = {
  identityToken?: string;
  authorizationCode?: string;
  rawNonce?: string;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "認証サービスが未設定です" }, { status: 500 });
  }

  let body: NativeBody;
  try {
    body = (await request.json()) as NativeBody;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  if (!body.identityToken) {
    return NextResponse.json({ error: "identity token がありません" }, { status: 400 });
  }
  if (!body.rawNonce) {
    // Without the nonce a captured identity token could be replayed.
    return NextResponse.json({ error: "nonce がありません" }, { status: 400 });
  }

  try {
    const identity = await verifyAppleIdentityToken({
      idToken: body.identityToken,
      audience: [APPLE_BUNDLE_ID],
      nonce: body.rawNonce,
    });

    // Exchange the authorization code for a refresh token so the account can
    // later revoke its Sign in with Apple authorization (Guideline 5.1.1(v)).
    // Non-fatal: sign-in still works; deletion then re-authorizes instead.
    let refreshToken: string | null = null;
    if (body.authorizationCode) {
      try {
        const tokens = await exchangeAppleAuthorizationCode({
          code: body.authorizationCode,
          clientId: APPLE_BUNDLE_ID,
          redirectUri: null,
        });
        const exchanged = await verifyAppleIdentityToken({
          idToken: tokens.id_token,
          audience: [APPLE_BUNDLE_ID],
        });
        if (exchanged.sub === identity.sub) refreshToken = tokens.refresh_token ?? null;
      } catch {
        console.warn("[apple] native authorization code exchange failed");
      }
    }

    const displayName = [body.familyName, body.givenName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const user = await findOrCreateAppleUser({
      appleUserId: identity.sub,
      // Only the email inside Apple's signed identity token is trusted; the
      // request body is client-controlled and must never link accounts.
      email: identity.email || null,
      emailVerified: identity.emailVerified,
      isPrivateEmail: identity.isPrivateEmail,
      displayName: displayName || null,
    });
    await saveAppleRefreshToken({
      userId: user.userId,
      appleUserId: identity.sub,
      clientId: APPLE_BUNDLE_ID,
      refreshToken,
    });
    const tokenHash = await issueAppleLoginTicket(user.email);
    return NextResponse.json({ tokenHash, created: user.created });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Apple ログインに失敗しました",
      },
      { status: 401 },
    );
  }
}
