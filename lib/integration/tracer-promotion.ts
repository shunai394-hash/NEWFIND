import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalProductUrl } from "@/lib/discovery/rules";
import { checkTracerPublicationAttestation } from "./tracer-attestation";

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/**
 * Records a gate-passed TRACER promotion and publishes one corresponding
 * AI-resident post. This is deliberately idempotent: event_id and
 * tracer_listing_id are unique in tracer_promotions, while the feed lookup
 * prevents duplicate public posts when a delivery is replayed.
 */
export async function recordTracerPromotion(input: {
  eventId: string;
  payload: Record<string, unknown>;
  discoveryProductId: string;
}): Promise<{ ok: boolean; promotionId?: string; postId?: string; detail: string }> {
  const attestation = checkTracerPublicationAttestation(input.payload);
  if (!attestation.ok) return { ok: false, detail: attestation.reason };

  const listingId = text(input.payload.tracer_listing_id);
  const productName = text(input.payload.product_name) || text(input.payload.title);
  const rawUrl = text(input.payload.sales_url) || text(input.payload.product_url);
  const productUrl = rawUrl ? canonicalProductUrl(rawUrl) || rawUrl : null;
  if (!listingId || !productName || !productUrl) {
    return { ok: false, detail: "tracer promotion identity is incomplete" };
  }

  const admin = createAdminClient();
  const existing = await admin
    .from("tracer_promotions")
    .select("id, ai_post_id, status")
    .eq("tracer_listing_id", listingId)
    .maybeSingle();
  if (existing.error) return { ok: false, detail: existing.error.message };

  let promotionId = existing.data?.id as string | undefined;
  let existingPostId = existing.data?.ai_post_id as string | null | undefined;

  if (!promotionId) {
    const insert = await admin
      .from("tracer_promotions")
      .insert({
        event_id: input.eventId,
        tracer_listing_id: listingId,
        tracer_product_id: text(input.payload.tracer_product_id),
        discovery_product_id: input.discoveryProductId,
        product_url: productUrl,
        product_name: productName,
        image_url: text(input.payload.image_url) || text(input.payload.product_image_url),
        price: number(input.payload.price),
        currency: text(input.payload.currency) || "JPY",
        sales_test_gate: "passed",
        tracer_published: true,
        status: "promoted",
        metadata: input.payload,
      })
      .select("id")
      .single();
    if (insert.error) return { ok: false, detail: `promotion ledger insert failed: ${insert.error.message}` };
    promotionId = String(insert.data.id);
  } else {
    const update = await admin
      .from("tracer_promotions")
      .update({
        event_id: input.eventId,
        discovery_product_id: input.discoveryProductId,
        product_url: productUrl,
        product_name: productName,
        image_url: text(input.payload.image_url) || text(input.payload.product_image_url),
        price: number(input.payload.price),
        currency: text(input.payload.currency) || "JPY",
        sales_test_gate: "passed",
        tracer_published: true,
        status: "promoted",
        withdrawn_at: null,
        last_received_at: new Date().toISOString(),
        metadata: input.payload,
      })
      .eq("id", promotionId);
    if (update.error) return { ok: false, detail: `promotion ledger update failed: ${update.error.message}` };
  }

  if (existingPostId) {
    return { ok: true, promotionId, postId: existingPostId, detail: "promotion already published" };
  }

  const { data: investigation } = await admin
    .from("ai_investigations")
    .select("id, persona_id")
    .eq("product_id", input.discoveryProductId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const personaId = investigation?.persona_id as string | undefined;
  if (!personaId) {
    return { ok: true, promotionId, detail: "promotion recorded; no AI resident assignment yet" };
  }

  const existingPost = await admin
    .from("ai_posts")
    .select("id")
    .eq("persona_id", personaId)
    .eq("product_url", productUrl)
    .eq("status", "published")
    .maybeSingle();
  if (existingPost.data?.id) {
    existingPostId = String(existingPost.data.id);
  } else {
    const imageUrl = text(input.payload.image_url) || text(input.payload.product_image_url);
    if (!imageUrl) return { ok: true, promotionId, detail: "promotion recorded; usable product image missing" };

    const category = text(input.payload.category) || "other";
    const caption =
      text(input.payload.discovery_reason) ||
      `${productName} — TRACERの審査を通過した注目商品。`;
    const post = await admin
      .from("ai_posts")
      .insert({
        persona_id: personaId,
        media_type: "photo",
        media_url: imageUrl,
        thumbnail_url: imageUrl,
        caption,
        category,
        product_url: productUrl,
        product_label: "TRACER PICK",
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (post.error) return { ok: false, detail: `AI resident post creation failed: ${post.error.message}` };
    existingPostId = String(post.data.id);
  }

  const link = await admin
    .from("tracer_promotions")
    .update({ ai_post_id: existingPostId, last_received_at: new Date().toISOString() })
    .eq("id", promotionId);
  if (link.error) return { ok: false, detail: `promotion post link failed: ${link.error.message}` };

  return { ok: true, promotionId, postId: existingPostId, detail: "promotion published to AI resident feed" };
}

export async function withdrawTracerPromotion(input: {
  eventId: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; withdrawn: number; detail: string }> {
  const rawUrls = Array.isArray(input.payload.product_urls)
    ? input.payload.product_urls.map(text).filter(Boolean) as string[]
    : [text(input.payload.product_url)].filter(Boolean) as string[];
  const urls = Array.from(new Set(rawUrls.flatMap((url) => [url, canonicalProductUrl(url) || url])));
  if (urls.length === 0) return { ok: false, withdrawn: 0, detail: "product_withdrawn requires product_urls" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tracer_promotions")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString(), last_received_at: new Date().toISOString() })
    .in("product_url", urls)
    .eq("status", "promoted")
    .select("id, ai_post_id");
  if (error) return { ok: false, withdrawn: 0, detail: error.message };

  const postIds = (data ?? []).map((row) => row.ai_post_id).filter((id): id is string => typeof id === "string");
  if (postIds.length > 0) {
    await admin
      .from("ai_posts")
      .update({ status: "hidden" })
      .in("id", postIds);
  }

  return { ok: true, withdrawn: data?.length ?? 0, detail: `withdrawn ${data?.length ?? 0} TRACER promotion(s)` };
}
