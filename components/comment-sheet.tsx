"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { profilePath } from "@/lib/username";
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
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;

    setError(null);

    getStore()
      .listComments(postId)
      .then((nextComments) => {
        if (!cancelled) {
          setComments(nextComments);
        }
      })
      .catch((err: unknown) => {
        console.error("[CommentSheet] listComments failed", err);

        if (!cancelled) {
          setComments([]);
          setError(
            err instanceof Error
              ? err.message
              : "コメントを読み込めませんでした。",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = body.trim();

    if (!trimmed || !userId || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await getStore().addComment(
        postId,
        userId,
        trimmed,
        replyTo?.id ?? null,
      );

      setComments((prev) => [...prev, created]);
      setBody("");
      setReplyTo(null);
      onAdded();
    } catch (err: unknown) {
      console.error("[CommentSheet] addComment failed", {
        postId,
        userId,
        parentCommentId: replyTo?.id ?? null,
        error: err,
      });

      setError(
        err instanceof Error
          ? err.message
          : "コメントを投稿できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-[430px] flex-col rounded-t-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold">コメント</p>

          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500"
          >
            閉じる
          </button>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              まだコメントはありません
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className={`flex gap-3 ${
                  comment.parentCommentId ? "ml-8" : ""
                }`}
              >
                <Link
                  href={profilePath(comment.author.username)}
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar profile={comment.author} size={32} />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link
                      href={profilePath(comment.author.username)}
                      className="font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {comment.author.username}
                    </Link>{" "}
                    {comment.body}
                  </p>

                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs text-neutral-400">
                      {timeAgo(comment.createdAt)}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (!userId) {
                          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
                          return;
                        }

                        setReplyTo(comment);
                        setBody("");
                        setError(null);
                      }}
                      className="text-xs font-semibold text-neutral-500"
                    >
                      返信
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {canWrite ? (
          <form onSubmit={submit} className="border-t border-neutral-200">
            {replyTo && (
              <div className="flex items-center justify-between bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
                <span>@{replyTo.author.username} に返信</span>

                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="font-semibold"
                >
                  キャンセル
                </button>
              </div>
            )}

            <div className="flex gap-2 p-3">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  replyTo
                    ? `@${replyTo.author.username} に返信...`
                    : "コメントを追加..."
                }
                className="flex-1 rounded-full bg-neutral-100 px-4 py-2 text-sm outline-none"
                disabled={busy}
              />

              <button
                type="submit"
                disabled={busy || !body.trim()}
                className="text-sm font-semibold text-black disabled:text-neutral-300"
              >
                {busy ? "送信中..." : "送信"}
              </button>
            </div>
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






