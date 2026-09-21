import { getIntegrationConfig, isOutboundConfigured } from "./config";
import { buildSignedHeaders, headersFromSigned } from "./auth";
import {
  claimOutboxBatch,
  markOutboxDelivered,
  markOutboxFailure,
  markOutboxSending,
} from "./outbox";
import type { OutboxRow } from "./types";

function tracerEventType(newfindType: string): string {
  // TRACER ingest currently expects view/search/save/like/purchase
  switch (newfindType) {
    case "viewed":
      return "view";
    case "searched":
      return "search";
    case "saved":
      return "save";
    case "liked":
      return "like";
    case "purchased":
      return "purchase";
    default:
      return newfindType;
  }
}

function buildTracerBody(row: OutboxRow) {
  const payload = row.payload ?? {};
  const observedAt =
    (payload.occurred_at as string) ||
    (payload.observedAt as string) ||
    row.created_at;
  return {
    events: [
      {
        productId:
          (payload.productId as string | null | undefined) ??
          (payload.product_id as string | null | undefined) ??
          null,
        query: (payload.query as string | null | undefined) ?? null,
        eventType: tracerEventType(row.event_type),
        value: Number(payload.value ?? 1),
        observedAt,
        idempotencyKey: row.event_id,
        metadata: {
          source: "newfind",
          event_id: row.event_id,
          event_type: row.event_type,
          event_version: row.event_version,
          causation_id: row.causation_id,
          ...(typeof payload.metadata === "object" && payload.metadata
            ? (payload.metadata as Record<string, unknown>)
            : {}),
        },
      },
    ],
  };
}

function responseLooksLikeAck(status: number, body: unknown): boolean {
  if (status < 200 || status >= 300) return false;
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;
  if (obj.ok === true && obj.ack === true) return true;
  // TRACER current contract: { ok: true, result: { accepted, ... } }
  if (obj.ok === true && obj.result && typeof obj.result === "object") {
    const result = obj.result as Record<string, unknown>;
    const accepted = Number(result.accepted ?? 0);
    const deduped = Number(result.deduped ?? 0);
    const rejected = Number(result.rejected ?? 0);
    // Accepted or idempotent duplicate counts as delivered ACK.
    // Rejected-only is NOT delivered.
    if (accepted > 0 || deduped > 0) return true;
    if (rejected > 0 && accepted === 0 && deduped === 0) return false;
  }
  return false;
}

async function deliverOne(row: OutboxRow): Promise<"delivered" | "failed" | "skipped"> {
  const cfg = getIntegrationConfig();
  if (!cfg.tracerIngestUrl || !cfg.sharedSecret) return "skipped";

  await markOutboxSending(row.id);
  const bodyObj = buildTracerBody(row);
  const rawBody = JSON.stringify(bodyObj);
  const signed = buildSignedHeaders({ eventId: row.event_id, rawBody });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...headersFromSigned(signed),
    // Legacy TRACER auth while HMAC rolls out
    Authorization: `Bearer ${cfg.sharedSecret}`,
    "X-Newfind-Secret": cfg.sharedSecret,
  };

  let status: number | null = null;
  let responseText = "";
  let parsed: unknown = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(cfg.tracerIngestUrl, {
      method: "POST",
      headers,
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    status = response.status;
    responseText = await response.text();
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = null;
    }
  } catch (err) {
    await markOutboxFailure({
      row,
      httpStatus: null,
      errorCode: "timeout_or_network",
      errorMessage: err instanceof Error ? err.message : "delivery_failed",
      responseBody: null,
    });
    return "failed";
  }

  if (responseLooksLikeAck(status, parsed)) {
    await markOutboxDelivered(row.id);
    return "delivered";
  }

  await markOutboxFailure({
    row,
    httpStatus: status,
    errorCode: "no_ack",
    errorMessage: `HTTP ${status} without valid ACK`,
    responseBody: responseText,
  });
  return "failed";
}

export async function drainOutbox(limit = 20): Promise<{
  attempted: number;
  delivered: number;
  failed: number;
  skipped: number;
  configured: boolean;
}> {
  if (!isOutboundConfigured()) {
    return { attempted: 0, delivered: 0, failed: 0, skipped: 0, configured: false };
  }

  const batch = await claimOutboxBatch(limit);
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of batch) {
    const result = await deliverOne(row);
    if (result === "delivered") delivered += 1;
    else if (result === "failed") failed += 1;
    else skipped += 1;
  }

  return {
    attempted: batch.length,
    delivered,
    failed,
    skipped,
    configured: true,
  };
}