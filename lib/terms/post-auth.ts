import { cookies } from "next/headers";
import {
  LEGACY_TERMS_VERSION,
  needsSignupTermsConsent,
  SIGNUP_TERMS_COOKIE,
  signupConsentPath,
  TERMS_VERSION,
} from "@/lib/terms/consent";
import { createAdminClient } from "@/lib/supabase/admin";

export async function postAuthRedirectPath(
  userId: string,
  next: string,
  options?: { created?: boolean },
): Promise<string> {
  if (options?.created === false) {
    return next;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("terms_accepted_at, terms_version")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      if (options?.created) return signupConsentPath(next);
      return next;
    }

    const profile = data as {
      terms_accepted_at?: string | null;
      terms_version?: string | null;
    };

    if (profile.terms_version === LEGACY_TERMS_VERSION) {
      return next;
    }

    const cookieStore = await cookies();
    const preAccepted = cookieStore.get(SIGNUP_TERMS_COOKIE)?.value === "1";
    try {
      cookieStore.delete(SIGNUP_TERMS_COOKIE);
    } catch {
      // Cookie cleanup is best-effort.
    }

    if (preAccepted && needsSignupTermsConsent(profile)) {
      await admin
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
        })
        .eq("id", userId);
      return next;
    }

    if (needsSignupTermsConsent(profile) || options?.created) {
      return signupConsentPath(next);
    }
  } catch {
    if (options?.created) return signupConsentPath(next);
  }

  return next;
}
