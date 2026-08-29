"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FollowListSheet } from "@/components/follow-list-sheet";
import { MediaThumb } from "@/components/media-thumb";
import { MoreIcon } from "@/components/icons";
import { PostOwnerMenu } from "@/components/post-owner-menu";
import { ProductCard } from "@/components/product-card";
import { ReportSheet } from "@/components/report-sheet";
import { useApp } from "@/lib/app-context";
import { fetchSavedProducts, fetchUserAlerts, patchUserAlert } from "@/lib/discovery/client-api";
import { isUsableProductImage } from "@/lib/discovery/media";
import { ALERT_TYPE_LABELS, type AlertType } from "@/lib/discovery/types";
import { addLocalBlock, isLocallyBlocked, removeLocalBlock } from "@/lib/moderation/client";
import { displayUrl, socialLinkEntries } from "@/lib/social-links";
import { getStore } from "@/lib/store";
import { normalizeUsername, usernamesMatch } from "@/lib/username";
import { hasDisplayablePostMedia } from "@/lib/products/discovery-filter";
import { authHeaders } from "@/lib/auth/client-headers";
import type { DiscoveryProduct } from "@/lib/discovery/types";
import type { FollowCounts, PostView, Profile } from "@/lib/types";

type ViewState = "loading" | "success" | "not_found" | "error";
type FollowSheetMode = "followers" | "following" | null;
type ProfileTab = "posts" | "saved" | "liked";

export function ProfileView({ username }: { username: string }) {
  const { ready, session, me, refresh } = useApp();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [state, setState] = useState<ViewState>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostView[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostView[]>([]);
  const [savedProducts, setSavedProducts] = useState<DiscoveryProduct[]>([]);
  const [alerts, setAlerts] = useState<
    Array<{
      id: string;
      alertType: string;
      productId: string | null;
      brand: string | null;
      isEnabled: boolean;
    }>
  >([]);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [followSheet, setFollowSheet] = useState<FollowSheetMode>(null);
  const [tab, setTab] = useState<ProfileTab>(
    requestedTab === "saved" || requestedTab === "liked" ? requestedTab : "posts",
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (requestedTab === "saved" || requestedTab === "liked" || requestedTab === "posts") {
      setTab(requestedTab);
    }
  }, [requestedTab]);

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
          setBlocked(isLocallyBlocked(found.id));
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

  const mine = Boolean(me && profile && me.id === profile.id);

  useEffect(() => {
    if (!mine || !session) return;
    let cancelled = false;
    Promise.all([
      getStore().getSaved(session.userId),
      getStore().getLiked(session.userId),
      fetchSavedProducts().catch(() => ({ products: [] as DiscoveryProduct[] })),
      fetchUserAlerts().catch(() => []),
    ]).then(([saved, liked, products, userAlerts]) => {
      if (cancelled) return;
      setSavedPosts(saved.filter(hasDisplayablePostMedia));
      setLikedPosts(liked.filter(hasDisplayablePostMedia));
      setSavedProducts(products.products.filter((item) => isUsableProductImage(item.productImageUrl)));
      setAlerts(userAlerts);
    });
    return () => {
      cancelled = true;
    };
  }, [mine, session?.userId]);

  if (state === "loading") {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (state === "not_found") {
    return <p className="px-4 py-16 text-center text-sm text-neutral-500">ユーザーが見つかりません</p>;
  }
  if (state === "error" || !profile) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-500">プロフィールを表示できません</p>;
  }

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

  async function unblock() {
    if (!profile) return;
    removeLocalBlock(profile.id);
    await fetch("/api/blocks", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ userId: profile.id, blocked: false }),
    }).catch(() => undefined);
    setBlocked(false);
  }

  const visiblePosts = posts.filter(hasDisplayablePostMedia);

  return (
    <div>
      <div className="bg-white px-4 py-5">
        <div className="flex items-center gap-5">
          <Avatar profile={profile} size={78} />
          <div className="flex flex-1 justify-around text-center text-sm">
            <Stat label="投稿" value={visiblePosts.length} />
            {mine ? (
              <Stat
                label="フォロー"
                value={counts.following}
                onClick={() => setFollowSheet("following")}
              />
            ) : (
              <button
                type="button"
                onClick={() => void onFollow()}
                className="min-w-[4.5rem] rounded-md px-1 py-0.5"
              >
                <p className="font-semibold">{counts.following.toLocaleString("ja-JP")}</p>
                <p className={`text-xs ${following ? "text-neutral-400" : "font-semibold text-black"}`}>
                  {following ? "フォロー中" : "フォロー"}
                </p>
              </button>
            )}
            <Stat
              label="フォロワー"
              value={counts.followers}
              onClick={() => setFollowSheet("followers")}
            />
          </div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
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
          {mine ? null : (
            <button
              type="button"
              aria-label="通報・ブロック"
              onClick={() => {
                if (!session) {
                  window.location.href = `/login?next=/u/${encodeURIComponent(normalizeUsername(username))}`;
                  return;
                }
                setReportOpen(true);
              }}
              className="p-1 text-neutral-500"
            >
              <MoreIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {blocked ? (
          <div className="mt-4 rounded-xl bg-neutral-50 px-3 py-3">
            <p className="text-sm">このユーザーをブロックしています</p>
            <button
              type="button"
              onClick={() => void unblock()}
              className="mt-2 text-sm font-semibold"
            >
              ブロック解除
            </button>
          </div>
        ) : null}
      </div>

      {mine ? (
        <div className="grid grid-cols-3 border-b border-neutral-200 bg-white text-sm font-semibold">
          {(
            [
              ["posts", "投稿"],
              ["saved", "保存"],
              ["liked", "いいね"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-11 py-3 ${tab === id ? "border-b-2 border-black" : "text-neutral-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {blocked && !mine ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-500">ブロック中のため投稿は表示しません</p>
      ) : !mine || tab === "posts" ? (
        visiblePosts.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-neutral-500">投稿はまだありません</p>
        ) : (
          <div className="grid grid-cols-3 gap-px bg-neutral-200">
            {visiblePosts.map((post) => (
              <div key={post.id} className="relative aspect-square bg-neutral-100">
                <Link href={`/p/${post.id}`} className="block h-full w-full">
                  <MediaThumb post={post} />
                </Link>
                {mine && session ? (
                  <PostOwnerMenu
                    postId={post.id}
                    userId={session.userId}
                    onDeleted={(id) => setPosts((prev) => prev.filter((item) => item.id !== id))}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : tab === "saved" ? (
        <SavedTab
          posts={savedPosts}
          products={savedProducts}
          alerts={alerts}
          onAlertToggle={async (id, next) => {
            await patchUserAlert(id, next).catch(() => null);
            setAlerts((prev) => prev.map((item) => (item.id === id ? { ...item, isEnabled: next } : item)));
          }}
        />
      ) : likedPosts.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-500">いいねした投稿はまだありません</p>
      ) : (
        <div className="grid grid-cols-3 gap-px bg-neutral-200">
          {likedPosts.map((post) => (
            <Link key={post.id} href={`/p/${post.id}`} className="relative aspect-square bg-neutral-100">
              <MediaThumb post={post} />
            </Link>
          ))}
        </div>
      )}

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
      {reportOpen ? (
        <ReportSheet
          targetUserId={profile.id}
          onClose={() => setReportOpen(false)}
          onBlocked={(userId) => {
            addLocalBlock(userId);
            setBlocked(true);
          }}
        />
      ) : null}
    </div>
  );
}

function SavedTab({
  posts,
  products,
  alerts,
  onAlertToggle,
}: {
  posts: PostView[];
  products: DiscoveryProduct[];
  alerts: Array<{
    id: string;
    alertType: string;
    productId: string | null;
    brand: string | null;
    isEnabled: boolean;
  }>;
  onAlertToggle: (id: string, next: boolean) => Promise<void>;
}) {
  if (posts.length === 0 && products.length === 0) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-500">保存した投稿・商品はまだありません</p>;
  }
  return (
    <div>
      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-px bg-neutral-200">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
      {posts.length > 0 ? (
        <div className="grid grid-cols-3 gap-px bg-neutral-200">
          {posts.map((post) => (
            <Link key={post.id} href={`/p/${post.id}`} className="relative aspect-square bg-neutral-100">
              <MediaThumb post={post} />
            </Link>
          ))}
        </div>
      ) : null}
      {alerts.length > 0 ? (
        <section className="border-t border-neutral-200 px-4 py-4">
          <h2 className="text-sm font-semibold">通知 / アラーム</h2>
          <p className="mt-1 text-xs text-neutral-500">
            保存した商品の注目度が上がると、アプリ内の通知に表示されます。
          </p>
          <ul className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
                <span className="text-sm">
                  {ALERT_TYPE_LABELS[alert.alertType as AlertType] ?? alert.alertType}
                  {alert.brand ? ` · ${alert.brand}` : ""}
                </span>
                <button
                  type="button"
                  className="touch-manipulation text-xs font-semibold"
                  onClick={() => void onAlertToggle(alert.id, !alert.isEnabled)}
                >
                  {alert.isEnabled ? "ON" : "OFF"}
                </button>
              </li>
            ))}
          </ul>
        </section>
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
        <p className="text-xs text-neutral-400">{label}</p>
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
