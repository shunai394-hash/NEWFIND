/**
 * Source quality reuses existing source_tier values (1-4).
 * Do not invent a new quality enum.
 */
export type SourceQuality = 1 | 2 | 3 | 4;

export function sourceQualityFromType(sourceType: string | null | undefined): SourceQuality {
  const type = (sourceType || "other").toLowerCase();
  if (type === "brand_official") return 1;
  if (type === "magazine" || type === "news" || type === "editorial") return 2;
  if (type === "retailer" || type === "official_person") return 3;
  return 4;
}

export function isLowQualitySource(quality: SourceQuality) {
  return quality >= 4;
}
