"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MediaThumb } from "@/components/media-thumb";
import { ProductCard } from "@/components/product-card";
import { useApp } from "@/lib/app-context";
import { POST_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { fetchDiscoveryList } from "@/lib/discovery/client-api";
import { filterDiscoveryPosts } from "@/lib/products/discovery-filter";
import { getStore } from "@/lib/store";
import { type CategoryId, type PostView, type Profile } from "@/lib/types";
import type { DiscoveryProduct } from "@/lib/discovery/types";

type Tab = "products" | "search" | "posts";

const PAGE_SIZE = 24;

export function DiscoverView() {
  const { session } = useApp();
  const viewerId = session?.userId ?? null;
  const [tab, setTab] = useState<Tab>("products");
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

  const [catalog, setCatalog] = useState<DiscoveryProduct[]>([]);

  useEffect(() => {
    fetchDiscoveryList("approved")
      .then((data) => setCatalog(data.products))
      .catch(() => setCatalog([]));
  }, []);

  const shownProducts = useMemo(() => {
    const products = catalog;
    if (tab === "search") {
      const q = query.trim().toLowerCase();
      if (!q) return products;
      return products.filter((item) =>
        [item.productName, item.brand, item.description, ...item.people.map((person) => person.personName)]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (tab !== "products") return [];
    return products.filter((item) => {
      if (category === "fashion") return item.category === "fashion" || item.trendTags.includes("teen");
      if (category === "beauty") return item.category === "beauty";
      if (category === "accessories") return item.category === "accessories";
      if (category === "fragrance") return item.category === "fragrance";
      if (category === "japan_brands") {
        return item.category === "japan_brand" || item.trendTags.includes("japan_trend");
      }
      if (category === "celebrity") {
        return item.category === "celebrity_style" || item.people.length > 0;
      }
      return true;
    });
  }, [tab, query, category, catalog]);

  const paginatedTab = tab === "posts";

  const loadPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (tab === "products") {
        setLoading(false);
        setHasMore(false);
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (replace) setLoading(true);
      else setLoadingMore(true);

      const store = getStore();
      try {
        if (tab === "search") {
          const result = await store.search(query, viewerId);
          setUsers(result.users);
          setPosts(filterDiscoveryPosts(result.posts));
          setHasMore(false);
          dbOffsetRef.current = 0;
        } else {
          const page = await store.trending(viewerId, offset, PAGE_SIZE);
          dbOffsetRef.current = page.nextOffset;
          const safe = filterDiscoveryPosts(page.posts);
          if (replace) {
            setUsers([]);
            setPosts(safe);
          } else {
            setPosts((prev) => {
              const existing = new Set(prev.map((post) => post.id));
              return [...prev, ...safe.filter((post) => !existing.has(post.id))];
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
    [tab, query, viewerId],
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
  }, [loadPage, tab]);

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
      <section className="border-b border-neutral-200 bg-white px-4 py-4">
        <h1 className="text-xl font-semibold">Discover</h1>
      </section>

      <div className="grid grid-cols-3 border-b border-neutral-200 bg-white text-[11px] font-semibold">
        {(
          [
            ["products", "商品"],
            ["search", "Search"],
            ["posts", "投稿"],
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
            placeholder="商品・アカウント・投稿を検索"
            className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm outline-none"
          />
        </div>
      ) : null}

      {tab === "products" ? (
        <div className="flex gap-2 overflow-x-auto bg-white px-3 py-3">
          {POST_CATEGORIES.filter((id) =>
            ["fashion", "beauty", "accessories", "fragrance", "japan_brands", "celebrity"].includes(id),
          ).map((id) => (
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

      {loading && tab !== "products" ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>
      ) : (
        <div className="space-y-4 px-0 py-0">
          {tab === "search" && users.length > 0 ? (
            <section className="px-3 pt-3">
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

          {(tab === "products" || tab === "search") && shownProducts.length > 0 ? (
            <section>
              <p className="mb-2 px-3 pt-3 text-xs font-semibold text-neutral-400">商品</p>
              <div className="grid grid-cols-2 gap-px bg-neutral-200">
                {shownProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ) : null}

          {tab === "posts" || (tab === "search" && query.trim()) ? (
            <section className="px-3 pb-6">
              <p className="mb-2 text-xs font-semibold text-neutral-400">投稿</p>
              {posts.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-400">
                  商品発見向けの投稿は見つかりませんでした
                </p>
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
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
