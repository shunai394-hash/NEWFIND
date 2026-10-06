import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Shopify's Base64-encoded HMAC-SHA256 over the exact raw request body.
 * Reject non-canonical Base64 and values that are not exactly 32 bytes.
 */
export function verifyShopifyWebhookHmac(rawBody: string | Uint8Array, secret: string, received: string): boolean {
  const supplied = Buffer.from(received, "base64");
  if (supplied.length !== 32 || supplied.toString("base64") !== received) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
