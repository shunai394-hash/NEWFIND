"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductSaveButton } from "@/components/product-save-button";
import { isUsableProductImage } from "@/lib/discovery/media";
import { productSignals } from "@/lib/discovery/product-signals";
import { discoveryShopUrl } from "@/lib/discovery/shop";
import type { DiscoveryProduct } from "@/lib/discovery/types";

export function ProductCard({
  product,
}: {
  product: DiscoveryProduct;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = isUsableProductImage(product.productImageUrl)
    ? product.productImageUrl
    : null;
  if (!imageUrl || failed) return null;

  const person = product.people[0];
  const signals = productSignals(product);
  const shopUrl = discoveryShopUrl(product);
  const blurb = product.attentionReason || product.description;

  return (
    <article className="relative overflow-hidden bg-white">
      <div className="relative">
        <Link
          href={`/products/${product.id}`}
          className="group block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${product.brand} ${product.productName}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              onError={() => setFailed(true)}
              loading="lazy"
              decoding="async"
            />
            {person ? (
              <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-black/85 px-2.5 py-1 text-[10px] font-semibold text-white">
                {person.personName}
              </span>
            ) : null}
            {signals[0] ? (
              <span className="absolute bottom-2 left-2 rounded-full bg-black/85 px-2.5 py-1 text-[10px] font-semibold text-white">
                {signals[0].label}
              </span>
            ) : null}
          </div>
        </Link>
        <div className="absolute right-2 top-2 z-10">
          <ProductSaveButton productId={product.id} compact />
        </div>
      </div>
      <Link
        href={`/products/${product.id}`}
        className="block px-2.5 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-black"
      >
        <p className="text-[11px] font-semibold tracking-wide text-neutral-500">{product.brand}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-black">
          {product.productName}
        </p>
        {blurb ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-neutral-500">{blurb}</p>
        ) : null}
      </Link>
      {shopUrl ? (
        <div className="px-2.5 pb-3">
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#C6FF00] px-3 py-2 text-[11px] font-semibold text-black"
          >
            商品を見る →
          </a>
        </div>
      ) : null}
    </article>
  );
}
