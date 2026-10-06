import { createHmac } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { safeEqualShopifyHmac } from "../lib/shopify-webhook-security";

test("accepts a valid Shopify Base64 HMAC for the exact raw body", () => {
  const body = '{"id":123,"title":"Test product"}';
  const secret = "test-webhook-secret";
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  assert.equal(safeEqualShopifyHmac(signature, signature), true);
});

test("rejects a signature for a changed body", () => {
  const signature = createHmac("sha256", "test-webhook-secret")
    .update('{"id":123}', "utf8").digest("base64");
  const changed = createHmac("sha256", "test-webhook-secret")
    .update('{"id":124}', "utf8").digest("base64");
  assert.equal(safeEqualShopifyHmac(signature, changed), false);
});

test("rejects hex, malformed, truncated, and non-canonical Base64 signatures", () => {
  const valid = createHmac("sha256", "test-webhook-secret").update("body").digest("base64");
  assert.equal(safeEqualShopifyHmac(valid, Buffer.from(valid, "base64").toString("hex")), false);
  assert.equal(safeEqualShopifyHmac(valid, "not-a-signature"), false);
  assert.equal(safeEqualShopifyHmac(valid, valid.slice(0, -4)), false);
  assert.equal(safeEqualShopifyHmac(valid, valid.replace(/=$/, "")), false);
});
