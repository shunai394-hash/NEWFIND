"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import {
  listCatalogProducts,
  listProductsByCollection,
} from "@/lib/products";
import {
  PRODUCT_COLLECTION_HINTS,
  PRODUCT_COLLECTION_LABELS,
  PRODUCT_COLLECTIONS,
  type ProductCollection,
} from "@/lib/products/types";

export function ProductDiscoverView() {
  const [collection, setCollection] = useState<ProductCollection>("trending");
  const products = useMemo(
    () => listProductsByCollection(collection),
    [collection],
  );
  const total = listCatalogProducts().length;

  return (
    <div>
      <section className="border-b border-neutral-200 bg-white px-4 py-5">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-neutral-400">
          DISCOVER JAPAN
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Discover Japan
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          今、日本で見つかっているもの。
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          商品を見つけて、出典を確認し、購入先へ進む。
        </p>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2.5 [scrollbar-width:none]">
        {PRODUCT_COLLECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCollection(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wide ${
              collection === id
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {PRODUCT_COLLECTION_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 border-b border-neutral-200 bg-white text-sm font-semibold">
        <Link href="/" className="border-b-2 border-neutral-900 py-3 text-center">
          For You
        </Link>
        <Link href="/following" className="py-3 text-center text-neutral-400">
          Following
        </Link>
      </div>

      <p className="bg-white px-4 py-2 text-[11px] text-neutral-400">
        {PRODUCT_COLLECTION_HINTS[collection]} ・ {products.length} / {total} 商品
      </p>

      {products.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">
          このカテゴリの商品はまだありません。出典が確認できたものから追加します。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-neutral-200">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
