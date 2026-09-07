"use client";

import { useState } from "react";
import { hasDisplayablePostMedia } from "@/lib/products/discovery-filter";
import type { Post } from "@/lib/types";

export function MediaThumb({
  post,
}: {
  post: Pick<Post, "mediaType" | "mediaUrl" | "thumbnailUrl">;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const mediaUrl = (post.mediaUrl || "").trim();
  const thumbnailUrl = (post.thumbnailUrl || "").trim();

  if (!hasDisplayablePostMedia(post) || !mediaUrl) return null;

  // iOS/WKWebView: use the actual video element for video posts.
  if (post.mediaType === "video") {
    if (mediaFailed) {
      if (thumbnailUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full bg-neutral-200 object-cover"
          />
        );
      }

      return (
        <span className="flex h-full w-full items-center justify-center bg-neutral-800 text-xs font-bold text-white">
          ▶
        </span>
      );
    }

    return (
      <video
        src={mediaUrl}
        poster={thumbnailUrl || undefined}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        className="h-full w-full bg-neutral-200 object-cover"
        aria-label="動画"
        onError={() => setMediaFailed(true)}
      />
    );
  }

  const imageSrc = thumbnailUrl || mediaUrl;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt=""
      className="h-full w-full bg-neutral-200 object-cover"
      onError={() => setMediaFailed(true)}
    />
  );
}