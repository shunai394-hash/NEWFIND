"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SignupTermsConsent } from "@/components/signup-terms-consent";
import { startAppleSignIn } from "@/lib/apple/client";
import { useApp } from "@/lib/app-context";
import { safeNextPath } from "@/lib/config";
import { isCapacitorNative } from "@/lib/capacitor/platform";
import { getStore, storeMode } from "@/lib/store";
import {
  markSignupTermsCookie,
  needsSignupTermsConsent,
  signupConsentPath,
} from "@/lib/terms/consent";

function oauthErrorLabel(code: string) {
  if (code === "apple_not_configured") {
    return "Apple ログインのサーバー設定がまだ完了していません。";
  }
  if (code === "apple") return "Apple ログインに失敗しました。";
  if (code === "oauth") return "ログインに失敗しました。";
  return code;
}

function oauthExceptionMessage(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  if (/provider is not enabled/i.test(message)) {
    return "Googleログインが有効になっていません。Supabase Auth の Google プロバイダー設定を確認してください。";
  }
  return message;
}

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, sessionResolved, session, me, refresh } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(
    params.get("detail") ||
      (params.get("error") ? oauthErrorLabel(params.get("error")!) : ""),
  );
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const oauthReturning = useRef(false);
  const next = safeNextPath(params.get("next"));
  const local = storeMode() === "local";

  useEffect(() => {
    if (!isCapacitorNative()) return;

    let cancelled = false;
    let listener: { remove: () => Promise<void> } | undefined;
    const onOAuthReturn = () => {
      oauthReturning.current = true;
    };
    window.addEventListener("newfind:oauth-return", onOAuthReturn);

    void import("@capacitor/browser")
      .then(({ Browser }) =>
        Browser.addListener("browserFinished", () => {
          if (cancelled || oauthReturning.current) return;
          setGoogleBusy(false);
          setAppleBusy(false);
          setError("ログイン画面が閉じられました。続ける場合は、もう一度お試しください。");
        }),
      )
      .then((handle) => {
        if (cancelled) void handle.remove();
        else listener = handle;
      })
      .catch((error: unknown) => {
        console.error("[auth] browser close listener setup failed", error);
      });

    return () => {
      cancelled = true;
      window.removeEventListener("newfind:oauth-return", onOAuthReturn);
      if (listener) void listener.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !sessionResolved || !session) return;
    if (me && needsSignupTermsConsent(me)) {
      router.replace(signupConsentPath(next));
      return;
    }
    router.replace(next);
  }, [ready, sessionResolved, session, me, next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const store = getStore();
      if (mode === "signup") {
        if (!termsAccepted) {
          throw new Error("利用規約とプライバシーポリシーへの同意が必要です。");
        }
        await store.signUpEmail(email, password, displayName, {
          termsAccepted: true,
        });
      } else {
        await store.signInEmail(email, password);
      }
      await refresh();
      const confirmed = await store.getSession();
      if (!confirmed) {
        throw new Error("ログイン状態を確認できませんでした。もう一度お試しください。");
      }
      await store.ensureMyProfile(confirmed);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function oauthGoogle() {
    setError("");
    if (mode === "signup") {
      if (!termsAccepted) {
        setError("利用規約とプライバシーポリシーへの同意が必要です。");
        return;
      }
      markSignupTermsCookie();
    }
    setGoogleBusy(true);
    try {
      await getStore().signInOAuth("google", next);
    } catch (err) {
      setError(oauthExceptionMessage(err, "Google ログインに失敗しました"));
      setGoogleBusy(false);
    }
  }

  async function oauthApple() {
    setError("");
    if (mode === "signup") {
      if (!termsAccepted) {
        setError("利用規約とプライバシーポリシーへの同意が必要です。");
        return;
      }
      markSignupTermsCookie();
    }
    setAppleBusy(true);
    try {
      await startAppleSignIn(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apple ログインに失敗しました");
      setAppleBusy(false);
    }
  }

  if (!sessionResolved || session) {
    return (
      <div className="px-6 py-10">
        <p className="text-center text-sm text-neutral-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-10">
      <div className="flex flex-col items-center gap-3">
        <BrandMark className="h-14 w-14" title="NEWFIND" />
        <h1 className="text-center text-3xl font-semibold tracking-tight">NEWFIND</h1>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "signup" ? (
          <>
            <label htmlFor="signup-display-name" className="sr-only">表示名</label>
            <input
              id="signup-display-name"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名"
              autoComplete="nickname"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            />
          </>
        ) : null}
        <label htmlFor="login-email" className="sr-only">メールアドレス</label>
        <input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          required
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        />
        <label htmlFor="login-password" className="sr-only">パスワード</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          required
          minLength={6}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        />
        {mode === "signup" ? (
          <SignupTermsConsent
            accepted={termsAccepted}
            onChange={setTermsAccepted}
          />
        ) : null}
        {error ? (
          <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || (mode === "signup" && !termsAccepted)}
          aria-busy={busy}
          className="w-full rounded-lg bg-[#C6FF00] py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#b5e800] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
        >
          {busy ? "処理中..." : mode === "signup" ? "登録する" : "ログイン"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        または
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void oauthGoogle()}
          disabled={googleBusy || (mode === "signup" && !termsAccepted)}
          aria-busy={googleBusy}
          className="w-full rounded-lg border border-neutral-200 py-2.5 text-sm font-semibold transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
        >
          {googleBusy ? "Google に接続中..." : "Googleで続ける"}
        </button>
        <button
          type="button"
          onClick={() => void oauthApple()}
          disabled={appleBusy || (mode === "signup" && !termsAccepted)}
          aria-busy={appleBusy}
          className="w-full rounded-lg border border-neutral-200 bg-black py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-50"
        >
          {appleBusy ? "Apple に接続中..." : "Appleでログイン"}
        </button>
      </div>

      {local ? (
        <p className="mt-4 text-center text-xs text-neutral-400">
          いまはローカルモードです。メール登録ですぐ使えます。Google / Apple は Supabase Auth 設定後に有効になります。
        </p>
      ) : null}

      <p className="mt-6 text-center text-sm text-neutral-500">
        {mode === "login" ? "アカウントがない場合" : "すでにアカウントがある場合"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setTermsAccepted(false);
            setError("");
          }}
          className="font-semibold text-neutral-900"
        >
          {mode === "login" ? "登録する" : "ログイン"}
        </button>
      </p>
      <p className="mt-4 text-center text-xs text-neutral-500">
        <Link href="/legal" className="underline">
          規則とプライバシー
        </Link>
      </p>
    </div>
  );
}
