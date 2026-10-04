"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SignupTermsConsent } from "@/components/signup-terms-consent";
import { AppleSignInError, startAppleSignIn } from "@/lib/apple/client";
import { useApp } from "@/lib/app-context";
import { friendlyLoginError, loginErrorFromParams } from "@/lib/auth/login-errors";
import { onNativeBrowserClosed } from "@/lib/capacitor/oauth-browser";
import { isCapacitorNative } from "@/lib/capacitor/platform";
import { safeNextPath } from "@/lib/config";
import { getStore, storeMode } from "@/lib/store";
import {
  markSignupTermsCookie,
  needsSignupTermsConsent,
  signupConsentPath,
} from "@/lib/terms/consent";

function AppleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 17 20" className="h-[18px] w-[15px]" fill="currentColor">
      <path d="M14.06 10.62c-.02-2.13 1.74-3.16 1.82-3.21-1-1.45-2.54-1.65-3.08-1.67-1.31-.13-2.56.77-3.22.77-.67 0-1.69-.75-2.78-.73-1.43.02-2.75.83-3.48 2.11-1.49 2.58-.38 6.39 1.07 8.48.71 1.02 1.55 2.17 2.65 2.13 1.07-.04 1.47-.69 2.76-.69 1.29 0 1.65.69 2.78.67 1.15-.02 1.87-1.04 2.57-2.07.81-1.18 1.14-2.33 1.16-2.39-.03-.01-2.22-.85-2.25-3.39ZM11.95 4.36c.59-.71.98-1.7.87-2.69-.84.03-1.87.56-2.48 1.27-.54.63-1.02 1.64-.89 2.61.94.07 1.91-.48 2.5-1.19Z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, sessionResolved, session, me, refresh } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(() => loginErrorFromParams(params));
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Guards against a double tap starting two OAuth flows before React re-renders.
  const providerInFlight = useRef(false);
  const stopBrowserWatch = useRef<(() => void) | null>(null);
  const next = safeNextPath(params.get("next"));
  const local = storeMode() === "local";
  const providerBusy = googleBusy || appleBusy;

  useEffect(() => {
    if (!ready || !sessionResolved || !session) return;
    if (me && needsSignupTermsConsent(me)) {
      router.replace(signupConsentPath(next));
      return;
    }
    router.replace(next);
  }, [ready, sessionResolved, session, me, next, router]);

  useEffect(() => () => stopBrowserWatch.current?.(), []);

  function finishProvider() {
    providerInFlight.current = false;
    stopBrowserWatch.current?.();
    stopBrowserWatch.current = null;
    setGoogleBusy(false);
    setAppleBusy(false);
  }

  /** On native, the flow continues in a browser sheet; reset when it closes. */
  async function watchBrowserSheet() {
    if (!isCapacitorNative()) return;
    stopBrowserWatch.current?.();
    stopBrowserWatch.current = await onNativeBrowserClosed(() => {
      // The OAuth return navigates away; if we are still here, the person cancelled.
      window.setTimeout(finishProvider, 400);
    }).catch(() => null);
  }

  function beginProvider(): boolean {
    if (providerInFlight.current || busy) return false;
    setError("");
    if (mode === "signup") {
      if (!termsAccepted) {
        setError("利用規約とプライバシーポリシーへの同意が必要です。");
        return false;
      }
      markSignupTermsCookie();
    }
    providerInFlight.current = true;
    return true;
  }

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
      const message = err instanceof Error ? err.message : "";
      // Our own messages are already Japanese; translate raw Supabase errors.
      setError(
        /[\u3040-\u30ff\u4e00-\u9fff]/.test(message)
          ? message
          : friendlyLoginError("email", message) ?? "",
      );
    } finally {
      setBusy(false);
    }
  }

  async function oauthGoogle() {
    if (!beginProvider()) return;
    setGoogleBusy(true);
    try {
      // Register before opening the native browser sheet so a fast cancel
      // cannot emit browserFinished before we are listening.
      await watchBrowserSheet();
      await getStore().signInOAuth("google", next);
    } catch (err) {
      finishProvider();
      setError(
        friendlyLoginError("google", err instanceof Error ? err.message : String(err)) ?? "",
      );
    }
  }

  async function oauthApple() {
    if (!beginProvider()) return;
    setAppleBusy(true);
    try {
      // Register before starting Apple auth: native plugin cancellation resets
      // in catch; if the plugin falls back to a browser sheet, its close event
      // is already observed.
      await watchBrowserSheet();
      await startAppleSignIn(next);
    } catch (err) {
      finishProvider();
      const code = err instanceof AppleSignInError ? err.code : null;
      setError(
        friendlyLoginError("apple", err instanceof Error ? err.message : String(err), code) ?? "",
      );
    }
  }

  if (!sessionResolved || session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-10" role="status">
        <span className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner />
          読み込み中…
        </span>
      </div>
    );
  }

  const providerDisabled = providerBusy || busy || (mode === "signup" && !termsAccepted);
  const inputClass =
    "h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="h-16 w-16 rounded-[18px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]" title="NEWFIND" />
        <h1 className="text-3xl font-semibold tracking-tight">NEWFIND</h1>
        <p className="text-sm text-neutral-500">
          {mode === "signup"
            ? "アカウントを作成して、気になるモノを見つけましょう。"
            : "ログインして、新しいモノとの出会いを続けましょう。"}
        </p>
      </div>

      {mode === "signup" ? (
        <div className="mt-8">
          <SignupTermsConsent accepted={termsAccepted} onChange={setTermsAccepted} />
        </div>
      ) : null}

      <div className={`${mode === "signup" ? "mt-4" : "mt-8"} space-y-3`}>
        <button
          type="button"
          onClick={() => void oauthApple()}
          disabled={providerDisabled}
          aria-busy={appleBusy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black text-[17px] font-medium text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {appleBusy ? <Spinner /> : <AppleLogo />}
          {appleBusy ? "Appleに接続中…" : "Appleでサインイン"}
        </button>
        <button
          type="button"
          onClick={() => void oauthGoogle()}
          disabled={providerDisabled}
          aria-busy={googleBusy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-[17px] font-medium text-neutral-900 transition active:scale-[0.99] disabled:opacity-50"
        >
          {googleBusy ? <Spinner /> : <GoogleLogo />}
          {googleBusy ? "Googleに接続中…" : "Googleでログイン"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
          {error}
        </p>
      ) : null}

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        またはメールアドレスで
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" ? (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="表示名"
            aria-label="表示名"
            autoComplete="nickname"
            className={inputClass}
          />
        ) : null}
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
          aria-label="メールアドレス"
          required
          className={inputClass}
        />
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード（6文字以上）"
          aria-label="パスワード"
          required
          minLength={6}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy || providerBusy || (mode === "signup" && !termsAccepted)}
          aria-busy={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C6FF00] text-base font-semibold text-black transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? <Spinner /> : null}
          {mode === "signup" ? "メールアドレスで登録" : "メールアドレスでログイン"}
        </button>
      </form>

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
          className="inline-flex min-h-11 items-center font-semibold text-neutral-900 underline-offset-4 hover:underline"
        >
          {mode === "login" ? "新規登録" : "ログイン"}
        </button>
      </p>
      <p className="mt-2 text-center text-xs text-neutral-500">
        <Link href="/legal" className="inline-flex min-h-11 items-center underline">
          利用規約とプライバシーポリシー
        </Link>
      </p>
    </div>
  );
}
