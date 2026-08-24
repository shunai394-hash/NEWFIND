"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { safeNextPath } from "@/lib/config";
import { getStore, storeMode } from "@/lib/store";

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, session, me, refresh } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(params.get("error") ?? "");
  const [busy, setBusy] = useState(false);
  const next = safeNextPath(params.get("next"));
  const local = storeMode() === "local";
  // Temporarily hidden until Apple Developer Program registration/payment is complete.
  const showAppleSignIn = false;

  useEffect(() => {
    if (ready && session && me) {
      router.replace(next);
    }
  }, [ready, session, me, next, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const store = getStore();
      if (mode === "signup") {
        await store.signUpEmail(email, password, displayName);
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

  async function oauth(provider: "google" | "apple") {
    setError("");
    try {
      await getStore().signInOAuth(provider, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuthに失敗しました");
    }
  }

  return (
    <div className="px-6 py-10">
      <h1 className="text-center text-3xl font-semibold tracking-tight">NEWFIND</h1>
      <p className="mt-2 text-center text-sm text-neutral-500">商品を発見するSNS</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "signup" ? (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="表示名"
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm"
          />
        ) : null}
        <input
          type="text" inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          required
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          required
          minLength={6}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {mode === "signup" ? "登録する" : "ログイン"}
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
          onClick={() => oauth("google")}
          className="w-full rounded-lg border border-neutral-200 py-2.5 text-sm font-semibold"
        >
          Googleで続ける
        </button>
        {showAppleSignIn ? (
          <button
            type="button"
            onClick={() => oauth("apple")}
            className="w-full rounded-lg border border-neutral-200 py-2.5 text-sm font-semibold"
          >
            Appleで続ける
          </button>
        ) : null}
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
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="font-semibold text-neutral-900"
        >
          {mode === "login" ? "登録する" : "ログイン"}
        </button>
      </p>
    </div>
  );
}

