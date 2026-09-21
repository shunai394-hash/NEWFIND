import { createAdminClient } from "@/lib/supabase/admin";
import type { InboxRow, IntegrationEnvelope } from "./types";

function mapInbox(row: Record<string, unknown>): InboxRow {
  return {
    id: String(row.id),
    source: String(row.source),
    event_id: String(row.event_id),
    event_type: String(row.event_type),
    event_version: Number(row.event_version ?? 1),
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as InboxRow["status"],
    received_at: String(row.received_at ?? ""),
    processed_at: (row.processed_at as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
  };
}

export async function receiveInboxEvent(
  envelope: IntegrationEnvelope,
): Promise<{ row: InboxRow; duplicate: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_inbox")
    .insert({
      source: envelope.source,
      event_id: envelope.event_id,
      event_type: envelope.event_type,
      event_version: envelope.event_version,
      payload: {
        ...envelope.payload,
        _envelope: {
          occurred_at: envelope.occurred_at,
          causation_id: envelope.causation_id ?? null,
        },
      },
      status: "received",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await admin
        .from("integration_inbox")
        .select("*")
        .eq("source", envelope.source)
        .eq("event_id", envelope.event_id)
        .maybeSingle();
      if (existing.data) {
        return {
          row: mapInbox(existing.data as Record<string, unknown>),
          duplicate: true,
        };
      }
    }
    throw new Error(error.message);
  }

  return { row: mapInbox(data as Record<string, unknown>), duplicate: false };
}

export async function markInboxProcessed(id: string) {
  const admin = createAdminClient();
  await admin
    .from("integration_inbox")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", id);
}

export async function markInboxFailed(id: string, message: string) {
  const admin = createAdminClient();
  await admin
    .from("integration_inbox")
    .update({
      status: "failed",
      last_error: message.slice(0, 2000),
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function markInboxRejected(id: string, message: string) {
  const admin = createAdminClient();
  await admin
    .from("integration_inbox")
    .update({
      status: "rejected",
      last_error: message.slice(0, 2000),
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
}