"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MediaThumb } from "@/components/media-thumb";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import { normalizeUsername, usernamesMatch } from "@/lib/username";
import type { FollowCounts, PostView, Profile } from "@/lib/types";

type ViewState = "loading" | "success" | "not_found" | "error";

export function ProfileView({ username }: { username: string }) {
  const { ready, session, me, refresh } = useApp();
  const [state, setState] = useState<ViewState>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);

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
          console.error("[profile] getProfileByUsername", err);
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
          setPosts(userPosts);
          setCounts(followCounts);
          if (session && found.id !== session.userId) {
            setFollowing(await store.isFollowing(session.userId, found.id));
          } else {
            setFollowing(false);
          }
        } catch (err) {
          console.error("[profile] posts/counts", err);
          if (!cancelled) {
            setPosts([]);
            setCounts({ followers: 0, following: 0 });
          }
        }
      } catch (err) {
        console.error("[profile] load", err);
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

  return (
    <div>
      <div className="bg-white px-4 py-5">
        <div className="flex items-center gap-5">
          <Avatar profile={profile} size={78} />
          <div className="flex flex-1 justify-around text-center text-sm">
            <Stat label="投稿" value={posts.length} />
            <Stat label="フォロワー" value={counts.followers} />
            <Stat label="フォロー" value={counts.following} />
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
              {profile.companyWebsite.replace(/^https?:\/\//, "")}
            </a>
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
        {posts.map((post) => (
          <Link key={post.id} href={`/p/${post.id}`} className="aspect-square bg-neutral-100">
            <MediaThumb post={post} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-semibold">{value}</p>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  );
}
