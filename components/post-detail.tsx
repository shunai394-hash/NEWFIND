"use client";

import { useEffect, useState } from "react";
import { PostCard } from "@/components/post-card";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import type { PostView } from "@/lib/types";

export function PostDetail({ id }: { id: string }) {
  const { session } = useApp();
  const [post, setPost] = useState<PostView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStore()
      .getPost(id, session?.userId ?? null)
      .then(setPost)
      .finally(() => setLoading(false));
  }, [id, session?.userId]);

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (!post) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-500">投稿が見つかりません</p>;
  }
  return <PostCard post={post} onChange={setPost} />;
}
