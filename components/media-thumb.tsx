import type { Post } from "@/lib/types";

export function MediaThumb({
  post,
}: {
  post: Pick<Post, "mediaType" | "mediaUrl" | "thumbnailUrl">;
}) {
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
      src={post.thumbnailUrl || post.mediaUrl}
      alt=""
      className="h-full w-full object-cover"
    />
  );
}
