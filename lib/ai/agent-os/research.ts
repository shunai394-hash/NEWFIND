import type { AiPersona } from "@/lib/ai-post-engine";
import type { WorldSearchResult } from "@/lib/ai/world-search";
import type { ProductHunterCandidate } from "@/lib/ai/product-hunter";
import { catalogEntryForPersonaName, catalogEntryForUsername } from "./catalog";
import { hashSourceUrl } from "./hash";
import {
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
  AgentResearchSession,
  FindingEntityType,
  ResearchRunStatus,
  VerificationStatus,
} from "./types";
import { EMPTY_AGENT_MEMORY } from "./types";

const MAX_SOURCES_PER_RUN = 30;

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
      metadata: { beatKey: catalog?.beats?.[0] ?? agent.beats[0] ?? null },
    });

    return {
      available: Boolean(runId),
      agent,
      mission,
      runId,
      memory,
    };
  } catch (error) {
    console.warn("begin agent research failed", error);
    return empty;
  }
}

export async function recordCheckedSources(
  session: AgentResearchSession,
  results: WorldSearchResult[],
) {
  if (!session.available || !session.runId || !session.agent) {
    return new Map<string, string>();
  }
  const rows = results.slice(0, MAX_SOURCES_PER_RUN).map((result) => ({
    runId: session.runId as string,
    agentId: session.agent!.id,
    sourceUrl: result.url,
    sourceName: result.domain || result.title,
    sourceType: result.sourceType,
    publishedAt: result.publishedAt ?? null,
    title: result.title,
    snippet: result.snippet,
  }));
  try {
    return await insertResearchSources(rows);
  } catch (error) {
    console.warn("record research sources failed", error);
    return new Map<string, string>();
  }
}

export async function recordProductFinding(input: {
  session: AgentResearchSession;
  candidate?: ProductHunterCandidate | null;
  title: string;
  description?: string;
  sourceUrl?: string | null;
  sourceIdsByHash?: Map<string, string>;
  status: VerificationStatus;
  reason?: string | null;
  destinationId?: string | null;
  entityType?: FindingEntityType;
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
    description: input.description ?? input.candidate?.description ?? "",
    region: input.session.mission?.region ?? input.session.agent.region,
    category: input.candidate?.category ?? null,
    confidence: input.candidate?.confidenceScore ?? 0,
    status: input.status,
    verificationSources: input.sourceUrl ? [input.sourceUrl] : [],
    verificationReason: input.reason ?? null,
    destinationApp: input.destinationId ? "newfind" : null,
    destinationKind: input.destinationId ? "discovery_product" : null,
    destinationId: input.destinationId ?? null,
    metadata: input.candidate
      ? {
          brand: input.candidate.brand,
          productName: input.candidate.productName,
          origin: input.candidate.origin,
        }
      : {},
  });
}

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
