"use client";

import Link from "next/link";
import { useState } from "react";
import { isUsableProductImage } from "@/lib/discovery/media";
import type { DiscoveryProduct } from "@/lib/discovery/types";

export function ProductCard({ product }: { product: DiscoveryProduct }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = isUsableProductImage(product.productImageUrl)
    ? product.productImageUrl
    : null;

  if (!imageUrl || failed) return null;

  const person = product.people[0];
  const trending = product.trendTags.includes("trending") || product.trendTags.includes("viral");

  return (
    <Link href={`/products/${product.id}`} className="block overflow-hidden bg-white">
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
            TRENDING
          </span>
        ) : null}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[11px] font-semibold tracking-wide text-neutral-500">{product.brand}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-black">
          {product.productName}
        </p>
        <p className="mt-1 text-[10px] text-neutral-500">{product.subcategory}</p>
      </div>
    </Link>
  );
}
