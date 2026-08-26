import { NextResponse } from "next/server";
import { ANDROID_OAUTH_CALLBACK } from "@/lib/capacitor/platform";
import { APPLE_SERVICES_ID, appleWebRedirectUri } from "@/lib/apple/config";
import { findOrCreateAppleUser, issueAppleLoginTicket } from "@/lib/apple/session";
import { decodeAppleState } from "@/lib/apple/state";
import {
  exchangeAppleAuthorizationCode,
  verifyAppleIdentityToken,
} from "@/lib/apple/verify";
import { isSupabaseConfigured, safeNextPath } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AppleForm = {
  code: string | null;
  idToken: string | null;
  state: string | null;
  userJson: string | null;
  error: string | null;
};

async function readApplePayload(request: Request): Promise<AppleForm> {
  if (request.method === "POST") {
    const form = await request.formData();
    return {
      code: stringOrNull(form.get("code")),
      idToken: stringOrNull(form.get("id_token")),
      state: stringOrNull(form.get("state")),
      userJson: stringOrNull(form.get("user")),
      error: stringOrNull(form.get("error")),
    };
  }
  const url = new URL(request.url);
  return {
    code: url.searchParams.get("code"),
    idToken: url.searchParams.get("id_token"),
    state: url.searchParams.get("state"),
    userJson: url.searchParams.get("user"),
    error: url.searchParams.get("error"),
  };
}

function stringOrNull(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? value : null;
}

function displayNameFromAppleUser(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      name?: { firstName?: string; lastName?: string };
    };
    const name = [parsed.name?.lastName, parsed.name?.firstName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name || null;
  } catch {
    return null;
  }
}

function loginError(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", "apple");
  url.searchParams.set("detail", message);
  return NextResponse.redirect(url);
}

async function completeAppleLogin(request: Request) {
  const origin = new URL(request.url).origin;
  if (!isSupabaseConfigured()) {
    return loginError(origin, "認証サービスが未設定です");
  }

  let form: AppleForm;
  try {
    form = await readApplePayload(request);
  } catch {
    return loginError(origin, "Apple からの応答を読み取れませんでした");
  }

  if (form.error) {
    return loginError(origin, form.error);
  }
  if (!form.code || !form.state) {
    return loginError(origin, "Apple の認可コードがありません");
  }

  let state;
  try {
    state = decodeAppleState(form.state);
  } catch (err) {
    return loginError(
      origin,
      err instanceof Error ? err.message : "Apple state の検証に失敗しました",
    );
  }

  try {
    const tokens = await exchangeAppleAuthorizationCode({
      code: form.code,
      clientId: APPLE_SERVICES_ID,
      redirectUri: appleWebRedirectUri(),
    });

    const identity = await verifyAppleIdentityToken({
      idToken: tokens.id_token,
      audience: APPLE_SERVICES_ID,
      nonce: state.nonce,
    });

    if (form.idToken) {
      const posted = await verifyAppleIdentityToken({
        idToken: form.idToken,
        audience: APPLE_SERVICES_ID,
        nonce: state.nonce,
      });
      if (posted.sub !== identity.sub) {
        throw new Error("Apple user identifier が一致しません");
      }
    }

    const user = await findOrCreateAppleUser({
      appleUserId: identity.sub,
      email: identity.email,
      isPrivateEmail: identity.isPrivateEmail,
      displayName: displayNameFromAppleUser(form.userJson),
    });
    const tokenHash = await issueAppleLoginTicket(user.email);
    const next = safeNextPath(state.next);

    if (state.platform === "android") {
      const deep = new URL(ANDROID_OAUTH_CALLBACK);
      deep.searchParams.set("token_hash", tokenHash);
      deep.searchParams.set("type", "magiclink");
      deep.searchParams.set("provider", "apple");
      deep.searchParams.set("next", next);
      return NextResponse.redirect(deep.toString());
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (error) {
      throw new Error(error.message);
    }
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    return loginError(
      origin,
      err instanceof Error ? err.message : "Apple ログインに失敗しました",
    );
  }
}

export async function GET(request: Request) {
  return completeAppleLogin(request);
}

export async function POST(request: Request) {
  return completeAppleLogin(request);
}
