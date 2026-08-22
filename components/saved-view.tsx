"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import type { PostView } from "@/lib/types";

export function SavedView() {
  const router = useRouter();
  const { ready, session } = useApp();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/login?next=/saved");
      return;
    }
    let cancelled = false;
    getStore()
      .getSaved(session.userId)
      .then((data) => {
        if (!cancelled) setPosts(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, session, router]);

  if (!ready || !session) return null;

  return (
    <div>
      <h1 className="bg-white px-4 py-3 text-sm font-semibold">保存済み</h1>
      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-500">保存した投稿はまだありません</p>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}
