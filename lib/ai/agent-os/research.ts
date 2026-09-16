import type { AiPersona } from "@/lib/ai-post-engine";
import { catalogEntryForPersonaName, catalogEntryForUsername } from "./catalog";
import { hashSourceUrl } from "./hash";
import { sourceQualityFromType } from "./quality";
import {
  findAgentById,
  findAgentByKey,
  findAgentByPersonaId,
  finishResearchRun,
  insertFinding,
  insertHandoff,
  insertResearchRun,
  insertResearchSources,
  loadActiveMission,
  loadAgentMemory,
} from "./store";
import type {
  AgentRecord,
  AgentResearchSession,
  FindingEntityType,
  ResearchRunStatus,
  ResearchSourceInput,
  VerificationStatus,
} from "./types";
import { EMPTY_AGENT_MEMORY } from "./types";

const MAX_SOURCES_PER_RUN = 30;

async function openResearchSession(
  agent: AgentRecord,
  engineRunId?: string | null,
): Promise<AgentResearchSession> {
  if (agent.status === "paused") {
    return {
      available: true,
      agent,
      mission: await loadActiveMission(agent.id),
      runId: null,
      memory: EMPTY_AGENT_MEMORY,
    };
  }

  const mission = await loadActiveMission(agent.id);
  const memory = await loadAgentMemory(agent.id);
  const runId = await insertResearchRun({
    agentId: agent.id,
    missionId: mission?.id ?? null,
    engineRunId: engineRunId ?? null,
    metadata: {
      beatKey: agent.beats[0] ?? null,
      objective: mission?.objective ?? null,
    },
  });

  return {
    available: Boolean(runId),
    agent,
    mission,
    runId,
    memory,
  };
}

export async function beginResearchSession(input: {
  agentId: string;
  engineRunId?: string | null;
}): Promise<AgentResearchSession> {
  const empty: AgentResearchSession = {
    available: false,
    agent: null,
    mission: null,
    runId: null,
    memory: EMPTY_AGENT_MEMORY,
  };
  try {
    const agent = await findAgentById(input.agentId);
    if (!agent) return empty;
    return openResearchSession(agent, input.engineRunId);
  } catch (error) {
    console.warn("begin research session failed", error);
    return empty;
  }
}

export async function beginAgentResearch(
  persona: AiPersona,
  engineRunId?: string | null,
): Promise<AgentResearchSession> {
  const empty: AgentResearchSession = {
    available: false,
    agent: null,
    mission: null,
    runId: null,
    memory: EMPTY_AGENT_MEMORY,
  };

  try {
    const catalog =
      catalogEntryForUsername(persona.username) ||
      catalogEntryForPersonaName(persona.persona_name);
    const agent =
      (await findAgentByPersonaId(persona.id)) ||
      (catalog ? await findAgentByKey(catalog.agentKey) : null);
    if (!agent) return empty;
    return openResearchSession(agent, engineRunId);
  } catch (error) {
    console.warn("begin agent research failed", error);
    return empty;
  }
}

export async function recordCheckedSources(
  session: AgentResearchSession,
  sources: ResearchSourceInput[],
) {
  if (!session.available || !session.runId || !session.agent) {
    return new Map<string, string>();
  }
  const rows = sources.slice(0, MAX_SOURCES_PER_RUN).map((source) => ({
    runId: session.runId as string,
    agentId: session.agent!.id,
    sourceUrl: source.sourceUrl,
    sourceName: source.sourceName ?? null,
    sourceType: source.sourceType ?? "other",
    publishedAt: source.publishedAt ?? null,
    title: source.title ?? null,
    snippet: source.snippet ?? null,
    sourceQuality: sourceQualityFromType(source.sourceType),
  }));
  try {
    return await insertResearchSources(rows);
  } catch (error) {
    console.warn("record research sources failed", error);
    return new Map<string, string>();
  }
}

export async function recordFinding(input: {
  session: AgentResearchSession;
  title: string;
  description?: string;
  sourceUrl?: string | null;
  sourceIdsByHash?: Map<string, string>;
  status: VerificationStatus;
  reason?: string | null;
  entityType?: FindingEntityType;
  category?: string | null;
  confidence?: number;
  destinationApp?: "newfind" | "pricesense" | null;
  destinationKind?: string | null;
  destinationId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!input.session.available || !input.session.agent) return null;
  const sourceId =
    input.sourceUrl && input.sourceIdsByHash
      ? input.sourceIdsByHash.get(hashSourceUrl(input.sourceUrl)) ?? null
      : null;
  return insertFinding({
    runId: input.session.runId,
    sourceId,
    agentId: input.session.agent.id,
    entityType: input.entityType ?? "product",
    title: input.title,
    description: input.description ?? "",
    region: input.session.mission?.region ?? input.session.agent.region,
    category: input.category ?? null,
    confidence: input.confidence ?? 0,
    status: input.status,
    verificationSources: input.sourceUrl ? [input.sourceUrl] : [],
    verificationReason: input.reason ?? null,
    destinationApp: input.destinationApp ?? null,
    destinationKind: input.destinationKind ?? null,
    destinationId: input.destinationId ?? null,
    metadata: input.metadata ?? {},
  });
}

/** @deprecated Use recordFinding. Kept for existing NEWFIND call sites. */
export const recordProductFinding = recordFinding;

/** NEWFIND destination adapter: hand off a finding to a resident persona. */
export async function recordResidentHandoff(input: {
  session: AgentResearchSession;
  findingId: string | null;
  toPersonaId: string | null;
  toPersonaName: string | null;
  title: string;
}) {
  if (!input.session.available || !input.session.agent) return null;
  const status = input.toPersonaId ? "completed" : "pending";
  return insertHandoff({
    fromAgentId: input.session.agent.id,
    toPersonaId: input.toPersonaId,
    findingId: input.findingId,
    reason: input.toPersonaName
      ? `${input.title} → ${input.toPersonaName}`
      : `${input.title} waiting for a matching resident`,
    status,
    metadata: {
      toPersonaName: input.toPersonaName,
      destinationApp: "newfind",
      destinationKind: "resident",
    },
  });
}

export async function completeAgentResearch(input: {
  session: AgentResearchSession;
  queries: string[];
  sourcesChecked: number;
  findingsCount: number;
  verifiedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  noAction: boolean;
  error?: string | null;
}) {
  if (!input.session.runId || !input.session.agent) return;
  const status: ResearchRunStatus = input.error
    ? "failed"
    : input.noAction
      ? "no_action"
      : "success";
  try {
    await finishResearchRun({
      runId: input.session.runId,
      agentId: input.session.agent.id,
      status,
      queriesCount: input.queries.length,
      sourcesChecked: input.sourcesChecked,
      findingsCount: input.findingsCount,
      verifiedCount: input.verifiedCount,
      rejectedCount: input.rejectedCount,
      duplicateCount: input.duplicateCount,
      error: input.error ?? null,
      metadata: {
        queries: input.queries,
        beatKey: input.session.mission?.beats[0] ?? null,
        objective: input.session.mission?.objective ?? null,
      },
    });
  } catch (error) {
    console.warn("complete agent research failed", error);
  }
}
