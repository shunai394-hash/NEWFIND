"use client";

import { useState } from "react";
import { hasDisplayablePostMedia } from "@/lib/products/discovery-filter";
import type { Post } from "@/lib/types";

export function MediaThumb({
  post,
}: {
  post: Pick<Post, "mediaType" | "mediaUrl" | "thumbnailUrl">;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = (post.thumbnailUrl || post.mediaUrl || "").trim();
  const failed = failedSrc === src;

  if (!hasDisplayablePostMedia(post) || !src || failed) return null;

  if (post.mediaType === "video" && !post.thumbnailUrl) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-neutral-800 text-xs font-bold text-white">
        ▶
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full bg-neutral-200 object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}
