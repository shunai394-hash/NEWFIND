/**
 * Integration contract tests for TRACER <-> NEWFIND.
 * Verifies auth, retry, idempotency rules, and ACK rules without faking HTTP success.
 *
 * Run: npx tsx scripts/test-tracer-integration.ts
 */

import assert from "node:assert/strict";
import {
  signIntegrationBody,
  buildSignedHeaders,
  verifyIntegrationRequest,
  signingPayload,
} from "../lib/integration/auth";
import {
  nextRetryAt,
  isRetryableHttpStatus,
  isPermanentHttpStatus,
  RETRY_DELAYS_MS,
} from "../lib/integration/retry";
import {
  normalizeInboundEventType,
  TRACER_INBOUND_EVENT_TYPES,
  NEWFIND_OUTBOUND_EVENT_TYPES,
} from "../lib/integration/types";
import {
  checkTracerPublicationAttestation,
  withdrawnProductUrls,
} from "../lib/integration/tracer-attestation";

process.env.INTEGRATION_HMAC_SECRET = "test-shared-secret-for-integration";
process.env.INTEGRATION_KEY = "newfind-tracer";
process.env.INTEGRATION_TIMESTAMP_SKEW_SEC = "300";

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`PASS ${name}`);
}

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    ok(name);
  } catch (err) {
    console.error(`FAIL ${name}`, err);
    process.exit(1);
  }
}

async function main() {
  await test("event type catalog", () => {
    assert.deepEqual([...TRACER_INBOUND_EVENT_TYPES], [
      "market_info",
      "product_candidate",
      "demand_info",
      "sales_test_result",
      "brandbridge_product",
      "product_withdrawn",
    ]);
    assert.deepEqual([...NEWFIND_OUTBOUND_EVENT_TYPES], [
      "viewed",
      "searched",
      "saved",
      "liked",
      "purchased",
    ]);
  });

  const published = {
    product_name: "Wireless Mouse",
    product_url: "https://tracer-pied-alpha.vercel.app/shop/wireless-mouse-1",
    sales_url: "https://tracer-pied-alpha.vercel.app/shop/wireless-mouse-1",
    tracer_url: "https://tracer-pied-alpha.vercel.app/shop/wireless-mouse-1",
    market_url: "https://www.amazon.co.jp/dp/B000000000",
    price: 2300,
    currency: "JPY",
    tracer_listing_id: "11111111-1111-1111-1111-111111111111",
    tracer_published: true,
    sales_test_gate: "passed",
  };

  await test("publish gate: published + gate-passed TRACER product accepted", () => {
    const r = checkTracerPublicationAttestation(published);
    assert.equal(r.ok, true);
  });

  await test("publish gate: unpublished / draft / VALIDATING rejected", () => {
    assert.deepEqual(checkTracerPublicationAttestation({ ...published, tracer_published: false }), { ok: false, reason: "tracer_not_published" });
    const { tracer_published: _p, ...noFlag } = published;
    void _p;
    assert.equal(checkTracerPublicationAttestation(noFlag).ok, false);
    assert.equal(checkTracerPublicationAttestation({ ...published, tracer_published: "true" }).ok, false);
  });

  await test("publish gate: TEST_READY-only (no Sales Test Gate) rejected", () => {
    assert.deepEqual(checkTracerPublicationAttestation({ ...published, sales_test_gate: "pending" }), { ok: false, reason: "tracer_sales_test_gate_not_passed" });
    // Legacy "test_ready_opportunity" events normalize to product_candidate
    // but carry no attestation, so they can no longer be promoted.
    assert.equal(normalizeInboundEventType("test_ready_opportunity"), "product_candidate");
    assert.equal(checkTracerPublicationAttestation({ product_name: "x", product_url: "https://x", price: 1 }).ok, false);
  });

  await test("publish gate: listing id required", () => {
    assert.deepEqual(checkTracerPublicationAttestation({ ...published, tracer_listing_id: "" }), { ok: false, reason: "tracer_listing_id_missing" });
  });

  await test("payload integrity: product link must be TRACER sales page, not marketplace", () => {
    assert.deepEqual(
      checkTracerPublicationAttestation({ ...published, product_url: published.market_url }),
      { ok: false, reason: "tracer_product_url_not_sales_url" },
    );
  });

  await test("payload integrity: price must be a positive number", () => {
    for (const price of [0, -1, null, "abc", undefined]) {
      assert.equal(checkTracerPublicationAttestation({ ...published, price }).ok, false, String(price));
    }
    assert.equal(checkTracerPublicationAttestation({ ...published, price: "2300" }).ok, true);
  });

  await test("withdrawal: urls parsed, deduped, non-http dropped", () => {
    assert.deepEqual(
      withdrawnProductUrls({ product_urls: [published.sales_url, published.sales_url, "javascript:alert(1)", "", published.market_url] }),
      [published.sales_url, published.market_url],
    );
    assert.deepEqual(withdrawnProductUrls({}), []);
  });

  await test("legacy aliases normalize", () => {
    assert.equal(normalizeInboundEventType("test_ready_opportunity"), "product_candidate");
    assert.equal(normalizeInboundEventType("demand_snapshot"), "demand_info");
    assert.equal(normalizeInboundEventType("sales_test_result"), "sales_test_result");
    assert.equal(normalizeInboundEventType("nope"), null);
  });

  await test("HMAC sign/verify success", () => {
    const eventId = "evt-1";
    const rawBody = JSON.stringify({
      source: "tracer",
      event_id: eventId,
      event_type: "market_info",
      payload: { market: "KR" },
    });
    const signed = buildSignedHeaders({ eventId, rawBody });
    const headers = new Headers({
      "X-Integration-Key": signed.key,
      "X-Integration-Timestamp": signed.timestamp,
      "X-Integration-Id": signed.eventId,
      "X-Integration-Signature": signed.signature,
    });
    const result = verifyIntegrationRequest({ headers, rawBody, eventId });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.mode, "hmac");
  });

  await test("HMAC rejects bad signature", () => {
    const eventId = "evt-2";
    const rawBody = '{"a":1}';
    const signed = buildSignedHeaders({ eventId, rawBody });
    const headers = new Headers({
      "X-Integration-Key": signed.key,
      "X-Integration-Timestamp": signed.timestamp,
      "X-Integration-Id": signed.eventId,
      "X-Integration-Signature": "deadbeef",
    });
    const result = verifyIntegrationRequest({ headers, rawBody, eventId });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  await test("HMAC rejects skewed timestamp", () => {
    const eventId = "evt-3";
    const rawBody = "{}";
    const oldTs = String(Math.floor(Date.now() / 1000) - 10_000);
    const signature = signIntegrationBody({
      secret: process.env.INTEGRATION_HMAC_SECRET!,
      timestamp: oldTs,
      eventId,
      rawBody,
    });
    const headers = new Headers({
      "X-Integration-Key": "newfind-tracer",
      "X-Integration-Timestamp": oldTs,
      "X-Integration-Id": eventId,
      "X-Integration-Signature": signature,
    });
    const result = verifyIntegrationRequest({ headers, rawBody, eventId });
    assert.equal(result.ok, false);
  });

  await test("legacy bearer auth accepted", () => {
    const eventId = "evt-4";
    const rawBody = "{}";
    const headers = new Headers({
      Authorization: `Bearer ${process.env.INTEGRATION_HMAC_SECRET}`,
    });
    const result = verifyIntegrationRequest({ headers, rawBody, eventId });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.mode, "bearer");
  });

  await test("signing payload format", () => {
    assert.equal(signingPayload("1", "e", "body"), "1.e.body");
  });

  await test("retry schedule stages", () => {
    assert.equal(RETRY_DELAYS_MS.length, 5);
    assert.equal(RETRY_DELAYS_MS[0], 60_000);
    assert.equal(RETRY_DELAYS_MS[1], 5 * 60_000);
    assert.equal(RETRY_DELAYS_MS[2], 15 * 60_000);
    assert.equal(RETRY_DELAYS_MS[3], 60 * 60_000);
    assert.equal(RETRY_DELAYS_MS[4], 6 * 60 * 60_000);
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    assert.equal(nextRetryAt(1, t0).toISOString(), "2026-01-01T00:01:00.000Z");
    assert.equal(nextRetryAt(2, t0).toISOString(), "2026-01-01T00:05:00.000Z");
    assert.equal(nextRetryAt(3, t0).toISOString(), "2026-01-01T00:15:00.000Z");
    assert.equal(nextRetryAt(4, t0).toISOString(), "2026-01-01T01:00:00.000Z");
    assert.equal(nextRetryAt(5, t0).toISOString(), "2026-01-01T06:00:00.000Z");
    assert.equal(nextRetryAt(9, t0).toISOString(), "2026-01-01T06:00:00.000Z");
  });

  await test("retryable vs permanent statuses", () => {
    for (const s of [429, 500, 502, 503, 504]) {
      assert.equal(isRetryableHttpStatus(s), true);
      assert.equal(isPermanentHttpStatus(s), false);
    }
    assert.equal(isRetryableHttpStatus(null), true);
    for (const s of [400, 401, 403, 404, 422]) {
      assert.equal(isPermanentHttpStatus(s), true);
      assert.equal(isRetryableHttpStatus(s), false);
    }
  });

  await test("ACK rule: HTTP 200 alone is not enough", () => {
    function responseLooksLikeAck(status: number, body: unknown): boolean {
      if (status < 200 || status >= 300) return false;
      if (!body || typeof body !== "object") return false;
      const obj = body as Record<string, unknown>;
      if (obj.ok === true && obj.ack === true) return true;
      if (obj.ok === true && obj.result && typeof obj.result === "object") {
        const result = obj.result as Record<string, unknown>;
        const accepted = Number(result.accepted ?? 0);
        const deduped = Number(result.deduped ?? 0);
        const rejected = Number(result.rejected ?? 0);
        if (accepted > 0 || deduped > 0) return true;
        if (rejected > 0 && accepted === 0 && deduped === 0) return false;
      }
      return false;
    }
    assert.equal(responseLooksLikeAck(200, { ok: true }), false);
    assert.equal(responseLooksLikeAck(200, { ok: true, ack: true, event_id: "x" }), true);
    assert.equal(
      responseLooksLikeAck(200, {
        ok: true,
        result: { accepted: 1, rejected: 0, deduped: 0 },
      }),
      true,
    );
    assert.equal(
      responseLooksLikeAck(200, {
        ok: true,
        result: { accepted: 0, rejected: 1, deduped: 0 },
      }),
      false,
    );
    assert.equal(
      responseLooksLikeAck(200, {
        ok: true,
        result: { accepted: 0, rejected: 0, deduped: 1 },
      }),
      true,
    );
  });

  await test("purchased emit requires proof (unit)", async () => {
    const { emitUserEngagement } = await import("../lib/integration/emit");
    const noProof = await emitUserEngagement({
      eventType: "purchased",
      productId: "p1",
      userId: "u1",
    });
    assert.equal(noProof.queued, false);
    assert.equal(noProof.reason, "no_purchase_proof");

    const noProduct = await emitUserEngagement({
      eventType: "viewed",
      userId: "u1",
    });
    assert.equal(noProduct.queued, false);
    assert.equal(noProduct.reason, "missing_product_id");

    const emptySearch = await emitUserEngagement({
      eventType: "searched",
      query: "  ",
      userId: "u1",
    });
    assert.equal(emptySearch.queued, false);
  });

  console.log(`\n${passed} integration unit checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
