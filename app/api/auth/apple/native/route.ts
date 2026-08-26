import { NextResponse } from "next/server";
import { APPLE_BUNDLE_ID } from "@/lib/apple/config";
import { findOrCreateAppleUser, issueAppleLoginTicket } from "@/lib/apple/session";
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

  try {
    if (body.authorizationCode) {
      await exchangeAppleAuthorizationCode({
        code: body.authorizationCode,
        clientId: APPLE_BUNDLE_ID,
        redirectUri: null,
      }).catch(() => {
        // Native auth codes are still validated via identity token below.
      });
    }

    const identity = await verifyAppleIdentityToken({
      idToken: body.identityToken,
      audience: [APPLE_BUNDLE_ID],
      nonce: body.rawNonce,
    });

    const displayName = [body.familyName, body.givenName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const user = await findOrCreateAppleUser({
      appleUserId: identity.sub,
      email: identity.email || body.email || null,
      isPrivateEmail: identity.isPrivateEmail,
      displayName: displayName || null,
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
