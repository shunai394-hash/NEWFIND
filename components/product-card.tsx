"use client";

import Link from "next/link";
import { useState } from "react";
import { isUsableProductImage } from "@/lib/discovery/media";
import { discoveryShopUrl, ownedStorePrice } from "@/lib/discovery/shop";
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

export function ProductCard({ product }: { product: DiscoveryProduct }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = isUsableProductImage(product.productImageUrl) ? product.productImageUrl : null;
  if (!imageUrl || failed) return null;

  const shopUrl = discoveryShopUrl(product);
  const retailPrice = ownedStorePrice(product);
  const price = retailPrice
    ? new Intl.NumberFormat("ja-JP", { style: "currency", currency: retailPrice.currency, maximumFractionDigits: 0 }).format(retailPrice.price)
    : null;

  return (
    <article className="group min-w-0 overflow-hidden bg-white">
      <Link href={`/products/${product.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
        <div className="aspect-[4/5] overflow-hidden bg-[#f0ece6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${product.brand} ${product.productName}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            onError={() => setFailed(true)}
            loading="lazy"
            decoding="async"
          />
        </div>
      </Link>
      <div className="px-2.5 pb-3 pt-3 sm:px-3">
        <p className="text-[10px] font-medium tracking-wide text-neutral-500">{CATEGORY_LABELS[product.category] || product.subcategory || "アイテム"}</p>
        <p className="mt-1 text-[11px] font-semibold text-neutral-500">{product.brand}</p>
        <Link href={`/products/${product.id}`} className="mt-1 block min-h-10 text-[13px] font-semibold leading-snug text-neutral-900 hover:underline underline-offset-2">
          {product.productName}
        </Link>
        <p className="mt-2 min-h-6 text-sm font-semibold text-neutral-900">
          {price || <span className="text-xs font-normal text-neutral-500">販売価格を確認中</span>}
        </p>
        <Link
          href={`/products/${product.id}`}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
        >
          商品詳細を見る <span className="ml-2" aria-hidden="true">→</span>
        </Link>
        {shopUrl ? (
          <a href={shopUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#20201e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#a6533a]">
            販売先で購入する <span className="ml-2" aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
