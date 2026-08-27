"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { useApp } from "@/lib/app-context";
import { FEED_CHANNELS, type FeedChannelId } from "@/lib/japan-context";
import { getStore } from "@/lib/store";
import type { PostView } from "@/lib/types";

const PAGE_SIZE = 24;

export function FeedView({ kind }: { kind: "foryou" | "following" }) {
  const { session } = useApp();
  const [channel, setChannel] = useState<FeedChannelId>("today");
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const dbOffsetRef = useRef(0);
  const postsRef = useRef<PostView[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const selected = FEED_CHANNELS.find((item) => item.id === channel) ?? FEED_CHANNELS[0]!;
  postsRef.current = posts;

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
        const store = getStore();
        const category = selected.categories?.[0];
        const collected: PostView[] = [];
        const seen = new Set(replace ? [] : postsRef.current.map((post) => post.id));
        let cursor = offset;
        let more = true;

        while (collected.length < PAGE_SIZE && more) {
          const page =
            kind === "foryou" && category
              ? await store.byCategory(category, session?.userId ?? null, cursor, PAGE_SIZE)
              : await store.getFeed(kind, session?.userId ?? null, cursor, PAGE_SIZE);

          cursor = page.nextOffset;
          more = page.hasMore;

          if (page.posts.length === 0) break;

          for (const post of page.posts) {
            if (seen.has(post.id)) continue;
            seen.add(post.id);
            collected.push(post);
          }
        }

        dbOffsetRef.current = cursor;

        if (replace) {
          setPosts(collected);
        } else {
          setPosts((prev) => {
            const existing = new Set(prev.map((post) => post.id));
            return [...prev, ...collected.filter((post) => !existing.has(post.id))];
          });
        }

        setHasMore(more);
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
    [kind, session, selected.categories],
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
      {kind === "foryou" ? (
        <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2.5 [scrollbar-width:none]">
          {FEED_CHANNELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChannel(item.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wide ${
                channel === item.id
                  ? "bg-[#C6FF00] text-black"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 border-b border-neutral-200 bg-white text-sm font-semibold">
        <Link
          href="/"
          className={`py-3 text-center ${
            kind === "foryou"
              ? "border-b-2 border-[#C6FF00]"
              : "text-neutral-400"
          }`}
        >
          For You
        </Link>

        <Link
          href="/following"
          className={`py-3 text-center ${
            kind === "following"
              ? "border-b-2 border-[#C6FF00]"
              : "text-neutral-400"
          }`}
        >
          Following
        </Link>
      </div>

      {kind === "foryou" ? (
        <p className="bg-white px-4 py-2 text-[11px] text-neutral-400">
          {selected.hint}
        </p>
      ) : null}

      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-400">
          読み込み中...
        </p>
      ) : posts.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">
          {kind === "following"
            ? "フォロー中の投稿はまだありません。Discoverからアカウントを探してください。"
            : channel === "today"
              ? "投稿はまだありません。"
              : `${selected.hint}の投稿はまだありません。見つけたら投稿してください。`}
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
              onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}

          <div ref={sentinelRef} className="min-h-16">
            {loadingMore && (
              <p className="py-6 text-center text-sm text-neutral-400">
                さらに読み込み中...
              </p>
            )}

            {hasMore && !loadingMore ? (
              <button
                type="button"
                onClick={() => void loadPage(dbOffsetRef.current, false)}
                className="mx-auto my-4 block rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold"
              >
                Load more
              </button>
            ) : null}

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
