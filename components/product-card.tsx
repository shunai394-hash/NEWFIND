"use client";

import Link from "next/link";
import { useState } from "react";
import { isUsableProductImage } from "@/lib/discovery/media";
import { discoveryShopUrl } from "@/lib/discovery/shop";
import type { DiscoveryProduct } from "@/lib/discovery/types";

const CATEGORY_LABELS: Record<string, string> = {
  fashion: "ファッション",
  beauty: "コスメ・美容",
  accessories: "バッグ・アクセサリー",
  lifestyle: "ライフスタイル",
  home: "ホーム・インテリア",
  tech: "ガジェット",
  food: "フード",
  travel: "トラベル",
};

const NEW_BADGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// Evaluated once at module load so card rendering stays pure; the NEW badge
// only needs day-level freshness.
const MODULE_NOW = Date.now();

function formatJPY(value: number, currency = "JPY"): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProductCard({
  product,
  rank,
}: {
  product: DiscoveryProduct;
  rank?: number;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = isUsableProductImage(product.productImageUrl) ? product.productImageUrl : null;
  if (!imageUrl || failed) return null;

  const shopUrl = discoveryShopUrl(product);
  const sellingPrice = product.commercial?.sellingPriceJPY;
  const hasSellingPrice = sellingPrice != null && Number.isFinite(sellingPrice) && sellingPrice > 0;
  const referencePrice =
    product.price != null && Number.isFinite(product.price) && product.price > 0 ? product.price : null;
  const price = hasSellingPrice
    ? formatJPY(sellingPrice ?? 0)
    : referencePrice != null
      ? formatJPY(referencePrice, product.currency || "JPY")
      : null;
  const discountPercent =
    hasSellingPrice && sellingPrice != null && referencePrice != null && referencePrice > sellingPrice
      ? Math.round((1 - sellingPrice / referencePrice) * 100)
      : null;

  const listedAt = Date.parse(product.discoveredAt ?? product.createdAt ?? "");
  const isNew = Number.isFinite(listedAt) && MODULE_NOW - listedAt < NEW_BADGE_WINDOW_MS;
  const badges: { label: string; className: string }[] = [];
  if (product.trendTags?.includes("best_seller")) {
    badges.push({ label: "人気", className: "bg-[#20201e] text-white" });
  }
  if (product.trendTags?.includes("editorial_pick")) {
    badges.push({ label: "PICK UP", className: "bg-white/95 text-[#20201e]" });
  }
  if (isNew) {
    badges.push({ label: "NEW", className: "bg-[#a6533a] text-white" });
  }
  if (discountPercent != null && discountPercent >= 5) {
    badges.push({ label: `${discountPercent}% OFF`, className: "bg-[#b3352b] text-white" });
  }

  return (
    <article className="group relative min-w-0 overflow-hidden bg-white ring-1 ring-neutral-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-20px_rgba(32,32,30,0.38)] hover:ring-neutral-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Link
        href={`/products/${product.id}`}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-[#f0ece6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${product.brand} ${product.productName}`}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
            onError={() => setFailed(true)}
            loading="lazy"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-[#20201e]/90 py-2.5 text-center text-[11px] font-semibold tracking-[0.14em] text-white opacity-0 backdrop-blur-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none">
            商品詳細を見る →
          </div>
          {rank != null ? (
            <span className="font-display absolute left-0 top-0 bg-[#20201e] px-2.5 py-1 text-base font-bold leading-none text-white">
              {rank}
            </span>
          ) : null}
          {badges.length ? (
            <div className={`absolute ${rank != null ? "top-9" : "top-2"} left-2 flex flex-col items-start gap-1`}>
              {badges.slice(0, 3).map((badge) => (
                <span
                  key={badge.label}
                  className={`px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] shadow-sm ${badge.className}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
      <div className="px-2.5 pb-3 pt-3 sm:px-3">
        <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-neutral-500">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[#a6533a]" />
          {CATEGORY_LABELS[product.category] || product.subcategory || "アイテム"}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{product.brand}</p>
        <Link
          href={`/products/${product.id}`}
          className="mt-1 block min-h-10 text-[13px] font-semibold leading-snug text-neutral-900 underline-offset-2 hover:underline"
        >
          {product.productName}
        </Link>
        <p className="mt-2 flex min-h-6 flex-wrap items-baseline gap-x-2">
          {price ? (
            <>
              <span className="text-base font-bold tracking-tight text-neutral-900">{price}</span>
              {discountPercent != null && referencePrice != null ? (
                <span className="text-[11px] font-medium text-neutral-400 line-through">
                  {formatJPY(referencePrice, product.currency || "JPY")}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-xs font-normal text-neutral-500">価格は販売先でご確認ください</span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-neutral-500">{hasSellingPrice ? "NEWFIND販売価格" : "販売先の参考価格"}</p>
        <Link
          href={`/products/${product.id}`}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
        >
          商品詳細を見る <span className="ml-2" aria-hidden="true">→</span>
        </Link>
        {shopUrl ? (
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#20201e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#a6533a]"
          >
            販売先で購入する <span className="ml-2" aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
