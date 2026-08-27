import type {
  DiscoveryProduct,
  DiscoverySource,
  EvidenceGroup,
  SourceType,
} from "@/lib/discovery/types";

export function evidenceGroupForSource(type: SourceType): EvidenceGroup {
  if (type === "brand_official") return "official";
  if (type === "magazine" || type === "news" || type === "editorial") return "major_media";
  if (type === "retailer") return "retailer";
  if (type === "sns" || type === "official_person") return "social";
  return "other";
}

export function whyIsThisHere(product: Pick<DiscoveryProduct, "attentionReason" | "sources">) {
  const reason = product.attentionReason.trim();
  if (!reason) return null;
  if (product.sources.length === 0) return null;
  return reason;
}

export function evidenceSources(sources: DiscoverySource[]) {
  return [...sources].sort((a, b) => a.sourceTier - b.sourceTier || a.createdAt.localeCompare(b.createdAt));
}
