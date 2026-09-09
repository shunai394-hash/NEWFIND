"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignupTermsConsent } from "@/components/signup-terms-consent";
import { useApp } from "@/lib/app-context";
import { authHeaders } from "@/lib/auth/client-headers";
import { safeNextPath } from "@/lib/config";
import { needsSignupTermsConsent } from "@/lib/terms/consent";

export function SignupConsentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, refresh, session, sessionResolved } = useApp();
  const next = safeNextPath(params.get("next"));
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionResolved) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (me && !needsSignupTermsConsent(me)) {
      router.replace(next);
    }
  }, [sessionResolved, session, me, next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/terms-consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "同意の保存に失敗しました。",
        );
      }
      await refresh();
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "同意の保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 px-6 py-10">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        アカウント登録
      </h1>
      <p className="text-center text-sm text-neutral-600">
        アカウントを作成するには、利用規約とプライバシーポリシーへの同意が必要です。
      </p>
      <SignupTermsConsent accepted={accepted} onChange={setAccepted} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !accepted}
        className="w-full rounded-lg bg-[#C6FF00] py-2.5 text-sm font-semibold text-black disabled:opacity-50"
      >
        同意して続ける
      </button>
    </form>
  );
}
