import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductImagePlaceholder } from "@/components/product-image-placeholder";
import { ProductSaveButton } from "@/components/product-save-button";
import { ProductShareButton } from "@/components/product-share-button";
import { evidenceGroupForSource, evidenceSources, whyIsThisHere } from "@/lib/discovery/evidence";
import { isUsableProductImage } from "@/lib/discovery/media";
import { productSignals } from "@/lib/discovery/product-signals";
import { discoveryShopUrl } from "@/lib/discovery/shop";
import {
  DISCOVERY_ORIGIN_LABELS,
  EVIDENCE_GROUP_LABELS,
  PERSON_RELATION_LABELS,
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
  const why = whyIsThisHere(product);
  const sources = evidenceSources(product.sources);
  const signals = productSignals(product);
  const officialSale = product.sales.find((item) => item.officialStore) ?? product.sales[0];

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
      ) : (
        <ProductImagePlaceholder />
      )}
      <div className="space-y-5 px-4 py-5">
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

        <div className="flex flex-wrap items-center gap-2">
          <ProductSaveButton productId={product.id} />
        </div>

        {product.price != null ? (
          <p className="text-sm font-semibold">
            {product.price.toLocaleString()} {product.currency}
          </p>
        ) : null}

        <section className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
            TREND SCORE
          </p>
          <p className="text-sm font-semibold">{product.trendScore}</p>
          {signals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {signals.map((signal) => (
                <span
                  key={signal.key}
                  className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold"
                >
                  {signal.label}
                </span>
              ))}
            </div>
          ) : null}
          {product.trendTags.length > 0 ? (
            <p className="text-[11px] text-neutral-400">
              {product.trendTags.map((tag) => TREND_TAG_LABELS[tag]).join(" / ")}
            </p>
          ) : null}
        </section>

        {product.description ? (
          <p className="text-sm leading-relaxed text-neutral-700">{product.description}</p>
        ) : null}

        {why ? (
          <section className="rounded-xl bg-neutral-50 px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
              WHY IS THIS HERE?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700">{why}</p>
          </section>
        ) : null}

        {product.people.length > 0 ? (
          <section className="rounded-xl border border-neutral-200 px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
              CELEBRITY ASSOCIATION
            </p>
            {product.people.map((person) => {
              const source = sources.find((item) => item.id === person.sourceId);
              return (
                <div key={person.id} className="mt-3">
                  <p className="text-sm font-semibold">{person.personName}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    この商品／ブランドとの関連が確認された
                    {person.relation !== "unknown"
                      ? ` · ${PERSON_RELATION_LABELS[person.relation]}`
                      : ""}
                  </p>
                  {source ? (
                    <a
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex text-xs font-semibold text-neutral-700 underline"
                    >
                      Evidence: {source.sourceTitle || source.sourceUrl}
                    </a>
                  ) : person.personUrl ? (
                    <a
                      href={person.personUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex text-xs font-semibold text-neutral-700 underline"
                    >
                      Source
                    </a>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}

        {sources.length > 0 ? (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
              EVIDENCE
            </p>
            {sources.map((source) => (
              <div key={source.id} className="rounded-xl border border-neutral-200 px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
                  {EVIDENCE_GROUP_LABELS[evidenceGroupForSource(source.sourceType)]}
                </p>
                <p className="mt-1 text-sm font-semibold">{source.sourceTitle}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {source.sourceDomain || "source"}
                  {source.publishedAt ? ` · ${source.publishedAt}` : ""}
                </p>
                {source.sourceExcerpt ? (
                  <p className="mt-2 text-sm text-neutral-600">{source.sourceExcerpt}</p>
                ) : null}
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
                >
                  Open source
                </a>
              </div>
            ))}
          </section>
        ) : null}

        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
            WHERE TO BUY
          </p>
          {shopUrl ? (
            <a
              href={shopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#C6FF00] px-4 py-3 text-sm font-semibold text-black"
            >
              公式商品ページ →
            </a>
          ) : null}
          {product.sales.map((sale) => (
            <div key={sale.id} className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-4 text-white">
              <p className="text-sm font-semibold">{sale.sellerName}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {sale.officialStore ? "Official store" : sale.sellerKind}
                {sale.price != null ? ` · ${sale.price.toLocaleString()} ${sale.currency ?? ""}` : ""}
              </p>
              <a
                href={sale.affiliateUrl || sale.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
              >
                {sale.officialStore ? "Official store" : "Retailer"}
              </a>
            </div>
          ))}
          {!shopUrl && !officialSale ? (
            <p className="text-sm text-neutral-500">販売ページはまだ確認できていません。</p>
          ) : null}
        </section>

        <p className="text-[11px] text-neutral-400">
          Confidence {product.confidenceScore}
          {product.discoverySource
            ? ` · ${DISCOVERY_ORIGIN_LABELS[product.discoverySource as DiscoveryOrigin] ?? product.discoverySource}`
            : ""}
        </p>
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
