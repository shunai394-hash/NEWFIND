import Link from "next/link";
import { isUsableProductImage } from "@/lib/discovery/media";
import { ProductCard } from "@/components/product-card";
import { DISCOVERY_ORIGIN_LABELS, PERSON_RELATION_LABELS, SOURCE_TYPE_LABELS, TREND_TAG_LABELS } from "@/lib/discovery/types";
import { listPublicDiscoveryProducts } from "@/lib/discovery/public";
import type { DiscoveryProduct } from "@/lib/discovery/types";

export function ProductDetail({ product }: { product: DiscoveryProduct }) {
  const related = listPublicDiscoveryProducts()
    .filter((item) => item.id !== product.id)
    .filter(
      (item) =>
        item.category === product.category ||
        item.people.some((person) =>
          product.people.some((mine) => mine.personName === person.personName),
        ),
    )
    .slice(0, 6);

  return (
    <article className="bg-white">
      {isUsableProductImage(product.productImageUrl) ? (
        <div className="relative aspect-[4/5] w-full bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.productImageUrl!}
            alt={`${product.brand} ${product.productName}`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="px-4 py-5">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">{product.brand}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight">{product.productName}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {product.subcategory}
          {product.country ? ` · ${product.country}` : ""}
        </p>
        {product.price != null ? (
          <p className="mt-2 text-sm font-semibold">
            {product.price} {product.currency}
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">{product.description}</p>
        <p className="mt-3 text-[11px] text-neutral-400">
          Trend {product.trendScore} · Confidence {product.confidenceScore}
          {product.discoverySource ? ` · ${DISCOVERY_ORIGIN_LABELS[product.discoverySource as keyof typeof DISCOVERY_ORIGIN_LABELS] ?? product.discoverySource}` : ""}
          {product.trendTags.length
            ? ` · ${product.trendTags.map((tag) => TREND_TAG_LABELS[tag]).join(" / ")}`
            : ""}
        </p>

        {product.people.length > 0 ? (
          <section className="mt-6 rounded-2xl bg-neutral-50 px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">PEOPLE</p>
            {product.people.map((person) => (
              <div key={person.id} className="mt-2">
                <p className="text-sm font-semibold">
                  {person.personName} · {PERSON_RELATION_LABELS[person.relation]}
                </p>
                <p className="text-xs text-neutral-500">{person.personType}</p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mt-6 space-y-3">
          {product.sources.map((source) => (
            <div key={source.id} className="rounded-2xl border border-neutral-200 px-4 py-4">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">SOURCE</p>
              <p className="mt-1 text-sm font-semibold">{source.sourceTitle}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {SOURCE_TYPE_LABELS[source.sourceType]} · Tier {source.sourceTier}
              </p>
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
              >
                Open source
              </a>
            </div>
          ))}
          {product.sales.map((sale) => (
            <div key={sale.id} className="rounded-2xl border border-neutral-900 bg-neutral-900 px-4 py-4 text-white">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-300">SHOP</p>
              <p className="mt-1 text-sm font-semibold">{sale.sellerName}</p>
              <p className="mt-1 text-xs text-neutral-400">{sale.sellerKind}</p>
              <a
                href={sale.affiliateUrl || sale.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
              >
                {sale.officialStore ? "Official store" : "Retailer"}
              </a>
            </div>
          ))}
        </section>
      </div>
      {related.length > 0 ? (
        <section className="border-t border-neutral-200 pb-8">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">Related</h2>
            <Link href="/products" className="text-xs text-neutral-400">
              All
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-neutral-200">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
