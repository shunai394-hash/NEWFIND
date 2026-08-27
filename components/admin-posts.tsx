"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { authHeaders } from "@/lib/auth/client-headers";

type AdminPost = {
  id: string;
  media_url: string;
  caption: string;
  category: string;
  created_at: string;
  author: { username: string; display_name: string } | null;
};

export function AdminPosts() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const response = await fetch("/api/admin/posts", {
      headers: await authHeaders(),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "読み込みに失敗しました");
      setPosts([]);
      return;
    }
    setError("");
    setPosts(body.posts ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function removePost(id: string) {
    if (!window.confirm("この投稿と画像を削除しますか？")) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "削除に失敗しました");
      if (body.warning) window.alert(body.warning);
      setPosts((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <AdminNav current="posts" />
      <div className="px-4 py-4">
        <h1 className="text-lg font-semibold">投稿 / 画像管理</h1>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead>
              <tr className="border-b text-neutral-400">
                <th className="py-2 pr-3">画像</th>
                <th className="py-2 pr-3">投稿</th>
                <th className="py-2 pr-3">ユーザー</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.media_url} alt="" className="h-12 w-12 rounded object-cover" />
                  </td>
                  <td className="py-2 pr-3">
                    <p className="line-clamp-2 font-semibold">{post.caption || "(no caption)"}</p>
                    <p className="text-neutral-400">{post.category}</p>
                  </td>
                  <td className="py-2 pr-3">{post.author?.username ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      disabled={busyId === post.id}
                      className="text-red-600 underline"
                      onClick={() => void removePost(post.id)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
