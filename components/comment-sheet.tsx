"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/avatar";
import { parentAuthorUsername, threadComments } from "@/lib/comments/thread";
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const threads = useMemo(() => threadComments(comments), [comments]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getStore()
      .listComments(postId)
      .then((nextComments) => {
        if (!cancelled) setComments(nextComments);
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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function startReply(comment: CommentView) {
    if (!userId) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setReplyTo(comment);
    setBody(`@${comment.author.username} `);
    setError(null);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        inputRef.current.value.length,
        inputRef.current.value.length,
      );
    }, 0);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !userId || busy) return;

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
      window.setTimeout(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 0);
    } catch (err: unknown) {
      console.error("[CommentSheet] addComment failed", {
        postId,
        userId,
        parentCommentId: replyTo?.id ?? null,
        error: err,
      });
      setError(
        err instanceof Error ? err.message : "コメントを投稿できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 pb-[env(safe-area-inset-bottom,0px)]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[78vh] w-full max-w-[430px] flex-col rounded-t-2xl bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold">コメント</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-2 text-sm text-neutral-500"
          >
            閉じる
          </button>
        </div>

        {error ? (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              まだコメントはありません。発見への感想や質問を書いてみてください。
            </p>
          ) : (
            threads.map((comment) => (
              <CommentThreadItem
                key={comment.id}
                comment={comment}
                comments={comments}
                onReply={startReply}
              />
            ))
          )}
        </div>

        {canWrite ? (
          <form onSubmit={submit} className="border-t border-neutral-200 bg-white">
            {replyTo ? (
              <div className="flex items-center justify-between bg-[#F7FFD6] px-4 py-2 text-xs text-neutral-700">
                <span className="min-w-0 truncate font-medium">
                  @{replyTo.author.username} に返信
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setBody("");
                  }}
                  className="min-h-[32px] shrink-0 font-semibold"
                >
                  キャンセル
                </button>
              </div>
            ) : null}
            <div className="flex items-center gap-2 p-3">
              <input
                ref={inputRef}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={
                  replyTo
                    ? `@${replyTo.author.username} に返信...`
                    : "コメントを追加..."
                }
                className="min-h-[44px] flex-1 rounded-full bg-neutral-100 px-4 py-2 text-sm outline-none"
                disabled={busy}
                enterKeyHint="send"
              />
              <button
                type="submit"
                disabled={busy || !body.trim()}
                className="min-h-[44px] px-2 text-sm font-semibold text-black disabled:text-neutral-300"
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
    </div>,
    document.body,
  );
}

function CommentThreadItem({
  comment,
  comments,
  onReply,
  depth = 0,
}: {
  comment: CommentView & { replies?: CommentView[] };
  comments: CommentView[];
  onReply: (comment: CommentView) => void;
  depth?: number;
}) {
  const parentName = parentAuthorUsername(comments, comment.parentCommentId);
  const replies = comment.replies ?? [];

  return (
    <div className={depth > 0 ? "ml-8 border-l border-neutral-200 pl-3" : ""}>
      <div className="flex gap-3">
        <Link
          href={profilePath(comment.author.username)}
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          <Avatar profile={comment.author} size={32} />
        </Link>
        <div className="min-w-0 flex-1">
          {parentName ? (
            <p className="text-[11px] font-medium text-neutral-500">
              @{parentName} への返信
            </p>
          ) : null}
          <p className="text-sm">
            <Link
              href={profilePath(comment.author.username)}
              className="font-semibold hover:underline"
              onClick={(event) => event.stopPropagation()}
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
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onReply(comment);
              }}
              className="min-h-[44px] touch-manipulation rounded-md border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-800"
            >
              返信
            </button>
          </div>
        </div>
      </div>
      {replies.length > 0 ? (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentThreadItem
              key={reply.id}
              comment={reply}
              comments={comments}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
