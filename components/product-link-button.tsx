import Link from "next/link";
import { PRODUCT_CTA_DEFAULT } from "@/lib/config";
import { productHref } from "@/lib/format";
import type { Post } from "@/lib/types";

export function ProductLinkButton({
  post,
  className = "",
}: {
  post: Pick<Post, "productUrl" | "productLabel" | "sourceUrl" | "discoveryProductId">;
  className?: string;
}) {
  if (post.discoveryProductId) {
    return (
      <Link
        href={`/products/${post.discoveryProductId}`}
        className={`inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white ${className}`}
      >
        {post.productLabel?.trim() || PRODUCT_CTA_DEFAULT}
      </Link>
    );
  }

  const href = productHref(post);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white ${className}`}
    >
      {post.productLabel?.trim() || PRODUCT_CTA_DEFAULT}
    </a>
  );
}
