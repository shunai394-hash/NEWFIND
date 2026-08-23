"use client";

import { useEffect, useState } from "react";
import type { Post } from "@/lib/types";

export function MediaThumb({
  post,
}: {
  post: Pick<Post, "mediaType" | "mediaUrl" | "thumbnailUrl">;
}) {
  const [failed, setFailed] = useState(false);
  const src = (post.thumbnailUrl || post.mediaUrl || "").trim();

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (post.mediaType === "video" && !post.thumbnailUrl) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-neutral-800 text-xs font-bold text-white">
        ▶
      </span>
    );
  }

  if (!src || failed) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-neutral-200 text-[11px] font-medium text-neutral-500">
        {post.mediaType === "video" ? "VIDEO" : "NO IMAGE"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full bg-neutral-200 object-cover"
      onError={() => setFailed(true)}
    />
  );
}
