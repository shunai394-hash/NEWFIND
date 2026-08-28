"use client";

import { compactCount } from "@/lib/format";
import {
  BookmarkIcon,
  CommentIcon,
  HeartIcon,
  ShareIcon,
  WantIcon,
} from "@/components/icons";
import type { PostView } from "@/lib/types";

export function PostActions({
  post,
  onLike,
  onWant,
  onComment,
  onSave,
  onShare,
}: {
  post: PostView;
  onLike: () => void;
  onWant: () => void;
  onComment: () => void;
  onSave: () => void;
  onShare: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-4">
        <ActionButton
          label="いいね"
          count={post.likeCount}
          active={post.liked}
          onClick={onLike}
          showLabel
        >
          <HeartIcon className="h-6 w-6" filled={post.liked} />
        </ActionButton>
        <ActionButton
          label="Want"
          count={post.wantCount}
          active={post.wanted}
          onClick={onWant}
        >
          <WantIcon className="h-6 w-6" filled={post.wanted} />
        </ActionButton>
        <ActionButton label="コメント" count={post.commentCount} onClick={onComment}>
          <CommentIcon className="h-6 w-6" />
        </ActionButton>
        <ActionButton label="シェア" count={post.shareCount} onClick={onShare}>
          <ShareIcon className="h-6 w-6" />
        </ActionButton>
      </div>
      <button
        type="button"
        onClick={onSave}
        aria-label={post.saved ? "保存解除" : "保存"}
        aria-pressed={post.saved}
        className={`flex items-center ${post.saved ? "text-neutral-900" : "text-neutral-800"}`}
      >
        <BookmarkIcon className="h-6 w-6" filled={post.saved} />
      </button>
    </div>
  );
}

function ActionButton({
  children,
  label,
  count,
  active,
  onClick,
  showLabel,
}: {
  children: React.ReactNode;
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex items-center gap-1 text-xs ${active ? "text-neutral-900" : "text-neutral-800"}`}
    >
      {children}
      {showLabel ? <span className="font-medium">{label}</span> : null}
      <span className="min-w-3 font-medium">{compactCount(count)}</span>
    </button>
  );
}
