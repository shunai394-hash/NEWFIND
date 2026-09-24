"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { ImageIcon } from "@/components/icons";
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
 * Comments/replies may carry an optional image (media_url/media_type),
 * uploaded via the same store.uploadMedia() posts already use.
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
    file: File | null,
    parentCommentId: string | null,
  ) {
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    if (!userId || busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      let media: { url: string; type: "photo" } | null = null;
      if (file) {
        const uploaded = await getStore().uploadMedia(file);
        media = { url: uploaded.url, type: "photo" };
      }
      const created = await getStore().addComment(
        postId,
        userId,
        trimmed,
        parentCommentId,
        media,
      );
      const next = [...comments, created];
      setComments(next);
      onCountChange?.(next.length);
      if (parentCommentId) {
        setReplyOpenId(null);
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
      throw err;
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
      <CommentComposer
        placeholder="コメントを書く…"
        submitLabel="送信"
        busy={busy}
        onFocus={() => requireLogin()}
        onSubmit={(text, file) => {
          if (requireLogin()) return;
          return submitComment(text, file, null);
        }}
      />
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
              onSubmitReply={(parentId, text, file) =>
                submitComment(text, file, parentId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared compose UI for both the top-level comment box and each inline
 * reply box: [image button] [text input] [submit], with an image preview
 * above the input row once a file is picked. Text and background colors
 * are explicit (the app shell's body sets a white foreground for its dark
 * theme, which otherwise leaves inputs on a light bubble unreadable).
 */
function CommentComposer({
  placeholder,
  submitLabel,
  busy,
  autoFocus,
  onFocus,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  autoFocus?: boolean;
  onFocus?: () => void;
  onSubmit: (text: string, file: File | null) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!text.trim() && !file) return;
    try {
      await onSubmit(text, file);
    } catch {
      // Parent already surfaces the error; keep the draft so it isn't lost.
      return;
    }
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {previewUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="h-20 w-20 rounded-lg border border-neutral-200 object-cover"
          />
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="画像を削除"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null;
            if (picked) setFile(picked);
          }}
        />
        <button
          type="button"
          aria-label="画像を追加"
          onClick={() => {
            onFocus?.();
            fileInputRef.current?.click();
          }}
          disabled={busy}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 disabled:text-neutral-300"
        >
          <ImageIcon className="h-5 w-5" />
        </button>
        <input
          value={text}
          onFocus={() => onFocus?.()}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={busy}
          enterKeyHint="send"
          className="min-h-[40px] flex-1 rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-900 caret-neutral-900 outline-none placeholder:text-neutral-500"
        />
        <button
          type="submit"
          disabled={busy || (!text.trim() && !file)}
          className="min-h-[40px] shrink-0 px-2 text-sm font-semibold text-black disabled:text-neutral-300"
        >
          {submitLabel}
        </button>
      </div>
    </form>
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
  onSubmitReply: (
    parentCommentId: string,
    text: string,
    file: File | null,
  ) => void | Promise<void>;
  depth?: number;
}) {
  const parentName = parentAuthorUsername(comments, comment.parentCommentId);
  const replies = comment.replies ?? [];
  const replyOpen = replyOpenId === comment.id;

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
          {comment.body ? (
            <p className="text-sm">
              <Link
                href={profilePath(comment.author.username)}
                className="font-semibold hover:underline"
              >
                {comment.author.username}
              </Link>{" "}
              {comment.body}
            </p>
          ) : (
            <Link
              href={profilePath(comment.author.username)}
              className="text-sm font-semibold hover:underline"
            >
              {comment.author.username}
            </Link>
          )}
          {comment.mediaUrl ? (
            <a
              href={comment.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={comment.mediaUrl}
                alt=""
                className="h-40 w-40 max-w-full rounded-lg border border-neutral-200 object-cover"
              />
            </a>
          ) : null}
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
            <div className="mt-2">
              <CommentComposer
                placeholder={`@${comment.author.username} に返信…`}
                submitLabel="返信"
                busy={busy}
                autoFocus
                onSubmit={(text, file) =>
                  onSubmitReply(comment.id, text, file)
                }
              />
            </div>
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
