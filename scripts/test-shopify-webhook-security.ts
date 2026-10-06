import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedWebhookBody } from "../lib/shopify-webhook-body";
import { resolveShopifyEventTimestamp } from "../lib/shopify-webhook-payload";
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

test("verifies the exact raw UTF-8 bytes without re-encoding", () => {
  const body = new TextEncoder().encode('{"id":123,"title":"東京"}');
  const secret = "test-webhook-secret";
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyShopifyWebhookHmac(body, secret, signature), true);
  assert.equal(verifyShopifyWebhookHmac(new TextEncoder().encode('{"id":123,"title":"東京 "}'), secret, signature), false);
});

test("bounded body reader preserves raw bytes below the configured cap", async () => {
  const bytes = new TextEncoder().encode('{"title":"東京"}');
  const request = new Request("https://example.test/webhook", { method: "POST", body: bytes });
  const result = await readBoundedWebhookBody(request, bytes.byteLength);
  assert.equal("tooLarge" in result, false);
  if ("body" in result) assert.deepEqual(result.body, bytes);
});

test("bounded body reader rejects an oversized payload", async () => {
  const request = new Request("https://example.test/webhook", {
    method: "POST",
    body: new Uint8Array([1, 2, 3, 4, 5]),
  });
  const result = await readBoundedWebhookBody(request, 4);
  assert.deepEqual(result, { tooLarge: true });
});

test("Shopify intake contract preserves publication and access gates", async () => {
  const route = await readFile(new URL("../app/api/integrations/shopify/products/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20261006120000_shopify_product_promotions.sql", import.meta.url), "utf8");

  assert.match(route, /readBoundedWebhookBody\(request, MAX_BODY_BYTES\)/);
  assert.match(route, /last_webhook_id: webhookId/);
  assert.match(route, /readiness: configured \? "configured" : "missing_environment"/);
  assert.match(route, /status: configured \? 200 : 503/);
  assert.match(route, /product\.status === "active" && Boolean\(product\.published_at\)/);
  assert.match(route, /source_updated_at: sourceUpdatedAt/);
  assert.doesNotMatch(route, /source_updated_at: triggeredAt/);
  assert.match(route, /review_status: archived \|\| !published \? "blocked" : "pending_review"/);
  assert.doesNotMatch(route, /\.from\(["']ai_posts["']\)\s*\.insert/);
  assert.match(migration, /new\.last_webhook_id = old\.last_webhook_id/);
  assert.match(migration, /new\.source_updated_at <= old\.source_updated_at/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.shopify_product_promotions from anon, authenticated/i);
});

test("accepts the documented minimal products/delete payload timestamp from Shopify delivery metadata", () => {
  assert.equal(
    resolveShopifyEventTimestamp("products/delete", undefined, "2026-10-06T08:30:00.000Z"),
    "2026-10-06T08:30:00.000Z",
  );
});

test("requires a valid product updated_at for create and update events", () => {
  assert.equal(resolveShopifyEventTimestamp("products/create", undefined, "2026-10-06T08:30:00.000Z"), null);
  assert.equal(resolveShopifyEventTimestamp("products/update", "invalid", "2026-10-06T08:30:00.000Z"), null);
  assert.equal(resolveShopifyEventTimestamp("products/update", "2026-10-06T08:00:00Z", "2026-10-06T08:30:00Z"), "2026-10-06T08:00:00.000Z");
});
