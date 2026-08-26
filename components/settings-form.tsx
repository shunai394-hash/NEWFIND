"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { validateSocialUrl } from "@/lib/social-links";
import { getStore } from "@/lib/store";
import type { AccountType } from "@/lib/types";
import { profilePath } from "@/lib/username";

export function SettingsForm() {
  const router = useRouter();
  const { ready, sessionResolved, session, me, refresh } = useApp();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && sessionResolved && !session) {
      router.replace("/login?next=/settings");
    }
  }, [ready, sessionResolved, session, router]);

  useEffect(() => {
    if (!ready || !session || me) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setProfileError("プロフィールを読み込めませんでした");
    }, 12000);
    getStore()
      .ensureMyProfile(session)
      .then(() => refresh())
      .catch((err) => {
        console.error("[settings] ensureMyProfile", err);
        if (!cancelled) setProfileError("プロフィールを読み込めませんでした");
      })
      .finally(() => {
        window.clearTimeout(timer);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, session, me, refresh]);

  useEffect(() => {
    if (!session || !me) return;

    setUsername(me.username);
    setDisplayName(me.displayName);
    setAvatarUrl(me.avatarUrl ?? "");
    setAvatarFailed(false);
    setBio(me.bio);
    setAccountType(me.accountType);
    setCompanyName(me.companyName ?? "");
    setCompanyWebsite(me.companyWebsite ?? "");
    setCompanyDescription(me.companyDescription ?? "");
    setInstagramUrl(me.instagramUrl ?? "");
    setXUrl(me.xUrl ?? "");
    setTiktokUrl(me.tiktokUrl ?? "");
    setYoutubeUrl(me.youtubeUrl ?? "");
    setWebsiteUrl(me.websiteUrl ?? "");
    setAvatarFailed(false);
  }, [session, me]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  if (!ready || !sessionResolved) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (!session) return null;
  if (!me) {
    return (
      <p className="px-4 py-16 text-center text-sm text-neutral-500">
        {profileError || "プロフィールを準備しています..."}
      </p>
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const socialChecks = [
        validateSocialUrl("instagram", instagramUrl),
        validateSocialUrl("x", xUrl),
        validateSocialUrl("tiktok", tiktokUrl),
        validateSocialUrl("youtube", youtubeUrl),
        validateSocialUrl("website", websiteUrl),
        accountType === "business"
          ? validateSocialUrl("website", companyWebsite)
          : ({ ok: true as const, url: null }),
      ];
      const failed = socialChecks.find((c) => !c.ok);
      if (failed && !failed.ok) {
        setError(failed.message);
        setBusy(false);
        return;
      }

      const [ig, x, tt, yt, web, companyWeb] = socialChecks;

      let nextAvatarUrl = avatarUrl;

      if (avatarFile) {
        const uploaded = await getStore().uploadMedia(avatarFile);
        nextAvatarUrl = uploaded.url;
      }

      await getStore().updateProfile(session!.userId, {
        username: username.trim(),
        displayName: displayName.trim(),
        avatarUrl: nextAvatarUrl || null,
        bio,
        accountType,
        companyName:
          accountType === "business" ? companyName.trim() || null : null,
        companyWebsite:
          accountType === "business" && companyWeb.ok ? companyWeb.url : null,
        companyDescription:
          accountType === "business"
            ? companyDescription.trim() || null
            : null,
        instagramUrl: ig.ok ? ig.url : null,
        xUrl: x.ok ? x.url : null,
        tiktokUrl: tt.ok ? tt.url : null,
        youtubeUrl: yt.ok ? yt.url : null,
        websiteUrl: web.ok ? web.url : null,
      });

      setAvatarUrl(nextAvatarUrl);
      setAvatarFile(null);
      await refresh();
      router.push(profilePath(username.trim()));
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

      <div className="rounded-2xl bg-white p-4">
        <p className="text-xs font-semibold text-neutral-500">プロフィール画像</p>

        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-2xl font-semibold text-neutral-500">
            {(avatarPreview || avatarUrl) && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview || avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              displayName?.charAt(0)?.toUpperCase() || "?"
            )}
          </div>

          <label className="cursor-pointer rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
            画像を変更
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setAvatarFailed(false);
                setAvatarFile(e.target.files?.[0] ?? null);
              }}
            />
          </label>
        </div>

        {avatarFile ? (
          <p className="mt-2 text-xs text-neutral-500">
            {avatarFile.name} を選択中。保存するとプロフィール画像が更新されます。
          </p>
        ) : null}
      </div>

      <Field label="ユーザー名" value={username} onChange={setUsername} />
      <Field label="表示名" value={displayName} onChange={setDisplayName} />

      <label className="block text-xs font-semibold text-neutral-500">
        自己紹介
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-normal text-neutral-900"
        />
      </label>

      <div className="space-y-3 rounded-2xl bg-white p-3">
        <p className="text-xs font-semibold text-neutral-500">SNS / Web</p>
        <Field label="Instagram" value={instagramUrl} onChange={setInstagramUrl} placeholder="https://instagram.com/..." />
        <Field label="X" value={xUrl} onChange={setXUrl} placeholder="https://x.com/..." />
        <Field label="TikTok" value={tiktokUrl} onChange={setTiktokUrl} placeholder="https://tiktok.com/@..." />
        <Field label="YouTube" value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://youtube.com/..." />
        <Field label="Webサイト" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://..." />
      </div>

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
          <Field label="会社名" value={companyName} onChange={setCompanyName} />
          <Field label="会社Webサイト" value={companyWebsite} onChange={setCompanyWebsite} />
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-500">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-normal text-neutral-900"
      />
    </label>
  );
}
