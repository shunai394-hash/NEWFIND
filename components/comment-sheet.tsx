"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import type { CommentView } from "@/lib/types";

export function CommentSheet({
  postId,
  userId,
  onClose,
  onAdded,
}: {
  postId: string;
  userId: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const canWrite = Boolean(userId);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStore()
      .listComments(postId)
      .then(setComments)
      .catch(() => setComments([]));
  }, [postId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || !canWrite) return;
    setBusy(true);
    try {
      const created = await getStore().addComment(postId, userId!, body);
      // userId is filled by caller via wrapper — see Feed usage
      setComments((prev) => [...prev, created]);
      setBody("");
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-[430px] flex-col rounded-t-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold">コメント</p>
          <button type="button" onClick={onClose} className="text-sm text-neutral-500">
            閉じる
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">まだコメントはありません</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar profile={comment.author} size={32} />
                <div>
                  <p className="text-sm">
                    <span className="font-semibold">{comment.author.username}</span>{" "}
                    {comment.body}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">{timeAgo(comment.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        {canWrite ? (
          <form onSubmit={submit} className="flex gap-2 border-t border-neutral-200 p-3">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="コメントを追加..."
              className="flex-1 rounded-full bg-neutral-100 px-4 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="text-sm font-semibold text-sky-600 disabled:text-neutral-300"
            >
              投稿
            </button>
          </form>
        ) : (
          <p className="border-t border-neutral-200 p-3 text-center text-sm text-neutral-500">
            コメントするにはログインしてください
          </p>
        )}
      </div>
    </div>
  );
}
