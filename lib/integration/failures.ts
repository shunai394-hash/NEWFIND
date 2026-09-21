import { createAdminClient } from "@/lib/supabase/admin";

export async function recordIntegrationFailure(input: {
  eventId: string;
  source?: string | null;
  destination?: string | null;
  eventType: string;
  attempt: number;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  responseBody?: string | null;
}) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("integration_failures").insert({
      event_id: input.eventId,
      source: input.source ?? null,
      destination: input.destination ?? null,
      event_type: input.eventType,
      attempt: input.attempt,
      http_status: input.httpStatus ?? null,
      error_code: input.errorCode ?? null,
      error_message: (input.errorMessage ?? "").slice(0, 2000) || null,
      response_body: (input.responseBody ?? "").slice(0, 4000) || null,
    });
    if (error) {
      console.error("[integration_failures]", error.message);
    }
  } catch (err) {
    console.error(
      "[integration_failures]",
      err instanceof Error ? err.message : String(err),
    );
  }
}