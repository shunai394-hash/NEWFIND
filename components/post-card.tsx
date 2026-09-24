"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { PostComments } from "@/components/post-comments";
import { MoreIcon, MuteIcon, VolumeIcon } from "@/components/icons";
import { PostActions } from "@/components/post-actions";
import { ProductLinkButton } from "@/components/product-link-button";
import { ReportSheet } from "@/components/report-sheet";
import { ShareSheet } from "@/components/share-sheet";
import { useApp } from "@/lib/app-context";
import { categoryLabel } from "@/lib/categories";
import { timeAgo } from "@/lib/format";
import {
  celebrityLine,
  inferVisualKind,
  visualKindLabel,
} from "@/lib/japan-context";
import { isAiResidentUsername, isLocallyBlocked } from "@/lib/moderation/client";
import { namedCorrespondentIdentity } from "@/lib/ai/correspondent-identity";
import { CorrespondentByline } from "@/components/correspondent-identity-card";
import {
  hasDisplayablePostMedia,
  isDummyUrl,
} from "@/lib/products/discovery-filter";
import { isVisibleTimelinePost } from "@/lib/posts/text-post";
import { getStore } from "@/lib/store";
import type { PostView } from "@/lib/types";

export function PostCard({
  post: initial,
  onChange,
  onDeleted,
  onUnavailable,
}: {
  post: PostView;
  onChange?: (post: PostView) => void;
  onDeleted?: (postId: string) => void;
  onUnavailable?: (postId: string) => void;
}) {
  const { ready, session, me, blockedIds } = useApp();
  const [post, setPost] = useState(initial);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [hidden, setHidden] = useState(
    isLocallyBlocked(initial.authorId) || blockedIds.includes(initial.authorId),
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const hasMedia = hasDisplayablePostMedia(post);
  const mine = me?.id === post.authorId;

  const notified = useRef(false);

  useEffect(() => {
    setPost(initial);
    setMediaFailed(false);
    setHidden(
      isLocallyBlocked(initial.authorId) || blockedIds.includes(initial.authorId),
    );
    notified.current = false;
  }, [initial, blockedIds]);

  useEffect(() => {
    if (!hasMedia || !mediaFailed || notified.current) return;
    notified.current = true;
    onUnavailable?.(post.id);
  }, [hasMedia, mediaFailed, onUnavailable, post.id]);

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

  async function onShared() {
    await getStore().sharePost(post.id, session?.userId ?? null);
    await refresh();
  }

  const worn = celebrityLine(post);
  const visual = visualKindLabel(inferVisualKind(post));
  const correspondent = namedCorrespondentIdentity(post.author.username, {
    displayName: post.author.displayName,
  });
  const sourceLink =
    post.sourceUrl && !isDummyUrl(post.sourceUrl) ? post.sourceUrl : null;
  const shareUrl =
    typeof window === "undefined"
      ? `/p/${post.id}`
      : `${window.location.origin}/p/${post.id}`;

  if (hidden || !isVisibleTimelinePost(post)) return null;
  if (hasMedia && mediaFailed) return null;

  return (
    <article className="border-b border-neutral-200 bg-white">
      <header className="flex items-start justify-between gap-2 px-3 py-2.5">
        <Link href={`/u/${post.author.username}`} className="flex min-w-0 items-center gap-2">
          <Avatar profile={post.author} size={34} />
          {correspondent ? (
            <CorrespondentByline identity={correspondent} />
          ) : (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{post.author.displayName}</p>
              <p className="truncate text-[11px] text-neutral-400">
                {categoryLabel(post.category)}
                {visual ? ` · ${visual}` : ""}
                {post.isSponsored ? " · 広告" : ""}
                {post.source === "brandbridge" ? " · Official" : ""}
              </p>
            </div>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <p className="whitespace-nowrap px-1 text-[11px] uppercase tracking-wide text-neutral-400">
            {timeAgo(post.createdAt)}
          </p>
          {mine ? null : (
          <button
            type="button"
            aria-label="通報・ブロック"
            onClick={() => {
              if (needLogin()) return;
              setReportOpen(true);
            }}
            className="p-2 text-neutral-500"
          >
            <MoreIcon className="h-5 w-5" />
          </button>
          )}
        </div>
      </header>

      {worn || post.caption ? (
        <div className="space-y-1 px-3 pb-2">
          {worn ? (
            <p className="text-xs font-medium text-neutral-700">
              {worn.label}
              <span className="ml-2 font-normal text-neutral-400">出典: {worn.credit}</span>
            </p>
          ) : null}
          {post.caption ? <p className="text-sm">{post.caption}</p> : null}
        </div>
      ) : null}

      {hasMedia ? (
      <div className="relative bg-neutral-200">
        {post.mediaType === "video" ? (
          <>
            <video
              ref={videoRef}
              src={post.mediaUrl ?? undefined}
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
            src={post.mediaUrl ?? ""}
            alt=""
            className="mx-auto max-h-[520px] w-full object-cover"
            onError={() => setMediaFailed(true)}
          />
        )}
      </div>
      ) : null}

      {post.productUrl || post.discoveryProductId ? (
        <div className="px-3 pb-2 pt-1">
          <ProductLinkButton post={post} className="w-full" />
        </div>
      ) : null}

      {!post.productUrl && !post.discoveryProductId && sourceLink ? (
        <div className="px-3 pb-2 pt-1">
          <a
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-neutral-600 underline"
          >
            情報源を見る
          </a>
        </div>
      ) : null}

      <PostActions
        post={post}
        onLike={onLike}
        onWant={onWant}
        onComment={() =>
          commentsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
        onSave={() => void onSave()}
        onShare={() => setShareOpen(true)}
      />

      <div ref={commentsRef}>
        <PostComments
          postId={post.id}
          userId={session?.userId ?? null}
          onLoginRequired={() => needLogin()}
          onCountChange={(count) => update({ ...post, commentCount: count })}
        />
      </div>

      {shareOpen ? (
        <ShareSheet
          url={shareUrl}
          title={post.caption || "NEWFIND"}
          onClose={() => setShareOpen(false)}
          onShared={() => void onShared()}
        />
      ) : null}
      {reportOpen ? (
        <ReportSheet
          postId={post.id}
          targetUserId={post.authorId || post.author.id}
          targetUsername={post.author.username}
          isAiTarget={isAiResidentUsername(post.author.username)}
          onClose={() => setReportOpen(false)}
          onBlocked={() => {
            setHidden(true);
            onDeleted?.(post.id);
          }}
        />
      ) : null}
    </article>
  );
}

