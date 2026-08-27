import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductShareButton } from "@/components/product-share-button";
import { isUsableProductImage } from "@/lib/discovery/media";
import { discoveryShopUrl } from "@/lib/discovery/shop";
import {
  DISCOVERY_ORIGIN_LABELS,
  PERSON_RELATION_LABELS,
  SOURCE_TYPE_LABELS,
  TREND_TAG_LABELS,
} from "@/lib/discovery/types";
import type { DiscoveryOrigin, DiscoveryProduct } from "@/lib/discovery/types";

export function ProductDetail({
  product,
  related,
  shareUrl,
}: {
  product: DiscoveryProduct;
  related: DiscoveryProduct[];
  shareUrl: string;
}) {
  const imageOk = isUsableProductImage(product.productImageUrl);
  const shopUrl = discoveryShopUrl(product);

  return (
    <article className="bg-white">
      {imageOk ? (
        <div className="relative aspect-[4/5] w-full bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.productImageUrl ?? ""}
            alt={`${product.brand} ${product.productName}`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="space-y-4 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
              {product.brand}
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-tight">{product.productName}</h1>
            <p className="mt-2 text-sm text-neutral-500">
              {product.subcategory}
              {product.country ? ` · ${product.country}` : ""}
            </p>
          </div>
          <ProductShareButton url={shareUrl} title={`${product.brand} ${product.productName}`} />
        </div>
        {product.price != null ? (
          <p className="text-sm font-semibold">
            {product.price} {product.currency}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-neutral-700">{product.description}</p>
        {product.attentionReason ? (
          <p className="text-sm text-neutral-600">{product.attentionReason}</p>
        ) : null}
        <p className="text-[11px] text-neutral-400">
          Trend {product.trendScore} · Confidence {product.confidenceScore}
          {product.discoverySource
            ? ` · ${DISCOVERY_ORIGIN_LABELS[product.discoverySource as DiscoveryOrigin] ?? product.discoverySource}`
            : ""}
          {product.trendTags.length
            ? ` · ${product.trendTags.map((tag) => TREND_TAG_LABELS[tag]).join(" / ")}`
            : ""}
        </p>

        {shopUrl ? (
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full bg-[#C6FF00] px-4 py-3 text-sm font-semibold text-black"
          >
            商品を見る →
          </a>
        ) : null}

        {product.people.length > 0 ? (
          <section className="mt-2 rounded-xl bg-neutral-50 px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">PEOPLE</p>
            {product.people.map((person) => (
              <div key={person.id} className="mt-3">
                <p className="text-sm font-semibold">
                  {person.personName} · {PERSON_RELATION_LABELS[person.relation]}
                </p>
                <p className="text-xs text-neutral-500">{person.personType}</p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="space-y-3">
          {product.sources.map((source) => (
            <div key={source.id} className="rounded-xl border border-neutral-200 px-4 py-4">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">SOURCE</p>
              <p className="mt-1 text-sm font-semibold">{source.sourceTitle}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {SOURCE_TYPE_LABELS[source.sourceType]} · tier {source.sourceTier}
              </p>
              {source.sourceExcerpt ? (
                <p className="mt-2 text-sm text-neutral-600">{source.sourceExcerpt}</p>
              ) : null}
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
            <div key={sale.id} className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-4 text-white">
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
