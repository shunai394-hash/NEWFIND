import { createAdminClient } from "@/lib/supabase/admin";
import type { ActivityAction } from "./types";

export type LogAiActivityInput = {
  personaId?: string | null;
  actorName: string;
  actorRole: string;
  action: ActivityAction | string;
  detail?: string;
  relatedProductId?: string | null;
  relatedRunId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

function uuidOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

export async function logAiActivity(input: LogAiActivityInput) {
  try {
    const admin = createAdminClient();
    const relatedRunId = uuidOrNull(input.relatedRunId);
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.relatedRunId && !relatedRunId ? { related_run_id_input: input.relatedRunId } : {}),
    };
    const { error } = await admin.from("ai_activity_logs").insert({
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      persona_id: input.personaId ?? null,
      actor_name: input.actorName,
      actor_role: input.actorRole,
      action: input.action,
      detail: (input.detail ?? "").slice(0, 500),
      related_product_id: input.relatedProductId ?? null,
      related_run_id: relatedRunId,
      metadata,
    });
    if (error && /ai_activity_logs|42P01|42703/i.test(error.message)) {
      return;
    }
    if (error) {
      console.warn("ai_activity_logs insert failed", error.message);
    }
  } catch (error) {
    console.warn("ai_activity_logs unavailable", error);
  }
}
