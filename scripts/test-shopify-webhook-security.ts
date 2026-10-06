import { createHmac } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { verifyShopifyWebhookHmac } from "../lib/shopify-webhook-security";

test("accepts a valid Shopify Base64 HMAC for the exact raw body", () => {
  const body = '{"id":123,"title":"Test product"}';
  const secret = "test-webhook-secret";
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  assert.equal(verifyShopifyWebhookHmac(body, secret, signature), true);
});

test("rejects a signature for a changed body or wrong secret", () => {
  const body = '{"id":123}';
  const secret = "test-webhook-secret";
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  assert.equal(verifyShopifyWebhookHmac('{"id":124}', secret, signature), false);
  assert.equal(verifyShopifyWebhookHmac(body, "wrong-secret", signature), false);
});

test("rejects hex, malformed, truncated, and non-canonical Base64 signatures", () => {
  const body = "body";
  const secret = "test-webhook-secret";
  const valid = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyShopifyWebhookHmac(body, secret, Buffer.from(valid, "base64").toString("hex")), false);
  assert.equal(verifyShopifyWebhookHmac(body, secret, "not-a-signature"), false);
  assert.equal(verifyShopifyWebhookHmac(body, secret, valid.slice(0, -4)), false);
  assert.equal(verifyShopifyWebhookHmac(body, secret, valid.replace(/=$/, "")), false);
});
