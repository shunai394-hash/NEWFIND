"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MediaThumb } from "@/components/media-thumb";
import { useApp } from "@/lib/app-context";
import { CATEGORY_LABELS } from "@/lib/categories";
import { getStore } from "@/lib/store";
import { CATEGORIES, type CategoryId, type PostView, type Profile } from "@/lib/types";

type Tab = "search" | "trending" | "new" | "category";

const PAGE_SIZE = 24;

export function DiscoverView() {
  const { session } = useApp();
  const viewerId = session?.userId ?? null;
  const [tab, setTab] = useState<Tab>("trending");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("fashion");
  const [posts, setPosts] = useState<PostView[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const dbOffsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => {
    if (tab === "search") return "Search";
    if (tab === "trending") return "Trending";
    if (tab === "new") return "New Finds";
    return "Category";
  }, [tab]);

  const paginatedTab = tab !== "search";

  const loadPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (loadingRef.current) return;

      loadingRef.current = true;

      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const store = getStore();

      try {
        if (tab === "search") {
          const result = await store.search(query, viewerId);
          setUsers(result.users);
          setPosts(result.posts);
          setHasMore(false);
          dbOffsetRef.current = 0;
        } else if (tab === "trending") {
          const page = await store.trending(viewerId, offset, PAGE_SIZE);
          dbOffsetRef.current = page.nextOffset;
          if (replace) {
            setUsers([]);
            setPosts(page.posts);
          } else {
            setPosts((prev) => {
              const existing = new Set(prev.map((post) => post.id));
              return [
                ...prev,
                ...page.posts.filter((post) => !existing.has(post.id)),
              ];
            });
          }
          setHasMore(page.hasMore);
        } else if (tab === "new") {
          const page = await store.newFinds(viewerId, offset, PAGE_SIZE);
          dbOffsetRef.current = page.nextOffset;
          if (replace) {
            setUsers([]);
            setPosts(page.posts);
          } else {
            setPosts((prev) => {
              const existing = new Set(prev.map((post) => post.id));
              return [
                ...prev,
                ...page.posts.filter((post) => !existing.has(post.id)),
              ];
            });
          }
          setHasMore(page.hasMore);
        } else {
          const page = await store.byCategory(category, viewerId, offset, PAGE_SIZE);
          dbOffsetRef.current = page.nextOffset;
          if (replace) {
            setUsers([]);
            setPosts(page.posts);
          } else {
            setPosts((prev) => {
              const existing = new Set(prev.map((post) => post.id));
              return [
                ...prev,
                ...page.posts.filter((post) => !existing.has(post.id)),
              ];
            });
          }
          setHasMore(page.hasMore);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, query, category, viewerId],
  );

  useEffect(() => {
    setPosts([]);
    setUsers([]);
    setHasMore(true);
    dbOffsetRef.current = 0;

    const timer = setTimeout(
      () => {
        void loadPage(0, true);
      },
      tab === "search" ? 200 : 0,
    );

    return () => clearTimeout(timer);
  }, [loadPage]);

  useEffect(() => {
    const target = sentinelRef.current;

    if (!target || !hasMore || !paginatedTab) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;

        void loadPage(dbOffsetRef.current, false);
      },
      { rootMargin: "800px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMore, loadPage, paginatedTab, posts.length]);

  return (
    <div>
      <div className="grid grid-cols-4 border-b border-neutral-200 bg-white text-[11px] font-semibold">
        {(
          [
            ["search", "Search"],
            ["trending", "Trending"],
            ["new", "New Finds"],
            ["category", "Category"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`py-3 ${tab === id ? "border-b-2 border-neutral-900" : "text-neutral-400"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <div className="bg-white px-3 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="アカウントや投稿を検索"
            className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm outline-none"
          />
        </div>
      ) : null}

      {tab === "category" ? (
        <div className="flex gap-2 overflow-x-auto bg-white px-3 py-3">
          {CATEGORIES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                category === id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>
      ) : (
        <div className="space-y-4 px-3 py-3">
          {tab === "search" && users.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-semibold text-neutral-400">アカウント</p>
              <div className="space-y-2">
                {users.map((user) => (
                  <Link
                    key={user.id}
                    href={`/u/${user.username}`}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                  >
                    <Avatar profile={user} />
                    <div>
                      <p className="text-sm font-semibold">{user.username}</p>
                      <p className="text-xs text-neutral-400">{user.displayName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <p className="mb-2 text-xs font-semibold text-neutral-400">{title}</p>
            {posts.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">見つかりませんでした</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1">
                  {posts.map((post) => (
                    <Link key={post.id} href={`/p/${post.id}`} className="relative aspect-square bg-neutral-100">
                      <MediaThumb post={post} />
                      {post.mediaType === "video" ? (
                        <span className="absolute right-1 top-1 text-[10px] font-bold text-white">▶</span>
                      ) : null}
                    </Link>
                  ))}
                </div>

                {paginatedTab ? (
                  <div ref={sentinelRef} className="min-h-12">
                    {loadingMore ? (
                      <p className="py-4 text-center text-sm text-neutral-400">さらに読み込み中...</p>
                    ) : null}
                    {!hasMore ? (
                      <p className="py-4 text-center text-xs text-neutral-400">
                        すべての投稿を表示しました
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
