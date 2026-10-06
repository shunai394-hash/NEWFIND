const ALLOWED_PRODUCT_TOPICS = new Set(["products/create", "products/update", "products/delete"]);
const SHOPIFY_PRODUCT_ID_MAX = 18_446_744_073_709_551_615n;
const RFC3339_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i;

export function resolveShopifyEventTimestamp(
  topic: string,
  productUpdatedAt: unknown,
  triggeredAt: string,
): string | null {
  if (!ALLOWED_PRODUCT_TOPICS.has(topic)) return null;

  // Shopify's documented products/delete payload contains only the product ID.
  // Its event time comes from delivery metadata; that header is not covered by
  // Shopify's body HMAC, so delete events are additionally constrained to the
  // documented minimal tombstone shape by the caller.
  const candidate = topic === "products/delete" ? triggeredAt : productUpdatedAt;
  if (typeof candidate !== "string" || !RFC3339_TIMESTAMP.test(candidate.trim())) return null;
  const normalizedCandidate = candidate.trim();
  const [year, month, day] = normalizedCandidate.slice(0, 10).split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const timeMatch = /T(\\d{2}):(\\d{2}):(\\d{2})/.exec(normalizedCandidate);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59 || Number(timeMatch[3]) > 59) return null;
  const offsetMatch = /([+-])(\\d{2}):(\\d{2})$/.exec(normalizedCandidate);
  if (offsetMatch && (Number(offsetMatch[2]) > 23 || Number(offsetMatch[3]) > 59)) return null;

  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

/** Convert Shopify's unsigned 64-bit product ID to a canonical decimal string. */
export function normalizeShopifyProductId(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) return null;
  const normalized = value.replace(/^0+(?=\d)/, "");
  if (normalized === "0") return null;
  try {
    if (BigInt(normalized) > SHOPIFY_PRODUCT_ID_MAX) return null;
  } catch {
    return null;
  }
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
  if (
    payload.admin_graphql_api_id !== undefined &&
    (typeof payload.admin_graphql_api_id !== "string" ||
      payload.admin_graphql_api_id !== `gid://shopify/Product/${String(payload.id)}`)
  ) return false;
  return Object.keys(payload).every((key) => allowedKeys.has(key));
}
