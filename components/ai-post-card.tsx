"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ProductLinkButton } from "@/components/product-link-button";
import { categoryLabel } from "@/lib/categories";
import { timeAgo } from "@/lib/format";
import type { AIPostView } from "@/lib/types";

export function AIPostCard({ post }: { post: AIPostView }) {
  return (
    <article className="border-b border-neutral-200 bg-white">
      <header className="flex items-center justify-between px-3 py-2.5">
        <Link
          href={`/u/${post.author.username}`}
          className="flex min-w-0 items-center gap-2"
        >
          <Avatar profile={post.author} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {post.personaName}
            </p>
            <p className="truncate text-[11px] text-neutral-400">
              {categoryLabel(post.category)} · AI
            </p>
          </div>
        </Link>

        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-500">
          AI
        </span>
      </header>

      <div className="relative bg-neutral-200">
        {post.mediaType === "video" ? (
          <video
            src={post.mediaUrl}
            poster={post.thumbnailUrl ?? undefined}
            muted
            loop
            playsInline
            controls
            className="mx-auto max-h-[520px] w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaUrl}
            alt=""
            className="mx-auto max-h-[520px] w-full object-cover"
          />
        )}
      </div>

      {post.productUrl ? (
        <div className="px-3 pt-2">
          <a
            href={post.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full bg-[#C6FF00] px-4 py-2 text-sm font-semibold text-black"
          >
            {post.productLabel?.trim() || "商品を見る"} →
          </a>
        </div>
      ) : null}

      <div className="space-y-2 px-3 pb-3 pt-2">
        {post.caption ? (
          <p className="text-sm">
            <Link
              href={`/u/${post.author.username}`}
              className="font-semibold"
            >
              {post.personaName}
            </Link>{" "}
            {post.caption}
          </p>
        ) : null}

        <p className="text-[11px] uppercase tracking-wide text-neutral-400">
          {timeAgo(post.createdAt)}
        </p>
      </div>
    </article>
  );
}
