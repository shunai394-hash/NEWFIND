"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { parentAuthorUsername, threadComments } from "@/lib/comments/thread";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { profilePath } from "@/lib/username";
import type { CommentView } from "@/lib/types";

/**
 * Inline, always-visible comment thread rendered directly under a post
 * (no modal / sheet / separate screen). Reuses the existing
 * addComment/listComments store methods and parent_comment_id as-is, so
 * AI REPLY actions (which target real, existing comment ids) are unaffected.
 */
export function PostComments({
  postId,
  userId,
  onLoginRequired,
  onCountChange,
}: {
  postId: string;
  userId: string | null;
  onLoginRequired: () => void;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const cancelled = useRef(false);

  const threads = useMemo(() => threadComments(comments), [comments]);

  useEffect(() => {
    cancelled.current = false;
    getStore()
      .listComments(postId)
      .then((next) => {
        if (cancelled.current) return;
        setComments(next);
        setLoaded(true);
        onCountChange?.(next.length);
      })
      .catch((err: unknown) => {
        if (cancelled.current) return;
        console.error("[PostComments] listComments failed", err);
        setLoadError(
          err instanceof Error ? err.message : "コメントを読み込めませんでした。",
        );
        setLoaded(true);
      });
    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function submitComment(
    text: string,
    parentCommentId: string | null,
  ) {
    const trimmed = text.trim();
    if (!trimmed || !userId || busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const created = await getStore().addComment(
        postId,
        userId,
        trimmed,
        parentCommentId,
      );
      setComments((prev) => {
        const next = [...prev, created];
        onCountChange?.(next.length);
        return next;
      });
      if (parentCommentId) {
        setReplyOpenId(null);
      } else {
        setBody("");
      }
    } catch (err: unknown) {
      console.error("[PostComments] addComment failed", {
        postId,
        userId,
        parentCommentId,
        error: err,
      });
      setSubmitError(
        err instanceof Error ? err.message : "コメントを投稿できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }

  function requireLogin() {
    if (!userId) {
      onLoginRequired();
      return true;
    }
    return false;
  }

  return (
    <div className="border-t border-neutral-100 px-3 py-2.5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (requireLogin()) return;
          void submitComment(body, null);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={body}
          onFocus={() => requireLogin()}
          onChange={(event) => setBody(event.target.value)}
          placeholder="コメントを書く…"
          className="min-h-[40px] flex-1 rounded-full bg-neutral-100 px-4 py-2 text-sm outline-none"
          disabled={busy}
          enterKeyHint="send"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="min-h-[40px] px-2 text-sm font-semibold text-black disabled:text-neutral-300"
        >
          送信
        </button>
      </form>
      {submitError ? (
        <p className="mt-1.5 text-xs text-red-600">{submitError}</p>
      ) : null}

      {loadError ? (
        <p className="mt-3 text-xs text-red-600">{loadError}</p>
      ) : !loaded ? (
        <p className="mt-3 text-xs text-neutral-400">コメントを読み込み中…</p>
      ) : threads.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          まだコメントはありません。最初のコメントを書いてみてください。
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {threads.map((comment) => (
            <CommentThreadItem
              key={comment.id}
              comment={comment}
              comments={comments}
              replyOpenId={replyOpenId}
              busy={busy}
              onToggleReply={(id) => {
                if (requireLogin()) return;
                setReplyOpenId((current) => (current === id ? null : id));
              }}
              onSubmitReply={(parentId, text) =>
                submitComment(text, parentId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentThreadItem({
  comment,
  comments,
  replyOpenId,
  busy,
  onToggleReply,
  onSubmitReply,
  depth = 0,
}: {
  comment: CommentView & { replies?: CommentView[] };
  comments: CommentView[];
  replyOpenId: string | null;
  busy: boolean;
  onToggleReply: (commentId: string) => void;
  onSubmitReply: (parentCommentId: string, text: string) => void;
  depth?: number;
}) {
  const parentName = parentAuthorUsername(comments, comment.parentCommentId);
  const replies = comment.replies ?? [];
  const replyOpen = replyOpenId === comment.id;
  const [replyText, setReplyText] = useState("");

  return (
    <div className={depth > 0 ? "ml-8 border-l border-neutral-200 pl-3" : ""}>
      <div className="flex gap-2.5">
        <Link href={profilePath(comment.author.username)} className="shrink-0">
          <Avatar profile={comment.author} size={28} />
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
              onClick={() => onToggleReply(comment.id)}
              className="text-xs font-semibold text-neutral-500"
            >
              返信
            </button>
          </div>

          {replyOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!replyText.trim()) return;
                onSubmitReply(comment.id, replyText);
                setReplyText("");
              }}
              className="mt-2 flex items-center gap-2"
            >
              <input
                autoFocus
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder={`@${comment.author.username} に返信…`}
                className="min-h-[36px] flex-1 rounded-full bg-neutral-100 px-3 py-1.5 text-sm outline-none"
                disabled={busy}
                enterKeyHint="send"
              />
              <button
                type="submit"
                disabled={busy || !replyText.trim()}
                className="min-h-[36px] px-1.5 text-xs font-semibold text-black disabled:text-neutral-300"
              >
                送信
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {replies.length > 0 ? (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentThreadItem
              key={reply.id}
              comment={reply}
              comments={comments}
              replyOpenId={replyOpenId}
              busy={busy}
              onToggleReply={onToggleReply}
              onSubmitReply={onSubmitReply}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
