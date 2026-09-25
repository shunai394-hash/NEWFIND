import { createAdminClient } from "@/lib/supabase/admin";
import { loadRecentInvestigations } from "@/lib/ai/investigations";

export type CorrespondentActivityStatus = {
  status: "DISCOVERY" | "INVESTIGATING" | "VERIFIED";
  label: string;
  title: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<CorrespondentActivityStatus["status"], string> = {
  DISCOVERY: "DISCOVERING",
  INVESTIGATING: "INVESTIGATING",
  VERIFIED: "VERIFIED",
};

const LIVE_STATUSES = new Set(["DISCOVERY", "INVESTIGATING", "VERIFIED"]);

/**
 * "What is this correspondent doing right now" for the /correspondents
 * board, derived from real ai_investigations rows (not a decorative /
 * hardcoded status) -- the same DISCOVERY/INVESTIGATING/VERIFIED lifecycle
 * World Scouts and correspondent-watch already write to. Read-only;
 * correspondent identity itself (title/city/specialties) is untouched.
 */
export async function loadCorrespondentActivityByUsername(): Promise<
  Map<string, CorrespondentActivityStatus>
> {
  const result = new Map<string, CorrespondentActivityStatus>();
  try {
    const investigations = await loadRecentInvestigations(80);
    if (!investigations.length) return result;

    const personaIds = [...new Set(investigations.map((item) => item.personaId))];
    const admin = createAdminClient();
    const { data: personas } = await admin
      .from("ai_personas")
      .select("id, profile_id")
      .in("id", personaIds);
    if (!personas?.length) return result;

    const profileIds = [...new Set(personas.map((row) => row.profile_id))];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username")
      .in("id", profileIds);

    const usernameByProfileId = new Map(
      (profiles ?? []).map((row) => [row.id as string, row.username as string | null]),
    );
    const usernameByPersonaId = new Map(
      personas.map((row) => [
        row.id as string,
        usernameByProfileId.get(row.profile_id as string) ?? null,
      ]),
    );

    // loadRecentInvestigations is already ordered by updated_at desc, so the
    // first hit per persona is that persona's latest activity.
    for (const item of investigations) {
      if (!LIVE_STATUSES.has(item.status)) continue;
      const username = usernameByPersonaId.get(item.personaId);
      if (!username || result.has(username)) continue;
      result.set(username, {
        status: item.status as CorrespondentActivityStatus["status"],
        label: STATUS_LABEL[item.status as CorrespondentActivityStatus["status"]],
        title: item.title,
        updatedAt: item.updatedAt,
      });
    }
  } catch (error) {
    console.warn("loadCorrespondentActivityByUsername failed", error);
  }
  return result;
}
