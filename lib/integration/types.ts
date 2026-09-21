export const INTEGRATION_SOURCES = ["newfind", "tracer"] as const;
export type IntegrationSource = (typeof INTEGRATION_SOURCES)[number];

export const TRACER_INBOUND_EVENT_TYPES = [
  "market_info",
  "product_candidate",
  "demand_info",
  "sales_test_result",
] as const;
export type TracerInboundEventType = (typeof TRACER_INBOUND_EVENT_TYPES)[number];

export const NEWFIND_OUTBOUND_EVENT_TYPES = [
  "viewed",
  "searched",
  "saved",
  "liked",
  "purchased",
] as const;
export type NewfindOutboundEventType = (typeof NEWFIND_OUTBOUND_EVENT_TYPES)[number];

export const LEGACY_TRACER_EVENT_ALIASES: Record<string, TracerInboundEventType> = {
  test_ready_opportunity: "product_candidate",
  demand_snapshot: "demand_info",
  sales_test_result: "sales_test_result",
  market_info: "market_info",
  product_candidate: "product_candidate",
  demand_info: "demand_info",
};

export type IntegrationEnvelope = {
  event_id: string;
  event_type: string;
  event_version: number;
  source: IntegrationSource | string;
  occurred_at: string;
  causation_id?: string | null;
  payload: Record<string, unknown>;
};

export type OutboxStatus = "pending" | "sending" | "delivered" | "failed" | "dead";
export type InboxStatus = "received" | "processing" | "processed" | "rejected" | "failed";

export type OutboxRow = {
  id: string;
  event_id: string;
  destination: string;
  event_type: string;
  event_version: number;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  causation_id: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
};

export type InboxRow = {
  id: string;
  source: string;
  event_id: string;
  event_type: string;
  event_version: number;
  payload: Record<string, unknown>;
  status: InboxStatus;
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
};

export type AckResponse = {
  ok: true;
  ack: true;
  event_id: string;
  inbox_id?: string;
  status: "processed" | "duplicate" | "queued";
  detail?: string;
};

export function isTracerInboundType(value: string): value is TracerInboundEventType {
  return (TRACER_INBOUND_EVENT_TYPES as readonly string[]).includes(value);
}

export function normalizeInboundEventType(raw: string): TracerInboundEventType | null {
  const key = raw.trim();
  if (!key) return null;
  if (isTracerInboundType(key)) return key;
  return LEGACY_TRACER_EVENT_ALIASES[key] ?? null;
}
