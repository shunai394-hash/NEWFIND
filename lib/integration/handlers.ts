import { assignDiscoveryToResident } from "@/lib/ai/discovery-handoff";
import { upsertInvestigation } from "@/lib/ai/investigations";
import { createAdminClient } from "@/lib/supabase/admin";
import { productIdentityKey } from "@/lib/ai/product-identity";
import { canonicalProductUrl } from "@/lib/discovery/rules";
import { isUsableProductImage } from "@/lib/discovery/media";
import { publishBrandBridgeToFeed } from "./brandbridge-feed";
import { checkTracerPublicationAttestation, withdrawnProductUrls } from "./tracer-attestation";
import { isDecorativeCraftObject } from "@/lib/ai/craft-object";
import type { TracerInboundEventType } from "./types";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

async function storeBridgeNote(input: {
  eventType: TracerInboundEventType;
  eventId: string;
  payload: Record<string, unknown>;
}) {
  try {
    const { logAiActivity } = await import("@/lib/ai/control-tower/activity-log");
    await logAiActivity({
      actorName: "TRACER",
      actorRole: "integration",
      action: `tracer_${input.eventType}`,
      detail: `Received ${input.eventType} (${input.eventId})`,
      relatedRunId: input.eventId,
      metadata: input.payload,
    });
  } catch {
    // non-fatal
  }
}

async function handleProductCandidate(
  eventType: TracerInboundEventType,
  eventId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  const isBrandBridge = eventType === "brandbridge_product";
  // Publish gate: a TRACER product is promoted only with TRACER's signed
  // attestation that it is published and passed the Sales Test Gate.
  if (!isBrandBridge) {
    const attestation = checkTracerPublicationAttestation(payload);
    if (!attestation.ok) return { ok: false, detail: attestation.reason };
  }
  if (isBrandBridge) {
    const feed = await publishBrandBridgeToFeed({ eventId, payload });
    await storeBridgeNote({ eventType, eventId, payload: { ...payload, feed } });
  }
  const productUrl =
    asString(payload.product_url) ||
    asString(payload.productUrl) ||
    asString(payload.url) ||
    asString(payload.canonical_url);
  const productName =
    asString(payload.product_name) ||
    asString(payload.productName) ||
    asString(payload.title) ||
    asString(payload.name);
  const brand = asString(payload.brand);
  const category = asString(payload.category) || asString(payload.beat) || "other";
  const country = asString(payload.country) || asString(payload.country_code) || null;
  const imageUrl =
    asString(payload.image_url) ||
    asString(payload.imageUrl) ||
    asString(payload.product_image_url);

  if (!productUrl || !productName) {
    return {
      ok: false,
      detail: "product_candidate requires product_url and product_name",
    };
  }

  // Same decorative-craft rule as the product hunter, posting gate and
  // homepage: stop craft bottles / vases / ornaments at intake instead of
  // storing and then hiding them.
  if (isDecorativeCraftObject(`${productName} ${asString(payload.category) ?? ""}`)) {
    return { ok: false, detail: "decorative_craft_object_not_promoted" };
  }

  const canonical = canonicalProductUrl(productUrl) || productUrl;
  const identity = productIdentityKey({
    brand: brand || "unknown",
    productName,
    productUrl: canonical,
  });

  const admin = createAdminClient();
  const publishable = isUsableProductImage(imageUrl);

  const existing = await admin
    .from("discovery_products")
    .select("id, status")
    .eq("product_url", canonical)
    .maybeSingle();

  let productId = existing.data?.id as string | undefined;

  if (!productId) {
    const byKey = await admin
      .from("discovery_products")
      .select("id, status")
      .eq("duplicate_key", identity)
      .maybeSingle();
    productId = byKey.data?.id as string | undefined;
  }

  if (productId && publishable) {
    const { error: promoteError } = await admin
      .from("discovery_products")
      .update({
        status: "approved",
        product_image_url: imageUrl,
        ...(!isBrandBridge && (asString(payload.official_url) || asString(payload.officialUrl))
          ? { official_url: asString(payload.official_url) || asString(payload.officialUrl) }
          : {}),
        confidence_score: asNumber(payload.selection_score) ?? asNumber(payload.confidence) ?? 40,
        trend_score: asNumber(payload.demand_score) ?? 0,
        // Re-promotion carries TRACER's current price; never keep a stale one.
        ...(!isBrandBridge && asNumber(payload.price) !== null
          ? { price: asNumber(payload.price), currency: asString(payload.currency) || "JPY" }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);
    if (promoteError) {
      return { ok: false, detail: `discovery promotion failed: ${promoteError.message}` };
    }
  }

  if (!productId) {
    const insert = await admin
      .from("discovery_products")
      .insert({
        id: crypto.randomUUID(),
        brand: brand || "Unknown",
        product_name: productName,
        category,
        country,
        description: asString(payload.discovery_reason) || asString(payload.note) || "",
        product_image_url: imageUrl,
        product_url: canonical,
        official_url:
          !isBrandBridge
            ? asString(payload.official_url) || asString(payload.officialUrl)
            : null,
        price: asNumber(payload.price),
        currency: asString(payload.currency) || "JPY",
        canonical_url: canonical,
        duplicate_key: identity,
        discovery_source: "tracer",
        attention_reason:
          asString(payload.discovery_reason) ||
          asString(payload.why_now) ||
          "TRACER product candidate",
        status: publishable ? "approved" : "pending",
        trend_score: asNumber(payload.demand_score) ?? 0,
        confidence_score:
          asNumber(payload.selection_score) ?? asNumber(payload.confidence) ?? 40,
        discovered_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insert.error) {
      return { ok: false, detail: `discovery insert failed: ${insert.error.message}` };
    }
    productId = String(insert.data.id);
  }

  const assigned = await assignDiscoveryToResident({
    productId,
    category,
    country,
    title: productName,
    scoutName: "TRACER",
    runId: eventId,
  });

  if (assigned) {
    await upsertInvestigation({
      personaId: assigned.personaId,
      actorName: assigned.personaName,
      actorRole: "product_hunter",
      title: productName,
      summary:
        asString(payload.discovery_reason) ||
        `TRACER candidate for ${brand || productName}`,
      beat: category,
      sourceUrl: canonical,
      sourceTitle: productName,
      sourceKind: isBrandBridge ? "brandbridge_product" : "tracer_product_candidate",
      entityKey: identity,
      productId,
      evidenceCount: 1,
      confidence: asNumber(payload.confidence) ?? 40,
      decision: "INVESTIGATE_MORE",
      qualityOk: true,
      qualityReason: "LOW_EVIDENCE",
      runId: eventId,
    });
  }

  await storeBridgeNote({
    eventType,
    eventId,
    payload: { ...payload, productId, assigned },
  });

  return {
    ok: true,
    detail: assigned
      ? `assigned to ${assigned.personaName}; investigation opened`
      : `stored candidate ${productId}; no resident matched yet`,
  };
}

// TRACER unpublished the listing: take its promotion out of the public feed.
// Only TRACER-sourced, currently approved rows are touched; nothing is
// deleted (status moves to "pending", which the public feed excludes).
async function handleProductWithdrawn(
  eventId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  const urls = withdrawnProductUrls(payload);
  if (urls.length === 0) return { ok: false, detail: "product_withdrawn requires product_urls" };
  const candidates = Array.from(new Set(urls.flatMap((url) => [url, canonicalProductUrl(url) || url])));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discovery_products")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .in("product_url", candidates)
    .eq("discovery_source", "tracer")
    .eq("status", "approved")
    .select("id");
  if (error) return { ok: false, detail: `withdraw failed: ${error.message}` };
  await storeBridgeNote({ eventType: "product_withdrawn", eventId, payload: { ...payload, withdrawn: data?.length ?? 0 } });
  return { ok: true, detail: `withdrawn ${data?.length ?? 0} discovery product(s)` };
}

async function handleFactOnly(
  eventType: TracerInboundEventType,
  eventId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  await storeBridgeNote({ eventType, eventId, payload });
  return { ok: true, detail: `${eventType} recorded` };
}

export async function processInboundEvent(input: {
  eventType: TracerInboundEventType;
  eventId: string;
  payload: Record<string, unknown>;
  causationId?: string | null;
}): Promise<{ ok: boolean; detail: string }> {
  const source = asString(input.payload.source) || asString(input.payload.origin);
  if (source === "newfind") {
    return { ok: true, detail: "ignored newfind-originated echo (loop prevention)" };
  }

  switch (input.eventType) {
    case "product_candidate":
    case "brandbridge_product":
      return handleProductCandidate(input.eventType, input.eventId, input.payload);
    case "product_withdrawn":
      return handleProductWithdrawn(input.eventId, input.payload);
    case "market_info":
    case "demand_info":
    case "sales_test_result":
      return handleFactOnly(input.eventType, input.eventId, input.payload);
    default:
      return { ok: false, detail: "unsupported event_type" };
  }
}
