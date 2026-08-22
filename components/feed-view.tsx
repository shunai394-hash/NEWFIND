"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PostCard } from "@/components/post-card";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import type { PostView } from "@/lib/types";

export function FeedView({ kind }: { kind: "foryou" | "following" }) {
  const { session } = useApp();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStore()
      .getFeed(kind, session?.userId ?? null)
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [kind, session?.userId]);

  return (
    <div>
      <div className="grid grid-cols-2 border-b border-neutral-200 bg-white text-sm font-semibold">
        <Link
          href="/"
          className={`py-3 text-center ${kind === "foryou" ? "border-b-2 border-neutral-900" : "text-neutral-400"}`}
        >
          For You
        </Link>
        <Link
          href="/following"
          className={`py-3 text-center ${kind === "following" ? "border-b-2 border-neutral-900" : "text-neutral-400"}`}
        >
          Following
        </Link>
      </div>
      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">
          {kind === "following"
            ? "フォロー中の投稿はまだありません。Discover からアカウントを探してください。"
            : "投稿はまだありません。"}
        </p>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onChange={(next) =>
              setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)))
            }
          />
        ))
      )}
    </div>
  );
}
