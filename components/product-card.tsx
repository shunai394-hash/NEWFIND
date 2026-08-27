"use client";

import Link from "next/link";
import { useState } from "react";
import { isUsableProductImage } from "@/lib/discovery/media";
import { discoveryShopUrl } from "@/lib/discovery/shop";
import type { DiscoveryProduct } from "@/lib/discovery/types";

export function ProductCard({ product }: { product: DiscoveryProduct }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = isUsableProductImage(product.productImageUrl)
    ? product.productImageUrl
    : null;

  if (!imageUrl || failed) return null;

  const person = product.people[0];
  const trending =
    product.trendTags.includes("trending") || product.trendTags.includes("viral");
  const shopUrl = discoveryShopUrl(product);
  const blurb = product.attentionReason || product.description;

  return (
    <article className="overflow-hidden bg-white">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${product.brand} ${product.productName}`}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
          {person ? (
            <span className="absolute left-2 top-2 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white">
              {person.personName} · {person.relation}
            </span>
          ) : null}
          {trending ? (
            <span className="absolute right-2 top-2 rounded-full bg-[#C6FF00] px-2 py-0.5 text-[10px] font-semibold text-black">
              TREND
            </span>
          ) : null}
        </div>
        <div className="px-2.5 py-2">
          <p className="text-[11px] font-semibold tracking-wide text-neutral-500">{product.brand}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-black">
            {product.productName}
          </p>
          {blurb ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-neutral-500">{blurb}</p>
          ) : null}
          {product.trendTags.length > 0 ? (
            <p className="mt-1 truncate text-[10px] text-neutral-400">
              {product.trendTags.slice(0, 3).join(" / ")}
            </p>
          ) : null}
        </div>
      </Link>
      {shopUrl ? (
        <div className="px-2.5 pb-3">
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full bg-[#C6FF00] px-3 py-2 text-[11px] font-semibold text-black"
          >
            商品を見る →
          </a>
        </div>
      ) : null}
    </article>
  );
}
