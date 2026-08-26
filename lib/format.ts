import { isDummyUrl } from "@/lib/products/discovery-filter";

export function timeAgo(iso: string) {
  const delta = Date.now() - Date.parse(iso);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

export function compactCount(value: number) {
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}千`;
  return `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万`;
}

export function productHref(post: {
  productUrl: string | null;
  sourceUrl: string | null;
}) {
  const href = post.productUrl || post.sourceUrl || null;
  if (!href || isDummyUrl(href)) return null;
  return href;
}
