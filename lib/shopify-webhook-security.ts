import { timingSafeEqual } from "node:crypto";

/**
 * Validate Shopify's Base64-encoded HMAC-SHA256 header.
 * Reject non-canonical Base64 and values that are not exactly 32 bytes.
 */
export function safeEqualShopifyHmac(expectedBase64: string, received: string): boolean {
  const supplied = Buffer.from(received, "base64");
  if (supplied.length !== 32 || supplied.toString("base64") !== received) return false;
  const expected = Buffer.from(expectedBase64, "base64");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
