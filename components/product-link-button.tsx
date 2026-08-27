import Link from "next/link";
import { PRODUCT_CTA_DEFAULT } from "@/lib/config";
import { postShopHref } from "@/lib/discovery/shop";
import type { Post } from "@/lib/types";

export function ProductLinkButton({
  post,
  className = "",
}: {
  post: Pick<Post, "productUrl" | "productLabel" | "sourceUrl" | "discoveryProductId">;
  className?: string;
}) {
  const shopHref = postShopHref(post);
  const label = post.productLabel?.trim() || PRODUCT_CTA_DEFAULT;

  if (shopHref) {
    return (
      <a
        href={shopHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center rounded-full bg-[#C6FF00] px-4 py-2 text-sm font-semibold text-black ${className}`}
      >
        {label} →
      </a>
    );
  }

  if (post.discoveryProductId) {
    return (
      <Link
        href={`/products/${post.discoveryProductId}`}
        className={`inline-flex items-center justify-center rounded-full bg-[#C6FF00] px-4 py-2 text-sm font-semibold text-black ${className}`}
      >
        {label} →
      </Link>
    );
  }

  return null;
}
