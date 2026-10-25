import type { DiscoveryProduct } from "@/lib/discovery/types";

const ULTIMUNE_VARIANTS = [
  { label: "30mL", price: 9900, size: "30mL" },
  { label: "50mL", price: 15180, size: "50mL" },
  { label: "50mL（レフィル）", price: 14630, size: "50mL（レフィル）" },
  { label: "75mL", price: 19800, size: "75mL" },
  { label: "75mL（レフィル）", price: 18150, size: "75mL（レフィル）" },
] as const;

const OFFICIAL_PRODUCT_URL =
  "https://brand.shiseido.co.jp/ultimune-powerizing-serum-4514254206409.html";

function isUltimune(product: DiscoveryProduct) {
  const searchable = [
    product.brand,
    product.productName,
    product.sku,
    product.gtin,
    product.modelNumber,
    product.canonicalUrl,
    product.officialUrl,
  ].filter(Boolean).join(" ").toLowerCase();
  return /4514254206409|アルティミューン|ultimune|powerizing-serum/.test(searchable);
}

function officialVariantUrl(size: string) {
  const url = new URL(
    "/on/demandware.store/Sites-shiseido_global_jp-Site/ja_JP/Product-Variation",
    "https://brand.shiseido.co.jp",
  );
  url.searchParams.set("pid", "H613");
  url.searchParams.set("dwvar_H613_size", size);
  return url.toString();
}

export function ShiseidoVariantReference({ product }: { product: DiscoveryProduct }) {
  if (!/shiseido|資生堂/i.test(product.brand) && !/4514254206409|アルティミューン|ultimune/i.test(
    [product.productName, product.sku, product.gtin, product.canonicalUrl, product.officialUrl].filter(Boolean).join(" "),
  )) return null;

  if (isUltimune(product)) {
    return (
      <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5" aria-labelledby="shiseido-official-prices">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-neutral-500">SHISEIDO 公式サイト掲載価格</p>
            <h2 id="shiseido-official-prices" className="mt-1 text-base font-semibold">アルティミューン™ パワライジング セラム</h2>
          </div>
          <a href={OFFICIAL_PRODUCT_URL} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline underline-offset-4">公式商品ページ ↗</a>
        </div>
        <ul className="mt-4 divide-y divide-neutral-100">
          {ULTIMUNE_VARIANTS.map((variant) => (
            <li key={variant.label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <a href={officialVariantUrl(variant.size)} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900">
                {variant.label}
              </a>
              <span className="shrink-0 font-semibold tabular-nums">{variant.price.toLocaleString("ja-JP")}円（税込）</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-6 text-neutral-500">公式サイトの参考価格です。容量・レフィルごとに別商品として扱い、当店の販売価格や仕入れ原価とは混同しません。価格・在庫は公式ページで最新情報をご確認ください。</p>
      </section>
    );
  }

  const officialUrl = product.officialUrl || product.canonicalUrl;
  return (
    <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <p className="text-xs font-semibold tracking-wide text-neutral-500">SHISEIDO 公式情報</p>
      <h2 className="mt-1 text-base font-semibold">公式価格・容量・バリエーション</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600">容量やレフィルの違いを混同しないよう、公式情報を確認してください。仕入れ原価・送料・販売手数料を確認できるまで、公式小売価格を仕入れ値や当店販売価格として表示しません。</p>
      {officialUrl ? <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:border-neutral-900">公式サイトで価格・容量を確認 ↗</a> : null}
    </section>
  );
}
