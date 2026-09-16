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

export async function logAiActivity(input: LogAiActivityInput) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_activity_logs").insert({
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      persona_id: input.personaId ?? null,
      actor_name: input.actorName,
      actor_role: input.actorRole,
      action: input.action,
      detail: (input.detail ?? "").slice(0, 500),
      related_product_id: input.relatedProductId ?? null,
      related_run_id: input.relatedRunId ?? null,
      metadata: input.metadata ?? {},
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
