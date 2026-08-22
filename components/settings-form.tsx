"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import type { AccountType } from "@/lib/types";

export function SettingsForm() {
  const router = useRouter();
  const { ready, session, me, refresh } = useApp();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !session) {
      router.replace("/login?next=/settings");
    }
  }, [ready, session, router]);

  useEffect(() => {
    if (!session || !me) return;

    setUsername(me.username);
    setDisplayName(me.displayName);
    setBio(me.bio);
    setAccountType(me.accountType);
    setCompanyName(me.companyName ?? "");
    setCompanyWebsite(me.companyWebsite ?? "");
    setCompanyDescription(me.companyDescription ?? "");
  }, [session, me]);

  if (!ready || !session || !me) {
    return null;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await getStore().updateProfile(session!.userId, {
        username: username.trim(),
        displayName: displayName.trim(),
        bio,
        accountType,
        companyName:
          accountType === "business" ? companyName.trim() || null : null,
        companyWebsite:
          accountType === "business" ? companyWebsite.trim() || null : null,
        companyDescription:
          accountType === "business"
            ? companyDescription.trim() || null
            : null,
      });

      await refresh();
      router.push(`/u/${username.trim()}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "プロフィールの保存に失敗しました",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await getStore().signOut();
    await refresh();
    router.replace("/");
  }

  return (
    <form onSubmit={save} className="space-y-3 px-4 py-4">
      <h1 className="text-lg font-semibold">プロフィール設定</h1>

      <Field
        label="ユーザー名"
        value={username}
        onChange={setUsername}
      />

      <Field
        label="表示名"
        value={displayName}
        onChange={setDisplayName}
      />

      <label className="block text-xs font-semibold text-neutral-500">
        自己紹介
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-normal text-neutral-900"
        />
      </label>

      <label className="flex items-center justify-between rounded-lg bg-white px-3 py-3 text-sm">
        ビジネスアカウント
        <input
          type="checkbox"
          checked={accountType === "business"}
          onChange={(e) =>
            setAccountType(e.target.checked ? "business" : "personal")
          }
        />
      </label>

      {accountType === "business" ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <p className="text-xs font-semibold text-neutral-500">
            会社プロフィール
          </p>

          <Field
            label="会社名"
            value={companyName}
            onChange={setCompanyName}
          />

          <Field
            label="Webサイト"
            value={companyWebsite}
            onChange={setCompanyWebsite}
          />

          <label className="block text-xs font-semibold text-neutral-500">
            会社説明
            <textarea
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900"
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "保存中..." : "保存"}
      </button>

      <button
        type="button"
        onClick={signOut}
        className="w-full py-2 text-sm font-semibold text-red-600"
      >
        ログアウト
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-normal text-neutral-900"
      />
    </label>
  );
}

