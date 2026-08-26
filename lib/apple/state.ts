import { createHmac, timingSafeEqual } from "crypto";
import { applePrivateKeyPem, APPLE_KEY_ID } from "@/lib/apple/config";

export type AppleOAuthState = {
  nonce: string;
  next: string;
  platform: "web" | "android" | "ios";
  t: number;
};

function stateSecret() {
  return (
    process.env.APPLE_STATE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    `${APPLE_KEY_ID}:${applePrivateKeyPem()}`
  );
}

export function encodeAppleState(payload: AppleOAuthState) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodeAppleState(state: string): AppleOAuthState {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Apple state が不正です");
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Apple state の署名が不正です");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AppleOAuthState;
  if (!parsed?.nonce || !parsed.t) throw new Error("Apple state が不完全です");
  if (Date.now() - parsed.t > 10 * 60 * 1000) {
    throw new Error("Apple ログインの有効期限が切れました。もう一度お試しください");
  }
  return parsed;
}
