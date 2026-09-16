import { createAdminClient } from "@/lib/supabase/admin";
import { hashSourceUrl } from "./hash";
import type {
  AgentMemory,
  AgentRecord,
  AgentStatus,
  FindingEntityType,
  HandoffStatus,
  HomeApp,
  MissionRecord,
  ResearchRunStatus,
  VerificationStatus,
} from "./types";
import { EMPTY_AGENT_MEMORY } from "./types";

export function isAgentOsMissing(message: string) {
  return /ai_agents|ai_missions|ai_research_|ai_findings|ai_handoffs|42P01|42703|schema cache/i.test(
    message,
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapAgent(row: Record<string, unknown>): AgentRecord {
  return {
    id: String(row.id),
    agentKey: String(row.agent_key ?? ""),
    name: String(row.name ?? ""),
    type: (row.type as AgentRecord["type"]) || "world_scout",
    role: String(row.role ?? ""),
    region: String(row.region ?? ""),
    countryCode: (row.country_code as string | null) ?? null,
    beats: asStringArray(row.beats),
    status: (row.status as AgentStatus) || "active",
    capabilities: asStringArray(row.capabilities),
    personaId: (row.persona_id as string | null) ?? null,
    homeApp: (row.home_app as HomeApp) || "newfind",
    lastRunAt: (row.last_run_at as string | null) ?? null,
    lastActionAt: (row.last_action_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapMission(row: Record<string, unknown>): MissionRecord {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    region: String(row.region ?? ""),
    countryCode: (row.country_code as string | null) ?? null,
    beats: asStringArray(row.beats),
    objective: String(row.objective ?? ""),
    frequency: String(row.frequency ?? "daily"),
    isActive: Boolean(row.is_active),
  };
}

export async function findAgentByPersonaId(personaId: string) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_agents")
      .select(
        "id, agent_key, name, type, role, region, country_code, beats, status, capabilities, persona_id, home_app, last_run_at, last_action_at, created_at",
      )
      .eq("persona_id", personaId)
      .maybeSingle();
    if (error) {
      if (isAgentOsMissing(error.message)) return null;
      throw new Error(error.message);
    }
    return data ? mapAgent(data as Record<string, unknown>) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return null;
    throw error;
  }
}

export async function findAgentByKey(agentKey: string) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_agents")
      .select(
        "id, agent_key, name, type, role, region, country_code, beats, status, capabilities, persona_id, home_app, last_run_at, last_action_at, created_at",
      )
      .eq("agent_key", agentKey)
      .maybeSingle();
    if (error) {
      if (isAgentOsMissing(error.message)) return null;
      throw new Error(error.message);
    }
    return data ? mapAgent(data as Record<string, unknown>) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return null;
    throw error;
  }
}

export async function loadActiveMission(agentId: string) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_missions")
      .select(
        "id, agent_id, region, country_code, beats, objective, frequency, is_active",
      )
      .eq("agent_id", agentId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isAgentOsMissing(error.message)) return null;
      throw new Error(error.message);
    }
    return data ? mapMission(data as Record<string, unknown>) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return null;
    throw error;
  }
}

export async function loadAgentMemory(agentId: string): Promise<AgentMemory> {
  try {
    const admin = createAdminClient();
    const [runs, sources, findings] = await Promise.all([
      admin
        .from("ai_research_runs")
        .select("metadata")
        .eq("agent_id", agentId)
        .order("started_at", { ascending: false })
        .limit(5),
      admin
        .from("ai_research_sources")
        .select("source_url")
        .eq("agent_id", agentId)
        .order("discovered_at", { ascending: false })
        .limit(20),
      admin
        .from("ai_findings")
        .select("title, status")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (runs.error && isAgentOsMissing(runs.error.message)) {
      return EMPTY_AGENT_MEMORY;
    }

    const recentQueries: string[] = [];
    for (const row of runs.data ?? []) {
      const meta = (row.metadata ?? {}) as { queries?: unknown };
      for (const query of asStringArray(meta.queries)) {
        if (!recentQueries.includes(query)) recentQueries.push(query);
      }
    }

    const recentSources = (sources.data ?? [])
      .map((row) => String(row.source_url ?? ""))
      .filter(Boolean);

    const findingRows = findings.data ?? [];
    const recentFindings = findingRows
      .filter((row) => row.status === "verified" || row.status === "needs_review")
      .map((row) => String(row.title ?? ""))
      .filter(Boolean);
    const recentRejections = findingRows
      .filter((row) => row.status === "rejected")
      .map((row) => String(row.title ?? ""))
      .filter(Boolean);
    const recentDuplicates = findingRows
      .filter((row) => row.status === "duplicate")
      .map((row) => String(row.title ?? ""))
      .filter(Boolean);

    return {
      recentQueries: recentQueries.slice(0, 12),
      recentSources: recentSources.slice(0, 20),
      recentFindings: recentFindings.slice(0, 12),
      recentRejections: recentRejections.slice(0, 12),
      recentDuplicates: recentDuplicates.slice(0, 12),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return EMPTY_AGENT_MEMORY;
    console.warn("agent memory unavailable", message);
    return EMPTY_AGENT_MEMORY;
  }
}

export async function insertResearchRun(input: {
  agentId: string;
  missionId: string | null;
  engineRunId: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_research_runs")
    .insert({
      agent_id: input.agentId,
      mission_id: input.missionId,
      engine_run_id: input.engineRunId,
      status: "running",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) {
    if (isAgentOsMissing(error.message)) return null;
    throw new Error(error.message);
  }
  await admin
    .from("ai_agents")
    .update({
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.agentId);
  return (data?.id as string | undefined) ?? null;
}

export async function finishResearchRun(input: {
  runId: string;
  agentId: string;
  status: ResearchRunStatus;
  queriesCount: number;
  sourcesChecked: number;
  findingsCount: number;
  verifiedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const finishedAt = new Date().toISOString();
  const { error } = await admin
    .from("ai_research_runs")
    .update({
      status: input.status,
      finished_at: finishedAt,
      queries_count: input.queriesCount,
      sources_checked: input.sourcesChecked,
      findings_count: input.findingsCount,
      verified_count: input.verifiedCount,
      rejected_count: input.rejectedCount,
      duplicate_count: input.duplicateCount,
      error: input.error ?? null,
      metadata: input.metadata ?? {},
    })
    .eq("id", input.runId);
  if (error && !isAgentOsMissing(error.message)) {
    console.warn("finish research run failed", error.message);
  }

  const agentStatus: AgentStatus =
    input.status === "failed" ? "error" : "active";
  await admin
    .from("ai_agents")
    .update({
      last_action_at: finishedAt,
      status: agentStatus,
      updated_at: finishedAt,
    })
    .eq("id", input.agentId);
}

export async function insertResearchSources(
  input: {
    runId: string;
    agentId: string;
    sourceUrl: string;
    sourceName?: string | null;
    sourceType?: string;
    publishedAt?: string | null;
    title?: string | null;
    snippet?: string | null;
  }[],
) {
  if (input.length === 0) return new Map<string, string>();
  const admin = createAdminClient();
  const unique = new Map<string, (typeof input)[number]>();
  for (const item of input) {
    const hash = hashSourceUrl(item.sourceUrl);
    if (!hash || unique.has(hash)) continue;
    unique.set(hash, item);
  }

  const rows = [...unique.entries()].map(([sourceHash, item]) => ({
    run_id: item.runId,
    agent_id: item.agentId,
    source_url: item.sourceUrl,
    source_name: item.sourceName ?? null,
    source_type: item.sourceType ?? "other",
    published_at: item.publishedAt ?? null,
    source_hash: sourceHash,
    title: item.title ?? null,
    snippet: (item.snippet ?? "").slice(0, 500),
  }));

  const { data, error } = await admin
    .from("ai_research_sources")
    .insert(rows)
    .select("id, source_hash");

  if (error) {
    if (isAgentOsMissing(error.message) || /duplicate|23505/i.test(error.message)) {
      const existing = await admin
        .from("ai_research_sources")
        .select("id, source_hash")
        .eq("run_id", input[0]?.runId)
        .in("source_hash", [...unique.keys()]);
      return new Map(
        (existing.data ?? []).map((row) => [
          String(row.source_hash),
          String(row.id),
        ]),
      );
    }
    console.warn("insert research sources failed", error.message);
    return new Map<string, string>();
  }

  return new Map(
    (data ?? []).map((row) => [String(row.source_hash), String(row.id)]),
  );
}

export async function insertFinding(input: {
  runId: string | null;
  sourceId: string | null;
  agentId: string | null;
  entityType: FindingEntityType;
  title: string;
  description: string;
  region?: string | null;
  category?: string | null;
  confidence: number;
  status: VerificationStatus;
  verificationSources?: string[];
  verificationReason?: string | null;
  destinationApp?: HomeApp | null;
  destinationKind?: string | null;
  destinationId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    const verified = input.status === "verified";
    const { data, error } = await admin
      .from("ai_findings")
      .insert({
        run_id: input.runId,
        source_id: input.sourceId,
        agent_id: input.agentId,
        entity_type: input.entityType,
        title: input.title,
        description: input.description.slice(0, 2000),
        region: input.region ?? null,
        category: input.category ?? null,
        confidence: input.confidence,
        status: input.status,
        verification_status: input.status,
        verified_at: verified ? new Date().toISOString() : null,
        verification_sources: input.verificationSources ?? [],
        verification_reason: input.verificationReason ?? null,
        destination_app: input.destinationApp ?? null,
        destination_kind: input.destinationKind ?? null,
        destination_id: input.destinationId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();
    if (error) {
      if (isAgentOsMissing(error.message)) return null;
      console.warn("insert finding failed", error.message);
      return null;
    }
    return (data?.id as string | undefined) ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return null;
    console.warn("insert finding failed", message);
    return null;
  }
}

export async function insertHandoff(input: {
  fromAgentId: string | null;
  toAgentId?: string | null;
  toPersonaId?: string | null;
  findingId: string | null;
  reason: string;
  status: HandoffStatus;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("ai_handoffs")
      .insert({
        from_agent_id: input.fromAgentId,
        to_agent_id: input.toAgentId ?? null,
        to_persona_id: input.toPersonaId ?? null,
        finding_id: input.findingId,
        reason: input.reason.slice(0, 500),
        status: input.status,
        completed_at: input.status === "completed" ? now : null,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();
    if (error) {
      if (isAgentOsMissing(error.message)) return null;
      console.warn("insert handoff failed", error.message);
      return null;
    }
    return (data?.id as string | undefined) ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return null;
    console.warn("insert handoff failed", message);
    return null;
  }
}
