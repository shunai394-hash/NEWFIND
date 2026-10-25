import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductHeroImage } from "@/components/product-hero-image";
import { ProductSaveButton } from "@/components/product-save-button";
import { ProductShareButton } from "@/components/product-share-button";
import { ProductViewTracker } from "@/components/product-view-tracker";
import { isUsableProductImage } from "@/lib/discovery/media";
import { discoveryShopUrl } from "@/lib/discovery/shop";
import type { DiscoveryProduct } from "@/lib/discovery/types";

export function ProductDetail({
  product,
  related,
}: {
  product: DiscoveryProduct;
  related: DiscoveryProduct[];
  marketplace?: unknown;
}) {
  const imageOk = isUsableProductImage(product.productImageUrl);
  const shopUrl = discoveryShopUrl(product);
  const officialSale = product.sales.find((item) => item.officialStore) ?? product.sales[0];
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app").replace(/\/$/, "");
  const productPageUrl = new URL(`/products/${encodeURIComponent(product.id)}`, siteUrl).toString();
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: [product.brand, product.productName].filter(Boolean).join(" ").trim(),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(imageOk && product.productImageUrl ? { image: [product.productImageUrl] } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.subcategory ? { category: product.subcategory } : {}),
    url: productPageUrl,
    ...(officialSale?.price != null && officialSale.currency ? {
      offers: {
        "@type": "Offer",
        price: officialSale.price,
        priceCurrency: officialSale.currency,
        url: officialSale.affiliateUrl || officialSale.productUrl,
      },
    } : {}),
  };

  return (
    <article className="min-h-screen bg-[#fffdfa] text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }} />
      <ProductViewTracker productId={product.id} />
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-6 sm:px-8 sm:py-12 lg:grid-cols-2 lg:gap-14">
        <div className="min-w-0">
          {imageOk && product.productImageUrl ? (
            <ProductHeroImage src={product.productImageUrl} alt={`${product.brand} ${product.productName}`} />
          ) : <div className="aspect-[4/5] bg-neutral-100" />}
          <div className="mt-3 flex gap-2">
            <ProductSaveButton productId={product.id} />
            <ProductShareButton url={`/products/${product.id}`} title={`${product.brand} ${product.productName}`} />
          </div>
        </div>
        <div className="min-w-0 lg:py-4">
          <nav aria-label="パンくずリスト" className="text-xs text-neutral-500"><Link href="/">ホーム</Link><span className="mx-2">/</span><Link href="/products">商品一覧</Link><span className="mx-2">/</span><span>{product.subcategory || product.category}</span></nav>
          <p className="mt-7 text-xs font-semibold tracking-[0.16em] text-[#a6533a]">{product.brand}</p>
          <h1 className="mt-2 text-2xl font-semibold leading-snug tracking-tight sm:text-4xl">{product.productName}</h1>
          {product.commercial?.sellingPriceJPY != null ? <><p className="mt-5 text-xs text-neutral-500">NEWFIND販売価格</p><p className="text-2xl font-semibold">{product.commercial.sellingPriceJPY.toLocaleString("ja-JP")} <span className="text-sm font-medium">円（税込想定）</span></p></> : product.price != null ? <><p className="mt-5 text-xs text-neutral-500">販売先の参考価格（NEWFINDの販売価格ではありません）</p><p className="text-2xl font-semibold">{product.price.toLocaleString("ja-JP")} <span className="text-sm font-medium">{product.currency}</span></p></> : <p className="mt-5 text-sm text-neutral-500">価格は販売先でご確認ください。</p>}
          <p className="mt-5 text-sm leading-8 text-neutral-700">{product.description || "商品の詳細情報は販売先のページでご確認ください。"}</p>
          <div className="mt-7 space-y-3 border-y border-neutral-200 py-5 text-sm">
            <div className="flex justify-between gap-4"><span className="text-neutral-500">カテゴリー</span><span>{product.subcategory || product.category}</span></div>
            {product.country ? <div className="flex justify-between gap-4"><span className="text-neutral-500">ブランド地域</span><span>{product.country}</span></div> : null}
            <div className="flex justify-between gap-4"><span className="text-neutral-500">販売状況</span><span>{officialSale?.availability === "in_stock" ? "販売先で在庫あり表示" : "販売先で最新状況をご確認ください"}</span></div>
          </div>
          {shopUrl ? <a href={shopUrl} target="_blank" rel="noopener noreferrer" className="mt-7 flex min-h-14 w-full items-center justify-center rounded-full bg-[#20201e] px-6 text-sm font-semibold text-white transition hover:bg-[#a6533a]">販売ページで購入する <span className="ml-3">↗</span></a> : <p className="mt-7 rounded-xl bg-neutral-100 p-4 text-sm text-neutral-600">現在、確認できる販売ページはありません。</p>}
          {product.sales.length > 0 ? <section className="mt-8"><h2 className="text-lg font-semibold">販売先・価格</h2><div className="mt-3 space-y-3">{product.sales.map((sale) => <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-white p-4"><div><p className="font-semibold">{sale.sellerName}</p><p className="mt-1 text-sm text-neutral-500">{sale.price != null ? `${sale.price.toLocaleString("ja-JP")} ${sale.currency ?? ""}` : "価格は販売先でご確認ください"}</p></div><a href={sale.affiliateUrl || sale.productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:border-neutral-900">販売先を見る ↗</a></div>)}</div></section> : null}
          <p className="mt-5 text-xs leading-relaxed text-neutral-500">価格・在庫・送料・返品条件は変更される場合があります。購入前に販売先の最新表示をご確認ください。</p>
        </div>
      </div>
      {related.length > 0 ? <section className="border-t border-neutral-200 bg-[#f5f1eb] px-4 py-10 sm:px-8 sm:py-14"><div className="mx-auto max-w-[1440px]"><div className="flex items-end justify-between"><h2 className="text-xl font-semibold sm:text-2xl">こちらもおすすめ</h2><Link href="/products" className="text-sm underline underline-offset-4">商品一覧へ</Link></div><div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></div></section> : null}
    </article>
  );
}
