import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { relatedProducts } from "@/lib/products";
import { SOURCE_KIND_LABELS } from "@/lib/products/types";
import type { CatalogProduct } from "@/lib/products/types";

export function ProductDetail({ product }: { product: CatalogProduct }) {
  const related = relatedProducts(product);

  return (
    <article className="bg-white">
      <div
        className="relative aspect-[4/5] w-full"
        style={{ backgroundColor: product.accent }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={`${product.brand} ${product.name}`}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="px-4 py-5">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
          {product.brand}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight">{product.name}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {product.subcategoryLabel}
          {product.collections.includes("fragrance") ? " ・ FRAGRANCE" : ""}
        </p>
        {product.priceText ? (
          <p className="mt-2 text-sm font-semibold">{product.priceText}</p>
        ) : null}

        <p className="mt-4 text-sm leading-relaxed text-neutral-700">
          {product.description}
        </p>

        {product.scentNotes ? (
          <p className="mt-3 text-sm text-neutral-600">
            香り：{product.scentNotes}
          </p>
        ) : null}

        {product.celebrityName ? (
          <section className="mt-6 rounded-2xl bg-neutral-50 px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
              CELEBRITY
            </p>
            <p className="mt-1 text-base font-semibold">
              {product.celebrityName}さん
              {product.celebrityRelation ? ` ／ ${product.celebrityRelation}` : ""}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              出典が確認できる場合のみ掲載しています。推測やAIによる愛用情報は入れていません。
            </p>
          </section>
        ) : null}

        <section className="mt-6 space-y-3">
          <div className="rounded-2xl border border-neutral-200 px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
              出典
            </p>
            <p className="mt-1 text-sm font-semibold">{product.sourceTitle}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {SOURCE_KIND_LABELS[product.sourceKind]}
            </p>
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
            >
              出典を確認する
            </a>
          </div>

          <div className="rounded-2xl border border-neutral-900 bg-neutral-900 px-4 py-4 text-white">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-300">
              購入先
            </p>
            <p className="mt-1 text-sm font-semibold">{product.seller}</p>
            <a
              href={product.purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
            >
              {product.purchaseLabel || "販売サイトへ"}
            </a>
            <p className="mt-2 text-[11px] text-neutral-400">
              出典ページとは別の、公式または正規販売のURLです。
            </p>
          </div>
        </section>
      </div>

      {related.length > 0 ? (
        <section className="border-t border-neutral-200 pb-8">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">関連商品</h2>
            <Link href="/" className="text-xs text-neutral-400">
              すべて見る
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
