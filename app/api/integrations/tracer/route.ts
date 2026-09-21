import { NextResponse } from "next/server";
import {
  isInboundConfigured,
  normalizeInboundEventType,
  receiveInboxEvent,
  markInboxProcessed,
  markInboxFailed,
  markInboxRejected,
  processInboundEvent,
  recordIntegrationFailure,
  verifyIntegrationRequest,
  type IntegrationEnvelope,
  type AckResponse,
} from "@/lib/integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseEnvelope(body: Record<string, unknown>, headers: Headers): IntegrationEnvelope | null {
  const eventId =
    (typeof body.event_id === "string" && body.event_id) ||
    headers.get("x-tracer-event-id") ||
    headers.get("X-Tracer-Event-Id") ||
    headers.get("x-integration-id") ||
    null;
  const rawType =
    (typeof body.event_type === "string" && body.event_type) ||
    (typeof body.eventType === "string" && body.eventType) ||
    "";
  const eventType = normalizeInboundEventType(rawType);
  if (!eventId || !eventType) return null;

  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : { ...body };

  delete payload.event_id;
  delete payload.event_type;
  delete payload.eventType;
  delete payload.source;
  delete payload.event_version;
  delete payload.occurred_at;
  delete payload.causation_id;

  return {
    event_id: eventId,
    event_type: eventType,
    event_version: Number(body.event_version ?? 1) || 1,
    source: typeof body.source === "string" ? body.source : "tracer",
    occurred_at:
      (typeof body.occurred_at === "string" && body.occurred_at) ||
      new Date().toISOString(),
    causation_id:
      (typeof body.causation_id === "string" && body.causation_id) ||
      headers.get("x-tracer-idempotency-key") ||
      null,
    payload,
  };
}

export async function POST(request: Request) {
  if (!isInboundConfigured()) {
    return NextResponse.json(
      { ok: false, error: "integration secret not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const envelope = parseEnvelope(parsed, request.headers);
  if (!envelope) {
    return NextResponse.json(
      { ok: false, error: "event_id and supported event_type required" },
      { status: 400 },
    );
  }

  const auth = verifyIntegrationRequest({
    headers: request.headers,
    rawBody,
    eventId: envelope.event_id,
  });
  if (!auth.ok) {
    await recordIntegrationFailure({
      eventId: envelope.event_id,
      source: "tracer",
      destination: "newfind",
      eventType: envelope.event_type,
      attempt: 1,
      httpStatus: auth.status,
      errorCode: "auth_failed",
      errorMessage: auth.error,
    });
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let inbox;
  try {
    inbox = await receiveInboxEvent(envelope);
  } catch (err) {
    const message = err instanceof Error ? err.message : "inbox_failed";
    await recordIntegrationFailure({
      eventId: envelope.event_id,
      source: envelope.source,
      destination: "newfind",
      eventType: envelope.event_type,
      attempt: 1,
      errorCode: "inbox_insert",
      errorMessage: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  if (inbox.duplicate && inbox.row.status === "processed") {
    const ack: AckResponse = {
      ok: true,
      ack: true,
      event_id: envelope.event_id,
      inbox_id: inbox.row.id,
      status: "duplicate",
      detail: "already processed",
    };
    return NextResponse.json(ack);
  }

  if (inbox.duplicate && inbox.row.status === "rejected") {
    return NextResponse.json(
      { ok: false, error: inbox.row.last_error || "previously rejected" },
      { status: 400 },
    );
  }

  const result = await processInboundEvent({
    eventType: envelope.event_type as
      | "market_info"
      | "product_candidate"
      | "demand_info"
      | "sales_test_result",
    eventId: envelope.event_id,
    payload: envelope.payload,
    causationId: envelope.causation_id,
  });

  if (!result.ok) {
    await markInboxRejected(inbox.row.id, result.detail);
    await recordIntegrationFailure({
      eventId: envelope.event_id,
      source: envelope.source,
      destination: "newfind",
      eventType: envelope.event_type,
      attempt: 1,
      httpStatus: 400,
      errorCode: "rejected_payload",
      errorMessage: result.detail,
    });
    return NextResponse.json({ ok: false, error: result.detail }, { status: 400 });
  }

  try {
    await markInboxProcessed(inbox.row.id);
  } catch (err) {
    await markInboxFailed(
      inbox.row.id,
      err instanceof Error ? err.message : "mark_processed_failed",
    );
    return NextResponse.json({ ok: false, error: "processed but mark failed" }, { status: 500 });
  }

  const ack: AckResponse = {
    ok: true,
    ack: true,
    event_id: envelope.event_id,
    inbox_id: inbox.row.id,
    status: inbox.duplicate ? "duplicate" : "processed",
    detail: result.detail,
  };
  return NextResponse.json(ack);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "newfind-tracer-inbound",
    accepts: ["market_info", "product_candidate", "demand_info", "sales_test_result"],
    auth: ["HMAC X-Integration-*", "Bearer shared secret (legacy)"],
  });
}
