import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_CATALOG, type AgentCatalogEntry } from "./catalog";
import { isAgentOsMissing } from "./store";

async function findPersonaId(
  admin: ReturnType<typeof createAdminClient>,
  entry: AgentCatalogEntry,
) {
  if (entry.personaName) {
    const byName = await admin
      .from("ai_personas")
      .select("id")
      .eq("persona_name", entry.personaName)
      .maybeSingle();
    if (byName.data?.id) return byName.data.id as string;
  }

  if (!entry.username) return null;
  const profile = await admin
    .from("profiles")
    .select("id")
    .eq("username", entry.username)
    .maybeSingle();
  if (!profile.data?.id) return null;

  const persona = await admin
    .from("ai_personas")
    .select("id")
    .eq("profile_id", profile.data.id)
    .maybeSingle();
  return (persona.data?.id as string | undefined) ?? null;
}

async function upsertAgent(
  admin: ReturnType<typeof createAdminClient>,
  entry: AgentCatalogEntry,
) {
  const personaId = await findPersonaId(admin, entry);
  const existing = await admin
    .from("ai_agents")
    .select("id, persona_id, status")
    .eq("agent_key", entry.agentKey)
    .maybeSingle();

  if (existing.error && isAgentOsMissing(existing.error.message)) {
    return { agentId: null as string | null, created: false };
  }

  const payload = {
    agent_key: entry.agentKey,
    name: entry.name,
    type: entry.type,
    role: entry.role,
    region: entry.region,
    country_code: entry.countryCode,
    beats: entry.beats,
    capabilities: entry.capabilities,
    home_app: entry.homeApp,
    persona_id: personaId,
    updated_at: new Date().toISOString(),
  };

  if (existing.data?.id) {
    const patch: Record<string, unknown> = { ...payload };
    // Keep an admin-paused agent paused; only seed paused on first insert.
    if (existing.data.status === "paused" || existing.data.status === "error") {
      delete patch.status;
    }
    const { error } = await admin
      .from("ai_agents")
      .update(patch)
      .eq("id", existing.data.id);
    if (error) throw new Error(error.message);
    return { agentId: existing.data.id as string, created: false };
  }

  const { data, error } = await admin
    .from("ai_agents")
    .insert({
      ...payload,
      status: entry.status,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { agentId: (data?.id as string | undefined) ?? null, created: true };
}

async function ensureMission(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  entry: AgentCatalogEntry,
) {
  const existing = await admin
    .from("ai_missions")
    .select("id")
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id as string;
  if (existing.error && isAgentOsMissing(existing.error.message)) return null;

  const { data, error } = await admin
    .from("ai_missions")
    .insert({
      agent_id: agentId,
      region: entry.region,
      country_code: entry.countryCode,
      beats: entry.beats,
      objective: entry.mission.objective,
      frequency: entry.mission.frequency,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

export type EnsureAgentOsResult = {
  agents: number;
  created: number;
  skipped: boolean;
};

export async function ensureAgentOs(): Promise<EnsureAgentOsResult> {
  try {
    const admin = createAdminClient();
    let created = 0;
    for (const entry of AGENT_CATALOG) {
      const upserted = await upsertAgent(admin, entry);
      if (!upserted.agentId) {
        return { agents: 0, created: 0, skipped: true };
      }
      if (upserted.created) created += 1;
      await ensureMission(admin, upserted.agentId, entry);
    }
    return { agents: AGENT_CATALOG.length, created, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) {
      return { agents: 0, created: 0, skipped: true };
    }
    throw error;
  }
}
