import Link from "next/link";
import type { CatalogProduct } from "@/lib/products/types";

export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="block overflow-hidden bg-white"
    >
      <div
        className="relative aspect-[4/5] overflow-hidden"
        style={{ backgroundColor: product.accent }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={`${product.brand} ${product.name}`}
          className="h-full w-full object-cover"
        />
        {product.celebrityName ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
            {product.celebrityName} {product.celebrityRelation}
          </span>
        ) : product.collections.includes("teen") ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
            TEEN
          </span>
        ) : null}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[10px] font-semibold tracking-wide text-neutral-400">
          {product.brand}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug">
          {product.name}
        </p>
        <p className="mt-1 text-[10px] text-neutral-500">
          {product.subcategoryLabel}
          {product.priceText ? ` ・ ${product.priceText}` : ""}
        </p>
      </div>
    </Link>
  );
}
