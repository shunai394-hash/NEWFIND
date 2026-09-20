import {
  extractUrlIdentity,
  productIdentityKey,
} from "@/lib/ai/product-identity";
import { canonicalizeSourceUrl } from "@/lib/ai/agent-os/hash";
import type { MarketplaceProductCandidate } from "./types";

export function marketplaceIdentityKey(candidate: MarketplaceProductCandidate) {
  if (candidate.gtin && candidate.gtin.replace(/\D/g, "").length >= 8) {
    return productIdentityKey({
      brand: candidate.brand || "",
      productName: candidate.title,
      gtin: candidate.gtin,
    });
  }
  if (candidate.asin) return `asin:${candidate.asin.toUpperCase()}`;
  if (candidate.epid) return `epid:${candidate.epid}`;
  if (candidate.sku && candidate.brand) {
    return productIdentityKey({
      brand: candidate.brand,
      productName: candidate.title,
      sku: candidate.sku,
    });
  }
  const urlId = extractUrlIdentity(candidate.url);
  if (urlId.asin) return `asin:${urlId.asin}`;
  return (
    productIdentityKey({
      brand: candidate.brand || candidate.marketplace,
      productName: candidate.title,
      productUrl: candidate.url,
    }) || `url:${canonicalizeSourceUrl(candidate.url)}`
  );
}

export function isMarketplaceHost(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return (
      /(^|\.)amazon\./i.test(host) ||
      /(^|\.)ebay\./i.test(host) ||
      /(^|\.)mercari\./i.test(host) ||
      host.includes("auctions.yahoo.") ||
      host.includes("paypayfleamarket") ||
      host.includes("minne.com") ||
      host.includes("rakuma.rakuten")
    );
  } catch {
    return false;
  }
}

export function candidateHasIdentity(candidate: MarketplaceProductCandidate) {
  return Boolean(
    candidate.externalProductId &&
      candidate.title.trim() &&
      candidate.url &&
      (candidate.gtin ||
        candidate.asin ||
        candidate.epid ||
        candidate.sku ||
        candidate.brand ||
        candidate.title.split(" ").length >= 2),
  );
}
