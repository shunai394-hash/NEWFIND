import assert from "node:assert/strict";
import { checkTracerPublicationAttestation, withdrawnProductUrls } from "../lib/integration/tracer-attestation";

const base = {
  tracer_published: true,
  sales_test_gate: "passed",
  tracer_listing_id: "listing-1",
  sales_url: "https://tracer-self.vercel.app/shop/item-1",
  product_url: "https://tracer-self.vercel.app/shop/item-1",
  price: 2300,
};

assert.equal(checkTracerPublicationAttestation(base).ok, true);
assert.equal(checkTracerPublicationAttestation({ ...base, tracer_published: false }).ok, false);
assert.equal(checkTracerPublicationAttestation({ ...base, sales_test_gate: "pending" }).ok, false);
assert.deepEqual(
  checkTracerPublicationAttestation({ ...base, sales_url: "https://evil.example/item-1" }),
  { ok: false, reason: "tracer_sales_url_untrusted_origin" },
);
assert.deepEqual(
  checkTracerPublicationAttestation({ ...base, sales_url: "http://tracer-self.vercel.app/shop/item-1" }),
  { ok: false, reason: "tracer_sales_url_untrusted_origin" },
);
assert.deepEqual(
  checkTracerPublicationAttestation({ ...base, product_url: "https://tracer-self.vercel.app/shop/other" }),
  { ok: false, reason: "tracer_product_url_not_sales_url" },
);
assert.deepEqual(
  withdrawnProductUrls({ product_urls: [base.sales_url, base.sales_url, "javascript:alert(1)"] }),
  [base.sales_url],
);

console.log("TRACER attestation contract: PASS");
