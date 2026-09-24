/**
 * Source quality reuses existing source_tier values (1-4).
 * Labels are stored in metadata / discovery_report, not a new DB enum.
 */

export type SourceQuality = 1 | 2 | 3 | 4;

export type SourceReliabilityLabel =
  | "official_brand_site"
  | "official_product_page"
  | "official_press"
  | "trusted_retailer"
  | "specialty_media"
  | "news"
  | "blog"
  | "sns"
  | "search_snippet_only";

export function sourceQualityFromType(sourceType: string | null | undefined): SourceQuality {
  const type = (sourceType || "other").toLowerCase();
  if (type === "brand_official") return 1;
  if (type === "magazine" || type === "news" || type === "editorial") return 2;
  if (type === "retailer" || type === "official_person") return 3;
  return 4;
}

export function sourceReliabilityLabel(input: {
  sourceType?: string | null;
  sourceRole?: string | null;
  hasOfficialUrl?: boolean;
  hasPageEvidence?: boolean;
  hasPressPath?: boolean;
}): SourceReliabilityLabel {
  const type = (input.sourceType || "other").toLowerCase();
  if (type === "sns") return "sns";
  if (type === "blog") return "blog";
  if (input.hasPressPath || /press/.test(type)) return "official_press";
  if (type === "news") return "news";
  if (type === "magazine" || type === "editorial") return "specialty_media";
  if (type === "brand_official" && input.sourceRole === "product") {
    return "official_product_page";
  }
  if (type === "brand_official" || input.hasOfficialUrl) {
    return input.sourceRole === "product"
      ? "official_product_page"
      : "official_brand_site";
  }
  if (type === "retailer") return "trusted_retailer";
  if (input.hasPageEvidence && input.sourceRole === "product") {
    return "official_product_page";
  }
  return "search_snippet_only";
}

export function sourceQualityFromReliability(
  label: SourceReliabilityLabel,
): SourceQuality {
  if (label === "official_brand_site" || label === "official_product_page") {
    return 1;
  }
  if (
    label === "official_press" ||
    label === "specialty_media" ||
    label === "news"
  ) {
    return 2;
  }
  if (label === "trusted_retailer") return 3;
  return 4;
}

export function isLowQualitySource(quality: SourceQuality) {
  return quality >= 4;
}

export function isWeakReliability(label: SourceReliabilityLabel) {
  return (
    label === "sns" ||
    label === "blog" ||
    label === "search_snippet_only"
  );
}
