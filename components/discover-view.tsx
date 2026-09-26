"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MediaThumb } from "@/components/media-thumb";
import { ProductCard } from "@/components/product-card";
import { useApp } from "@/lib/app-context";
import { POST_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { fetchDiscoveryList } from "@/lib/discovery/client-api";
import { isJapanProduct } from "@/lib/discovery/product-signals";
import { isUsableProductImage } from "@/lib/discovery/media";
import { filterDiscoveryPosts } from "@/lib/products/discovery-filter";
import { productIdentityKey } from "@/lib/ai/product-identity";
import { getStore } from "@/lib/store";
import { type CategoryId, type PostView, type Profile } from "@/lib/types";
import type { DiscoveryProduct } from "@/lib/discovery/types";

type Tab = "products" | "search" | "posts";

const PAGE_SIZE = 24;
const DISCOVER_PRODUCTS_PER_CATEGORY = 12;

export function DiscoverView({ initialTab = "products" }: { initialTab?: Tab }) {
  const { session } = useApp();
  const viewerId = session?.userId ?? null;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("fashion");
  const [posts, setPosts] = useState<PostView[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const dbOffsetRef = useRef(0);
  const postsRef = useRef<PostView[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [catalog, setCatalog] = useState<DiscoveryProduct[]>([]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    fetchDiscoveryList("approved")
      .then((data) =>
        setCatalog(data.products.filter((item) => isUsableProductImage(item.productImageUrl))),
      )
      .catch(() => setCatalog([]));
  }, []);

  const discoverProducts = useMemo(() => {
    const filtered = catalog.filter((item) => {
      if (category === "fashion") return item.category === "fashion" || item.trendTags.includes("teen");
      if (category === "beauty") return item.category === "beauty";
      if (category === "accessories") return item.category === "accessories";
      if (category === "fragrance") return item.category === "fragrance";
      if (category === "japan_brands") {
        return isJapanProduct(item) || item.trendTags.includes("japan_trend");
      }
      if (category === "celebrity") {
        return item.category === "celebrity_style" || item.people.length > 0;
      }
      return true;
    });

    // 商品タブはカタログ全件をSearchと共有せず、各カテゴリの上位だけを
    // Discover専用の「発見枠」にする。Searchはこの枠を避けて別の商品を返す。
    const seen = new Set<string>();
    const brandCounts = new Map<string, number>();
    return filtered
      .sort((a, b) => b.trendScore - a.trendScore || b.confidenceScore - a.confidenceScore)
      .filter((item) => {
        const identity = productIdentityKey(item);
        if (seen.has(identity)) return false;
        // Discover is a discovery surface, not a single-brand catalog.
        // Keep a brand from occupying the whole first screen when other brands exist.
        const brandKey = (item.normalizedBrand || item.brand || "").trim().toLowerCase();
        const count = brandCounts.get(brandKey) ?? 0;
        if (brandKey && count >= 2) return false;
        seen.add(identity);
        if (brandKey) brandCounts.set(brandKey, count + 1);
        return true;
      })
      .slice(0, DISCOVER_PRODUCTS_PER_CATEGORY);
  }, [category, catalog]);

  const discoverProductIdentities = useMemo(
    () => new Set(discoverProducts.map((item) => productIdentityKey(item))),
    [discoverProducts],
  );

  const shownProducts = useMemo(() => {
    const products = catalog;
    if (tab === "search") {
      const q = query.trim().toLowerCase();

      // Search is query-driven. Do not expose the entire Discover product catalog
      // when the search box is empty; otherwise Search becomes a duplicate of 商品.
      if (!q) return [];

      const seen = new Set<string>();
      return products.filter((item) => {
        // Avoid showing the same product in both the current Discover collection
        // and Search. Identity matching also catches duplicate rows with different IDs.
        const identity = productIdentityKey(item);
        if (discoverProductIdentities.has(identity) || seen.has(identity)) return false;

        const haystack = [
          item.productName,
          item.brand,
          item.description,
          item.category,
          item.subcategory,
          item.country,
          item.productUrl,
          item.officialUrl,
          ...item.trendTags,
          ...item.people.map((person) => person.personName),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
        seen.add(identity);
        return true;
      });
    }
    if (tab !== "products") return [];
    return discoverProducts;
  }, [tab, query, catalog, discoverProducts, discoverProductIdentities]);

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
          const collected: PostView[] = [];
          const seen = new Set(replace ? [] : postsRef.current.map((post) => post.id));
          let cursor = offset;
          let more = true;
          while (collected.length < PAGE_SIZE && more) {
            const page = await store.trending(viewerId, cursor, PAGE_SIZE);
            cursor = page.nextOffset;
            more = page.hasMore;
            if (page.posts.length === 0) break;
            for (const post of filterDiscoveryPosts(page.posts)) {
              if (seen.has(post.id)) continue;
              seen.add(post.id);
              collected.push(post);
            }
          }
          dbOffsetRef.current = cursor;
          if (replace) {
            setUsers([]);
            setPosts(collected);
          } else {
            setPosts((prev) => {
              const existing = new Set(prev.map((post) => post.id));
              return [...prev, ...collected.filter((post) => !existing.has(post.id))];
            });
          }
          setHasMore(more);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, query, viewerId],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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

          {(tab === "products" || (tab === "search" && query.trim())) && shownProducts.length > 0 ? (
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








