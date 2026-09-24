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

  const mediaSrc = (post.mediaUrl || "").trim();
  const thumbnailSrc = (post.thumbnailUrl || "").trim();

  if (!hasDisplayablePostMedia(post) || (!mediaSrc && !thumbnailSrc)) {
    return null;
  }

  if (post.mediaType === "video") {
    if (thumbnailSrc && failedSrc !== thumbnailSrc) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailSrc}
          alt=""
          className="h-full w-full bg-neutral-200 object-cover"
          onError={() => setFailedSrc(thumbnailSrc)}
        />
      );
    }

    if (!mediaSrc || failedSrc === mediaSrc) return null;

    return (
      <video
        src={mediaSrc}
        className="h-full w-full bg-neutral-200 object-cover"
        muted
        playsInline
        loop
        preload="metadata"
        controls={false}
        onError={() => setFailedSrc(mediaSrc)}
      />
    );
  }

  const src = thumbnailSrc || mediaSrc;
  if (!src || failedSrc === src) return null;

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
