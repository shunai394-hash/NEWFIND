"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FollowListSheet } from "@/components/follow-list-sheet";
import { MediaThumb } from "@/components/media-thumb";
import { DeletePostButton } from "@/components/delete-post-button";
import { useApp } from "@/lib/app-context";
import { displayUrl, socialLinkEntries } from "@/lib/social-links";
import { getStore } from "@/lib/store";
import { normalizeUsername, usernamesMatch } from "@/lib/username";
import { hasDisplayablePostMedia } from "@/lib/products/discovery-filter";
import type { FollowCounts, PostView, Profile } from "@/lib/types";

type ViewState = "loading" | "success" | "not_found" | "error";
type FollowSheetMode = "followers" | "following" | null;

export function ProfileView({ username }: { username: string }) {
  const { ready, session, me, refresh } = useApp();
  const [state, setState] = useState<ViewState>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [followSheet, setFollowSheet] = useState<FollowSheetMode>(null);

  useEffect(() => {
    let cancelled = false;
    const key = normalizeUsername(username);

    if (!ready) return;

    async function run() {
      setState("loading");
      try {
        const store = getStore();
        let found: Profile | null = null;

        try {
          found = await Promise.race([
            store.getProfileByUsername(key),
            new Promise<null>((_, reject) => {
              window.setTimeout(() => reject(new Error("profile lookup timeout")), 12000);
            }),
          ]);
        } catch (err) {
          console.error("[ProfileView] profile load error", {
            scope: "getProfileByUsername",
            username: key,
            err,
          });
        }

        if (!found && me && usernamesMatch(me.username, key)) {
          found = me;
        }

        if (!found) {
          if (!cancelled) {
            setProfile(null);
            setState("not_found");
          }
          return;
        }

        if (!cancelled) {
          setProfile(found);
          setState("success");
        }

        try {
          const [userPosts, followCounts] = await Promise.all([
            store.getUserPosts(found.id, session?.userId ?? null),
            store.getFollowCounts(found.id),
          ]);
          if (cancelled) return;
          setPosts(userPosts.filter(hasDisplayablePostMedia));
          setCounts(followCounts);
          if (session && found.id !== session.userId) {
            setFollowing(await store.isFollowing(session.userId, found.id));
          } else {
            setFollowing(false);
          }
        } catch (err) {
          console.error("[ProfileView] profile load error", {
            scope: "posts/counts",
            username: key,
            err,
          });
          if (!cancelled) {
            setPosts([]);
            setCounts({ followers: 0, following: 0 });
          }
        }
      } catch (err) {
        console.error("[ProfileView] profile load error", { scope: "load", username: key, err });
        if (!cancelled) {
          setProfile(null);
          setState("error");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [ready, username, session?.userId, me?.id, me?.username]);

  // Keep own profile SNS/avatar in sync after settings save without a full remount race.
  useEffect(() => {
    if (!me) return;
    setProfile((prev) => {
      if (!prev || prev.id !== me.id) return prev;
      if (
        prev.instagramUrl === me.instagramUrl &&
        prev.xUrl === me.xUrl &&
        prev.tiktokUrl === me.tiktokUrl &&
        prev.youtubeUrl === me.youtubeUrl &&
        prev.websiteUrl === me.websiteUrl &&
        prev.avatarUrl === me.avatarUrl &&
        prev.bio === me.bio &&
        prev.displayName === me.displayName
      ) {
        return prev;
      }
      return me;
    });
  }, [
    me,
    me?.id,
    me?.instagramUrl,
    me?.xUrl,
    me?.tiktokUrl,
    me?.youtubeUrl,
    me?.websiteUrl,
    me?.avatarUrl,
    me?.bio,
    me?.displayName,
  ]);

  if (state === "loading") {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (state === "not_found") {
    return <p className="px-4 py-16 text-center text-sm text-neutral-500">ユーザーが見つかりません</p>;
  }
  if (state === "error" || !profile) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-500">プロフィールを表示できません</p>;
  }

  const mine = me?.id === profile.id;
  const socials = socialLinkEntries({
    instagramUrl: profile.instagramUrl,
    xUrl: profile.xUrl,
    tiktokUrl: profile.tiktokUrl,
    youtubeUrl: profile.youtubeUrl,
    websiteUrl: profile.websiteUrl,
  });

  async function onFollow() {
    if (!ready) return;
    if (!session) {
      window.location.href = `/login?next=/u/${encodeURIComponent(normalizeUsername(username))}`;
      return;
    }
    const next = await getStore().toggleFollow(profile!.id, session.userId);
    setFollowing(next);
    setCounts(await getStore().getFollowCounts(profile!.id));
    await refresh();
  }

  async function refreshCounts() {
    if (!profile) return;
    setCounts(await getStore().getFollowCounts(profile.id));
  }

  return (
    <div>
      <div className="bg-white px-4 py-5">
        <div className="flex items-center gap-5">
          <Avatar profile={profile} size={78} />
          <div className="flex flex-1 justify-around text-center text-sm">
            <Stat label="投稿" value={posts.length} />
            <Stat
              label="フォロワー"
              value={counts.followers}
              onClick={() => setFollowSheet("followers")}
            />
            <Stat
              label="フォロー"
              value={counts.following}
              onClick={() => setFollowSheet("following")}
            />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold">{profile.displayName}</p>
          <p className="text-xs text-neutral-400">@{profile.username}</p>
          {profile.accountType === "business" ? (
            <p className="mt-1 text-xs font-semibold text-neutral-500">
              ビジネスアカウント
              {profile.companyName ? ` · ${profile.companyName}` : ""}
            </p>
          ) : null}
          {profile.bio ? <p className="mt-2 text-sm">{profile.bio}</p> : null}
          {profile.companyWebsite ? (
            <a
              href={profile.companyWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-sky-600"
            >
              {displayUrl(profile.companyWebsite)}
            </a>
          ) : null}
          {socials.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {socials.map((item) => (
                <li key={item.platform}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-sky-700"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-4">
          {mine ? (
            <Link
              href="/settings"
              className="block rounded-lg bg-neutral-100 py-2 text-center text-sm font-semibold"
            >
              プロフィールを編集
            </Link>
          ) : (
            <button
              type="button"
              onClick={onFollow}
              className={`w-full rounded-lg py-2 text-sm font-semibold ${
                following ? "bg-neutral-100 text-neutral-700" : "bg-neutral-900 text-white"
              }`}
            >
              {following ? "フォロー中" : "フォロー"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-neutral-200">
        {posts.filter(hasDisplayablePostMedia).map((post) => (
          <div key={post.id} className="relative aspect-square bg-neutral-100">
            <Link href={`/p/${post.id}`} className="block h-full w-full">
              <MediaThumb post={post} />
            </Link>
            {mine && session ? (
              <DeletePostButton
                postId={post.id}
                userId={session.userId}
                onDeleted={(id) => setPosts((prev) => prev.filter((item) => item.id !== id))}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white"
              />
            ) : null}
          </div>
        ))}
      </div>

      {followSheet ? (
        <FollowListSheet
          userId={profile.id}
          mode={followSheet}
          expectedCount={
            followSheet === "followers" ? counts.followers : counts.following
          }
          onClose={() => setFollowSheet(null)}
          onCountsChanged={() => void refreshCounts()}
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const formatted = value.toLocaleString("ja-JP");
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${formatted} ${label}の一覧を開く`}
        className="min-w-[4.5rem] cursor-pointer rounded-md px-1 py-0.5 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
      >
        <p className="font-semibold">{formatted}</p>
        <p className="text-xs text-neutral-400 underline-offset-2 group-hover:underline">{label}</p>
      </button>
    );
  }
  return (
    <div className="min-w-[4.5rem] px-1">
      <p className="font-semibold">{formatted}</p>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  );
}
