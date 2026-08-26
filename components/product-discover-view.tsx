"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { listDiscoveryProducts } from "@/lib/discovery/store";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CATEGORY_LABELS,
  type DiscoveryCategory,
} from "@/lib/discovery/types";

const FILTERS: Array<DiscoveryCategory | "trending"> = ["trending", ...DISCOVERY_CATEGORIES];

export function ProductDiscoverView() {
  const [collection, setCollection] = useState<DiscoveryCategory | "trending">("trending");
  const all = useMemo(() => listDiscoveryProducts({ admin: false, status: "approved" }), []);
  const products = useMemo(() => {
    if (collection === "trending") {
      return all.filter(
        (item) => item.trendTags.includes("trending") || item.trendTags.includes("world_trend"),
      );
    }
    return all.filter((item) => item.category === collection);
  }, [all, collection]);

  return (
    <div>
      <section className="border-b border-neutral-200 bg-white px-4 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Discover</h1>
      </section>
      <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2.5 [scrollbar-width:none]">
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCollection(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wide ${
              collection === id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {id === "trending" ? "TRENDING" : DISCOVERY_CATEGORY_LABELS[id]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 border-b border-neutral-200 bg-white text-sm font-semibold">
        <Link href="/" className="py-3 text-center text-neutral-400">
          For You
        </Link>
        <Link href="/products" className="border-b-2 border-neutral-900 py-3 text-center">
          Products
        </Link>
      </div>
      <p className="bg-white px-4 py-2 text-[11px] text-neutral-400">
        {products.length} products
      </p>
      {products.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">No products in this filter yet.</p>
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
