export const TERMS_VERSION = "2026-09-10";
export const LEGACY_TERMS_VERSION = "legacy";
export const SIGNUP_TERMS_COOKIE = "nf_signup_terms";

export type SignupConsentFields = {
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
};

export function needsSignupTermsConsent(
  profile: SignupConsentFields | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.termsAcceptedAt || profile.terms_accepted_at) return false;

  const version = profile.termsVersion ?? profile.terms_version;
  if (version === undefined || version === null) {
    return false;
  }
  if (version === LEGACY_TERMS_VERSION) return false;
  if (version === TERMS_VERSION) return false;

  return version === "";
}

export function signupConsentPath(next = "/") {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `/signup/consent?next=${encodeURIComponent(safeNext)}`;
}

export function markSignupTermsCookie() {
  if (typeof document === "undefined") return;
  document.cookie =
    SIGNUP_TERMS_COOKIE + "=1; Path=/; Max-Age=900; SameSite=Lax";
}

export function clearSignupTermsCookie() {
  if (typeof document === "undefined") return;
  document.cookie = SIGNUP_TERMS_COOKIE + "=; Path=/; Max-Age=0; SameSite=Lax";
}
