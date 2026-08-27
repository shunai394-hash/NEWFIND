"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { fetchDiscoveryList } from "@/lib/discovery/client-api";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CATEGORY_LABELS,
  type DiscoveryCategory,
  type DiscoveryProduct,
} from "@/lib/discovery/types";

const FILTERS: Array<DiscoveryCategory | "trending"> = ["trending", ...DISCOVERY_CATEGORIES];

export function ProductDiscoverView() {
  const [collection, setCollection] = useState<DiscoveryCategory | "trending">("trending");
  const [all, setAll] = useState<DiscoveryProduct[]>([]);

  useEffect(() => {
    fetchDiscoveryList("approved")
      .then((data) => setAll(data.products))
      .catch(() => setAll([]));
  }, []);

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
      <section className="border-b border-neutral-800 bg-black px-4 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-white">Discovery</h1>
      </section>
      <div className="flex gap-2 overflow-x-auto border-b border-neutral-800 bg-black px-3 py-2.5 [scrollbar-width:none]">
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCollection(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wide ${
              collection === id ? "bg-[#C6FF00] text-black" : "bg-neutral-900 text-neutral-300"
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
        <Link href="/products" className="border-b-2 border-[#C6FF00] py-3 text-center">
          Products
        </Link>
      </div>
      {products.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">
          No products in this filter yet.
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
