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

/** Convert Shopify's numeric product ID to a canonical decimal string. */
export function normalizeShopifyProductId(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) return null;
  const normalized = value.replace(/^0+(?=\d)/, "");
  if (normalized === "0") return null;
  return normalized;
}

/** Parse only explicit, non-negative monetary values within numeric(12,2). */
export function normalizeShopifyPrice(value: unknown): number | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 9_999_999_999.99) {
    return null;
  }
  return Math.round(value * 100) / 100 === value ? value : null;
}

/** Accept only a single lowercase Shopify-managed shop hostname. */
export function isShopifyMyshopifyDomain(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(value);
}

/** Keep untrusted Shopify HTML as bounded plain text in the private review queue. */
export function normalizeShopifyDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
  return text || null;
}

/** Prevent a full product snapshot from being replayed under the unsigned delete topic header. */
export function isMinimalShopifyDeletePayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  const allowedKeys = new Set(["id", "admin_graphql_api_id"]);
  if (payload.id == null) return false;
  return Object.keys(payload).every((key) => allowedKeys.has(key));
}
