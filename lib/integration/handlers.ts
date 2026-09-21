import { assignDiscoveryToResident } from "@/lib/ai/discovery-handoff";
import { upsertInvestigation } from "@/lib/ai/investigations";
import { createAdminClient } from "@/lib/supabase/admin";
import { productIdentityKey } from "@/lib/ai/product-identity";
import { canonicalProductUrl } from "@/lib/discovery/rules";
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
  eventId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
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

  const canonical = canonicalProductUrl(productUrl) || productUrl;
  const identity = productIdentityKey({
    brand: brand || "unknown",
    productName,
    productUrl: canonical,
  });

  const admin = createAdminClient();

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
        official_url: asString(payload.official_url) || asString(payload.officialUrl),
        price: asNumber(payload.price),
        currency: asString(payload.currency) || "JPY",
        canonical_url: canonical,
        duplicate_key: identity,
        discovery_source: "tracer",
        attention_reason:
          asString(payload.discovery_reason) ||
          asString(payload.why_now) ||
          "TRACER product candidate",
        status: "pending",
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
      sourceKind: "tracer_product_candidate",
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
    eventType: "product_candidate",
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
      return handleProductCandidate(input.eventId, input.payload);
    case "market_info":
    case "demand_info":
    case "sales_test_result":
      return handleFactOnly(input.eventType, input.eventId, input.payload);
    default:
      return { ok: false, detail: "unsupported event_type" };
  }
}
