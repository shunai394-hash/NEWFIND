import { classifyWorldInfo } from "@/lib/ai/correspondent";
import { classifyTavilyResult } from "@/lib/ai/world-search";
import { isHttpUrl } from "./adapters/common";
import { isMarketplaceHost } from "./identity";
import type { DropReason, MarketplaceProductCandidate } from "./types";

const NEWS_HINT =
  /\b(news|breaking|press release|記事|速報|ニュース|記者発表)\b/i;
const COUNTERFEIT_HINT =
  /\b(replica|counterfeit|fake|knockoff|imitat|bootleg|スーパーコピー|偽物|コピー品|レプリカ|海賊版)\b/i;
const REGULATED_HINT =
  /\b(weapon|firearm|ammunition|cbd thc|vape juice nicotine|prescription drug|医薬品|銃|武器)\b/i;

export type CandidateGate = {
  ok: boolean;
  reason: DropReason | null;
};

export function gateMarketplaceCandidate(
  candidate: MarketplaceProductCandidate,
  options?: { existingKeys?: Set<string>; identityKey?: string },
): CandidateGate {
  if (!isHttpUrl(candidate.url)) {
    return { ok: false, reason: "invalid_url" };
  }

  const haystack = `${candidate.title} ${candidate.brand ?? ""}`;
  if (COUNTERFEIT_HINT.test(haystack) || REGULATED_HINT.test(haystack)) {
    return { ok: false, reason: "counterfeit_or_legal_risk" };
  }

  if (candidate.sourceType === "unknown" || candidate.sourceConfidence < 20) {
    return { ok: false, reason: "unknown_source" };
  }

  const fromMarketplaceApi =
    isMarketplaceHost(candidate.url) && candidate.sourceType === "official_api";
  if (!fromMarketplaceApi) {
    const kind = classifyWorldInfo({
      title: candidate.title,
      url: candidate.url,
      snippet: candidate.transactionSignal,
      sourceType: "retailer",
    });
    if (kind === "NEWS" || NEWS_HINT.test(candidate.title)) {
      return { ok: false, reason: "news_article" };
    }
    const tavilyRole = classifyTavilyResult(
      candidate.title,
      candidate.url,
      candidate.transactionSignal ?? "",
      "retailer",
    );
    if (tavilyRole === "news") {
      return { ok: false, reason: "news_article" };
    }
    if (
      !candidate.externalProductId ||
      !candidate.title.trim() ||
      tavilyRole !== "product"
    ) {
      if (!candidate.title.trim() || !candidate.externalProductId) {
        return { ok: false, reason: "insufficient_identity" };
      }
      if (tavilyRole !== "product") {
        return { ok: false, reason: "not_a_product" };
      }
    }
  } else if (NEWS_HINT.test(candidate.title) || /\/news\//i.test(candidate.url)) {
    return { ok: false, reason: "news_article" };
  }

  if (!candidate.externalProductId || !candidate.title.trim()) {
    return { ok: false, reason: "insufficient_identity" };
  }

  if (options?.identityKey && options.existingKeys?.has(options.identityKey)) {
    return { ok: false, reason: "existing_product" };
  }

  return { ok: true, reason: null };
}

export function newsLooksLikeProduct(title: string, url: string) {
  if (isMarketplaceHost(url) && !/\/news\//i.test(url) && !NEWS_HINT.test(title)) {
    return false;
  }
  return (
    classifyWorldInfo({ title, url, sourceType: "news" }) === "NEWS" ||
    classifyTavilyResult(title, url, "", "news") === "news"
  );
}
