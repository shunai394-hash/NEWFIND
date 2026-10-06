const ALLOWED_PRODUCT_TOPICS = new Set(["products/create", "products/update", "products/delete"]);

export function resolveShopifyEventTimestamp(
  topic: string,
  productUpdatedAt: unknown,
  triggeredAt: string,
): string | null {
  if (!ALLOWED_PRODUCT_TOPICS.has(topic)) return null;

  // Shopify's documented products/delete payload contains only the product ID.
  // That tombstone has no updated_at, so use its delivery timestamp.
  const candidate = topic === "products/delete" ? triggeredAt : productUpdatedAt;
  if (typeof candidate !== "string" || !candidate.trim()) return null;

  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}
