"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CommentSheet } from "@/components/comment-sheet";
import { MuteIcon, VolumeIcon } from "@/components/icons";
import { DeletePostButton } from "@/components/delete-post-button";
import { PostActions } from "@/components/post-actions";
import { ProductLinkButton } from "@/components/product-link-button";
import { ShareSheet } from "@/components/share-sheet";
import { ProductImagePlaceholder } from "@/components/product-image-placeholder";
import { useApp } from "@/lib/app-context";
import { categoryLabel } from "@/lib/categories";
import { timeAgo } from "@/lib/format";
import {
  celebrityLine,
  inferVisualKind,
  visualKindLabel,
} from "@/lib/japan-context";
import { isAiPersonDiscoveryMedia } from "@/lib/products/discovery-filter";
import { getStore } from "@/lib/store";
import type { PostView } from "@/lib/types";

export function PostCard({
  post: initial,
  onChange,
  onDeleted,
}: {
  post: PostView;
  onChange?: (post: PostView) => void;
  onDeleted?: (postId: string) => void;
}) {
  const { ready, session, me } = useApp();
  const [post, setPost] = useState(initial);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mediaFailed, setMediaFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setPost(initial);
    setMediaFailed(false);
  }, [initial]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [post.id]);

  function update(next: PostView) {
    setPost(next);
    onChange?.(next);
  }

  function needLogin() {
    if (!ready) return true;
    if (session) return false;
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    return true;
  }

  async function refresh() {
    const latest = await getStore().getPost(post.id, session?.userId ?? null);
    if (latest) update(latest);
  }

  async function onLike() {
    if (needLogin()) return;
    await getStore().toggleLike(post.id, session!.userId);
    await refresh();
  }

  async function onWant() {
    if (needLogin()) return;
    await getStore().toggleWant(post.id, session!.userId);
    await refresh();
  }

  async function onSave() {
    if (needLogin()) return;
    await getStore().toggleSave(post.id, session!.userId);
    await refresh();
  }

  async function onFollow() {
    if (needLogin()) return;
    await getStore().toggleFollow(post.authorId, session!.userId);
    await refresh();
  }

  async function onShared() {
    try {
      await getStore().sharePost(post.id, session?.userId ?? null);
      await refresh();
    } catch {
      // Native/clipboard share already succeeded.
    }
  }

  const shareUrl =
    typeof window === "undefined"
      ? `/p/${post.id}`
      : `${window.location.origin}/p/${post.id}`;
  const worn = celebrityLine(post);
  const visual = visualKindLabel(inferVisualKind(post));
  const hidePersonMedia =
    isAiPersonDiscoveryMedia(post.mediaUrl) ||
    isAiPersonDiscoveryMedia(post.thumbnailUrl);

  return (
    <article className="border-b border-neutral-200 bg-white">
      <header className="flex items-center justify-between px-3 py-2.5">
        <Link href={`/u/${post.author.username}`} className="flex min-w-0 items-center gap-2">
          <Avatar profile={post.author} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{post.author.username}</p>
            <p className="truncate text-[11px] text-neutral-400">
              {categoryLabel(post.category)}
              {visual ? ` · ${visual}` : ""}
              {post.isSponsored ? " · 広告" : ""}
              {post.source === "brandbridge" ? " · Official" : ""}
            </p>
          </div>
        </Link>
        {me?.id === post.authorId ? (
          <DeletePostButton
            postId={post.id}
            userId={me.id}
            onDeleted={onDeleted}
            className="text-xs font-semibold text-red-600"
          />
        ) : me?.id !== post.authorId ? (
          <button
            type="button"
            onClick={onFollow}
            className={`text-xs font-semibold ${
              post.followingAuthor ? "text-neutral-400" : "text-[#C6FF00]"
            }`}
          >
            {post.followingAuthor ? "フォロー中" : "フォロー"}
          </button>
        ) : null}
      </header>

      <div className="relative bg-neutral-200">
        {hidePersonMedia ? (
          <ProductImagePlaceholder label="商品そのものの画像がありません" />
        ) : mediaFailed ? (
          <div className="flex aspect-[4/5] w-full items-center justify-center text-sm text-neutral-500">
            画像を表示できません
          </div>
        ) : post.mediaType === "video" ? (
          <>
            <video
              ref={videoRef}
              src={post.mediaUrl}
              poster={post.thumbnailUrl ?? undefined}
              muted={muted}
              loop
              playsInline
              className="mx-auto max-h-[520px] w-full object-cover"
              onClick={(e) => {
                const video = e.currentTarget;
                if (video.paused) void video.play();
                else video.pause();
              }}
              onError={() => setMediaFailed(true)}
            />
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-2 text-white"
              aria-label={muted ? "unmute" : "mute"}
            >
              {muted ? <MuteIcon className="h-4 w-4" /> : <VolumeIcon className="h-4 w-4" />}
              <span className="text-[11px] font-medium">{muted ? "音声オフ" : "音声オン"}</span>
            </button>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaUrl}
            alt=""
            className="mx-auto max-h-[520px] w-full object-cover"
            onError={() => setMediaFailed(true)}
          />
        )}
      </div>

      <div className="px-3 pt-3">
        <ProductLinkButton post={post} className="w-full" />
      </div>

      <PostActions
        post={post}
        onLike={onLike}
        onWant={onWant}
        onComment={() => setCommentsOpen(true)}
        onSave={onSave}
        onShare={() => setShareOpen(true)}
      />

      <div className="space-y-2 px-3 pb-3">
        {worn ? (
          <p className="text-xs font-medium text-neutral-700">
            {worn.label}
            <span className="ml-2 font-normal text-neutral-400">出典: {worn.credit}</span>
          </p>
        ) : null}
        {post.caption ? (
          <p className="text-sm">
            <Link href={`/u/${post.author.username}`} className="font-semibold">
              {post.author.username}
            </Link>{" "}
            {post.caption}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="text-sm text-neutral-400"
        >
          {`コメント${post.commentCount > 0 ? ` ${post.commentCount}件` : ""}を見る`}
        </button>
        <p className="text-[11px] uppercase tracking-wide text-neutral-400">
          {timeAgo(post.createdAt)}
        </p>
      </div>

      {commentsOpen ? (
        <CommentSheet
          postId={post.id}
          userId={session?.userId ?? null}
          onClose={() => setCommentsOpen(false)}
          onAdded={refresh}
        />
      ) : null}
      {shareOpen ? (
        <ShareSheet
          url={shareUrl}
          title={post.caption?.slice(0, 80) || "NEWFIND"}
          onClose={() => setShareOpen(false)}
          onShared={onShared}
        />
      ) : null}
    </article>
  );
}


