import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrationConfig } from "./config";
import { nextRetryAt, isPermanentHttpStatus, isRetryableHttpStatus } from "./retry";
import { recordIntegrationFailure } from "./failures";
import type { IntegrationEnvelope, NewfindOutboundEventType, OutboxRow } from "./types";

function mapOutbox(row: Record<string, unknown>): OutboxRow {
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    destination: String(row.destination),
    event_type: String(row.event_type),
    event_version: Number(row.event_version ?? 1),
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as OutboxRow["status"],
    attempts: Number(row.attempts ?? 0),
    next_retry_at: (row.next_retry_at as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
    causation_id: (row.causation_id as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    sent_at: (row.sent_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
  };
}

export function buildOutboundEnvelope(input: {
  eventType: NewfindOutboundEventType;
  payload: Record<string, unknown>;
  eventId?: string;
  causationId?: string | null;
  occurredAt?: string;
}): IntegrationEnvelope {
  return {
    event_id: input.eventId ?? crypto.randomUUID(),
    event_type: input.eventType,
    event_version: 1,
    source: "newfind",
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    causation_id: input.causationId ?? null,
    payload: input.payload,
  };
}

/**
 * Enqueue a real user event for TRACER. Never invents events.
 * Idempotent on (destination, event_id).
 */
export async function enqueueOutboxEvent(input: {
  eventType: NewfindOutboundEventType;
  payload: Record<string, unknown>;
  eventId?: string;
  causationId?: string | null;
  destination?: string;
  occurredAt?: string;
}): Promise<{ id: string; eventId: string; deduped: boolean; status: string }> {
  const admin = createAdminClient();
  const envelope = buildOutboundEnvelope(input);
  const destination = input.destination ?? "tracer";

  const { data, error } = await admin
    .from("integration_outbox")
    .insert({
      event_id: envelope.event_id,
      destination,
      event_type: envelope.event_type,
      event_version: envelope.event_version,
      payload: {
        ...envelope,
        // Keep flat fields TRACER ingest also understands
        productId: input.payload.productId ?? input.payload.product_id ?? null,
        query: input.payload.query ?? null,
        value: input.payload.value ?? 1,
        observedAt: envelope.occurred_at,
        metadata: input.payload.metadata ?? {},
      },
      status: "pending",
      attempts: 0,
      causation_id: envelope.causation_id ?? null,
      next_retry_at: new Date().toISOString(),
    })
    .select("id, event_id, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await admin
        .from("integration_outbox")
        .select("id, event_id, status")
        .eq("destination", destination)
        .eq("event_id", envelope.event_id)
        .maybeSingle();
      if (existing.data) {
        return {
          id: String(existing.data.id),
          eventId: String(existing.data.event_id),
          deduped: true,
          status: String(existing.data.status),
        };
      }
    }
    throw new Error(error.message);
  }

  return {
    id: String(data.id),
    eventId: String(data.event_id),
    deduped: false,
    status: String(data.status),
  };
}

export async function claimOutboxBatch(limit = 20): Promise<OutboxRow[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("integration_outbox")
    .select("*")
    .in("status", ["pending", "failed"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOutbox(row as Record<string, unknown>));
}

export async function markOutboxSending(id: string) {
  const admin = createAdminClient();
  await admin
    .from("integration_outbox")
    .update({ status: "sending", sent_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "failed"]);
}

export async function markOutboxDelivered(id: string) {
  const admin = createAdminClient();
  await admin
    .from("integration_outbox")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      last_error: null,
      next_retry_at: null,
    })
    .eq("id", id);
}

export async function markOutboxFailure(input: {
  row: OutboxRow;
  httpStatus?: number | null;
  errorMessage: string;
  responseBody?: string | null;
  errorCode?: string | null;
}) {
  const cfg = getIntegrationConfig();
  const attempts = input.row.attempts + 1;
  const permanent = isPermanentHttpStatus(input.httpStatus);
  const retryable = !permanent && isRetryableHttpStatus(input.httpStatus);
  const dead = permanent || attempts >= cfg.maxAttempts || !retryable;
  const admin = createAdminClient();

  await admin
    .from("integration_outbox")
    .update({
      status: dead ? "dead" : "failed",
      attempts,
      last_error: input.errorMessage.slice(0, 2000),
      next_retry_at: dead ? null : nextRetryAt(attempts).toISOString(),
    })
    .eq("id", input.row.id);

  await recordIntegrationFailure({
    eventId: input.row.event_id,
    source: "newfind",
    destination: input.row.destination,
    eventType: input.row.event_type,
    attempt: attempts,
    httpStatus: input.httpStatus ?? null,
    errorCode: input.errorCode ?? (dead ? "dead" : "retry"),
    errorMessage: input.errorMessage,
    responseBody: input.responseBody ?? null,
  });
}

/** Re-queue a dead/failed event for manual resend. */
export async function requeueOutboxEvent(eventId: string, destination = "tracer") {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_outbox")
    .update({
      status: "pending",
      next_retry_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("destination", destination)
    .eq("event_id", eventId)
    .in("status", ["failed", "dead"])
    .select("id, event_id, status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}