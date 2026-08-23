"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import type { PostView } from "@/lib/types";

const PAGE_SIZE = 24;

export function FeedView({ kind }: { kind: "foryou" | "following" }) {
  const { session } = useApp();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const dbOffsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (loadingRef.current) return;

      loadingRef.current = true;

      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const page = await getStore().getFeed(
          kind,
          session?.userId ?? null,
          offset,
          PAGE_SIZE,
        );

        dbOffsetRef.current = page.nextOffset;

        if (replace) {
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
      } catch (err) {
        console.error("[FeedView] getFeed failed", err);

        if (replace) {
          setPosts([]);
          dbOffsetRef.current = 0;
        }

        setHasMore(false);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind, session?.userId],
  );

  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    dbOffsetRef.current = 0;
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const target = sentinelRef.current;

    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;

        void loadPage(dbOffsetRef.current, false);
      },
      { rootMargin: "800px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMore, loadPage, posts.length]);

  return (
    <div>
      <div className="grid grid-cols-2 border-b border-neutral-200 bg-white text-sm font-semibold">
        <Link
          href="/"
          className={`py-3 text-center ${
            kind === "foryou"
              ? "border-b-2 border-neutral-900"
              : "text-neutral-400"
          }`}
        >
          For You
        </Link>

        <Link
          href="/following"
          className={`py-3 text-center ${
            kind === "following"
              ? "border-b-2 border-neutral-900"
              : "text-neutral-400"
          }`}
        >
          Following
        </Link>
      </div>

      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-400">
          読み込み中...
        </p>
      ) : posts.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">
          {kind === "following"
            ? "フォロー中の投稿はまだありません。Discoverからアカウントを探してください。"
            : "投稿はまだありません。"}
        </p>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onChange={(next) =>
                setPosts((prev) =>
                  prev.map((p) => (p.id === next.id ? next : p)),
                )
              }
            />
          ))}

          <div ref={sentinelRef} className="min-h-16">
            {loadingMore && (
              <p className="py-6 text-center text-sm text-neutral-400">
                さらに読み込み中...
              </p>
            )}

            {!hasMore && (
              <p className="py-6 text-center text-xs text-neutral-400">
                すべての投稿を表示しました
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
