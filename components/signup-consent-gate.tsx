"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/app-context";
import {
  needsSignupTermsConsent,
  signupConsentPath,
} from "@/lib/terms/consent";

const SKIP_PREFIXES = [
  "/login",
  "/signup/consent",
  "/terms",
  "/privacy",
  "/legal",
  "/auth",
];

export function SignupConsentGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionResolved, me } = useApp();

  useEffect(() => {
    if (!sessionResolved || !me) return;
    if (!needsSignupTermsConsent(me)) return;
    if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    router.replace(signupConsentPath(pathname || "/"));
  }, [sessionResolved, me, pathname, router]);

  return null;
}
