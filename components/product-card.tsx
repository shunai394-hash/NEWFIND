import Link from "next/link";
import type { DiscoveryProduct } from "@/lib/discovery/types";

export function ProductCard({ product }: { product: DiscoveryProduct }) {
  return (
    <Link href={`/products/${product.id}`} className="block overflow-hidden bg-white">
      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
        {product.productImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.productImageUrl}
            alt={`${product.brand} ${product.productName}`}
            className="h-full w-full object-cover"
          />
        ) : null}
        {product.people[0] ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
            {product.people[0].personName} · {product.people[0].relation}
          </span>
        ) : product.trendTags.includes("gen_z_trend") ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold">
            GEN Z
          </span>
        ) : null}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[10px] font-semibold tracking-wide text-neutral-400">{product.brand}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug">{product.productName}</p>
        <p className="mt-1 text-[10px] text-neutral-500">{product.subcategory}</p>
      </div>
    </Link>
  );
}
