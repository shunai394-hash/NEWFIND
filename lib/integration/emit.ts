import { enqueueOutboxEvent } from "./outbox";
import type { NewfindOutboundEventType } from "./types";

/**
 * Emit ONLY real user actions. Callers must have verified the action succeeded
 * in NEWFIND storage. Never invent views/likes/saves/purchases from AI interest.
 */
export async function emitUserEngagement(input: {
  eventType: NewfindOutboundEventType;
  productId?: string | null;
  query?: string | null;
  userId?: string | null;
  value?: number;
  causationId?: string | null;
  metadata?: Record<string, unknown>;
  eventId?: string;
}): Promise<{ queued: boolean; deduped?: boolean; eventId?: string; reason?: string }> {
  if (input.eventType === "purchased") {
    const proof = input.metadata?.purchase_id || input.metadata?.order_id;
    if (!proof) {
      return { queued: false, reason: "no_purchase_proof" };
    }
  }

  if (input.eventType === "searched" && !input.query?.trim()) {
    return { queued: false, reason: "empty_search_query" };
  }

  if (
    (input.eventType === "viewed" ||
      input.eventType === "saved" ||
      input.eventType === "liked" ||
      input.eventType === "purchased") &&
    !input.productId?.trim()
  ) {
    return { queued: false, reason: "missing_product_id" };
  }

  const eventId =
    input.eventId ||
    [
      "nf",
      input.eventType,
      input.userId || "anon",
      input.productId || "",
      input.query || "",
      input.causationId || "",
    ]
      .join(":")
      .slice(0, 180);

  const result = await enqueueOutboxEvent({
    eventType: input.eventType,
    eventId,
    causationId: input.causationId ?? null,
    payload: {
      productId: input.productId ?? null,
      query: input.query ?? null,
      value: input.value ?? 1,
      userId: input.userId ?? null,
      metadata: input.metadata ?? {},
    },
  });

  return {
    queued: true,
    deduped: result.deduped,
    eventId: result.eventId,
  };
}
