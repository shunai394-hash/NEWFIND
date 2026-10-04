/**
 * Turns OAuth / Sign in with Apple failures into messages a person can act on.
 * Returns null when the person simply cancelled: that is not an error.
 */

export type LoginErrorSource = "google" | "apple" | "oauth" | "email";

const CANCEL_PATTERNS = [
  /AuthorizationError(?: error| エラー)?\s*1001/i,
  /\b1001\b.*(authorization|認証)/i,
  /\bcancel(?:l?ed)?\b/i,
  /キャンセル/,
  /access_denied/i,
  /user (?:closed|dismissed)/i,
];

export function isLoginCancellation(code: string | null | undefined, message: string | null | undefined) {
  if (code === "CANCELED" || code === "cancelled") return true;
  const text = message ?? "";
  return CANCEL_PATTERNS.some((pattern) => pattern.test(text));
}

const RETRY = "時間をおいて、もう一度お試しください。";

export function friendlyLoginError(
  source: LoginErrorSource,
  message: string | null | undefined,
  code?: string | null,
): string | null {
  if (isLoginCancellation(code, message)) return null;
  const text = (message ?? "").trim();
  const label = source === "apple" ? "Apple" : source === "google" ? "Google" : "";
  const prefix = label ? `${label}でログインできませんでした。` : "ログインできませんでした。";

  if (code === "apple_not_configured" || /apple_not_configured/.test(text)) {
    return "Appleでログインは現在ご利用いただけません。メールアドレスまたはGoogleでログインしてください。";
  }
  if (/provider is not enabled/i.test(text)) {
    return `${label || "この方法"}でのログインは現在ご利用いただけません。別の方法でログインしてください。`;
  }
  if (/flow state|code verifier|code challenge|invalid.*(code|grant)|expired|期限/i.test(text)) {
    return `ログインの手続きの有効期限が切れました。もう一度「${label || "ログイン"}」から操作してください。`;
  }
  if (/network|failed to fetch|load failed|offline|timed? ?out|インターネット/i.test(text)) {
    return "通信できませんでした。インターネット接続を確認して、もう一度お試しください。";
  }
  if (source === "apple" && /AuthorizationError(?: error| エラー)?\s*1000/i.test(text)) {
    return "Appleでログインできませんでした。端末の「設定」でApple アカウントにサインインしているか確認して、もう一度お試しください。";
  }
  if (/suspended/i.test(text)) {
    return "このアカウントは現在ご利用いただけません。サポートまでお問い合わせください。";
  }
  if (/invalid login credentials/i.test(text)) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (/email not confirmed/i.test(text)) {
    return "メールアドレスの確認が完了していません。届いたメールのリンクを開いてからログインしてください。";
  }
  return `${prefix}${RETRY}`;
}

export function loginErrorFromParams(params: { get(name: string): string | null }): string {
  const code = params.get("error");
  if (!code) return "";
  const source: LoginErrorSource = code === "apple" || code === "apple_not_configured" ? "apple" : "oauth";
  return friendlyLoginError(source, params.get("detail"), code) ?? "";
}
