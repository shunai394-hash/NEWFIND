// Pure publication-gate check for TRACER product events (no server imports,
// so it can be tested directly).
//
// NEWFIND may only promote TRACER products that TRACER has published after
// its Sales Test Gate. TRACER signs that attestation into the payload; any
// product_candidate from TRACER without it (draft, unpublished, VALIDATING,
// TEST_READY-only "test_ready_opportunity", or pre-gate events) is rejected.

export type TracerAttestation =
  | { ok: true; listingId: string; salesUrl: string }
  | { ok: false; reason: string };

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

// TRACER's canonical production storefront host. Do not accept the retired
// tracer-self.vercel.app host: inbound product links must resolve to the
// current production storefront. Override with NEWFIND_TRACER_SALES_HOSTS
// (comma-separated hostnames) only when deliberately rotating the host.
const DEFAULT_TRACER_SALES_HOSTS = ["tracer-pied-alpha.vercel.app"];

export function trustedTracerSalesHosts(): string[] {
  const configured = (process.env.NEWFIND_TRACER_SALES_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host));
  return configured.length > 0 ? configured : DEFAULT_TRACER_SALES_HOSTS;
}

export function checkTracerPublicationAttestation(payload: Record<string, unknown>): TracerAttestation {
  if (payload.tracer_published !== true) return { ok: false, reason: "tracer_not_published" };
  if (payload.sales_test_gate !== "passed") return { ok: false, reason: "tracer_sales_test_gate_not_passed" };
  const listingId = text(payload.tracer_listing_id);
  if (!listingId) return { ok: false, reason: "tracer_listing_id_missing" };
  const salesUrl = text(payload.sales_url) ?? text(payload.tracer_url);
  if (!salesUrl) return { ok: false, reason: "tracer_sales_url_missing" };
  let parsedSalesUrl: URL;
  try {
    parsedSalesUrl = new URL(salesUrl);
  } catch {
    return { ok: false, reason: "tracer_sales_url_invalid" };
  }
  if (parsedSalesUrl.protocol !== "https:" || !trustedTracerSalesHosts().includes(parsedSalesUrl.hostname.toLowerCase())) {
    return { ok: false, reason: "tracer_sales_url_untrusted_origin" };
  }
  const canonicalSalesUrl = parsedSalesUrl.toString();
  const productUrl = text(payload.product_url);
  // The promoted link must be TRACER's own sales page: price and image in
  // the payload belong to that page, not to a marketplace listing.
  if (productUrl) {
    try {
      const parsedProductUrl = new URL(productUrl);
      if (parsedProductUrl.toString() !== canonicalSalesUrl) {
        return { ok: false, reason: "tracer_product_url_not_sales_url" };
      }
    } catch {
      return { ok: false, reason: "tracer_product_url_invalid" };
    }
  }
  const price = typeof payload.price === "number" ? payload.price : Number(payload.price);
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: "tracer_price_invalid" };
  return { ok: true, listingId, salesUrl };
}

/** URLs a product_withdrawn event names; only http(s) URLs are accepted. */
export function withdrawnProductUrls(payload: Record<string, unknown>): string[] {
  const raw = Array.isArray(payload.product_urls) ? payload.product_urls : [payload.product_url];
  return Array.from(new Set(
    raw
      .map(text)
      .filter((value): value is string => Boolean(value && /^https?:\/\//i.test(value))),
  ));
}
