/**
 * Decision / drop-off trace for resident, scout, hunter, and sales-quality flows.
 * Stored on existing ai_activity_logs.metadata and engine result_summary — no new table.
 */

export const PIPELINE_EVENTS = [
  "SEARCH_STARTED",
  "SEARCH_COMPLETED",
  "CANDIDATES_FOUND",
  "CLASSIFICATION_COMPLETED",
  "QUALITY_CHECK_COMPLETED",
  "AI_DECISION_COMPLETED",
  "SAVE_COMPLETED",
  "POST_COMPLETED",
  "REACTION_COMPLETED",
  "MEMORY_UPDATED",
  "MISSION_COMPLETED",
] as const;

export type PipelineEvent = (typeof PIPELINE_EVENTS)[number];

export const DROP_OFF_REASONS = [
  "SEARCH_FAILED",
  "NO_SEARCH_RESULTS",
  "SOURCE_CLASSIFICATION_FAILED",
  "NOT_PRODUCT",
  "NOT_LIVE_PRODUCT",
  "SPECIALTY_MISMATCH",
  "LOW_CONFIDENCE",
  "LOW_EVIDENCE",
  "NO_PRODUCT_IMAGE",
  "NO_PRODUCT_DESCRIPTION",
  "DUPLICATE",
  "RECENTLY_SEEN",
  "AI_REJECTED",
  "QUALITY_REJECTED",
  "CONFIDENCE_REJECTED",
  "NOT_RELEVANT",
  "WEAK_SOURCE",
  "WAIT",
  "RATE_LIMITED",
  "SAVED",
  "POSTED",
] as const;

export type DropOffReason = (typeof DROP_OFF_REASONS)[number];

export type PipelineFunnel = {
  searchResults: number;
  productCandidates: number;
  newsCandidates: number;
  generalCandidates: number;
  liveProducts: number;
  specialtyPass: number;
  qualityPass: number;
  aiSelected: number;
  saved: number;
  posted: number;
  reactions: number;
  duplicates: number;
  dropoffs: Partial<Record<DropOffReason, number>>;
};

export type PipelineDrop = {
  url?: string;
  title?: string;
  reason: DropOffReason;
  detail?: string;
};

export type PipelineTrace = {
  runId?: string | null;
  personaId?: string | null;
  actorName: string;
  actorRole: string;
  query?: string;
  events: PipelineEvent[];
  funnel: PipelineFunnel;
  drops: PipelineDrop[];
};

export function emptyFunnel(): PipelineFunnel {
  return {
    searchResults: 0,
    productCandidates: 0,
    newsCandidates: 0,
    generalCandidates: 0,
    liveProducts: 0,
    specialtyPass: 0,
    qualityPass: 0,
    aiSelected: 0,
    saved: 0,
    posted: 0,
    reactions: 0,
    duplicates: 0,
    dropoffs: {},
  };
}

export function createPipelineTrace(input: {
  actorName: string;
  actorRole: string;
  runId?: string | null;
  personaId?: string | null;
  query?: string;
}): PipelineTrace {
  return {
    runId: input.runId ?? null,
    personaId: input.personaId ?? null,
    actorName: input.actorName,
    actorRole: input.actorRole,
    query: input.query,
    events: [],
    funnel: emptyFunnel(),
    drops: [],
  };
}

export function markPipelineEvent(trace: PipelineTrace, event: PipelineEvent) {
  if (!trace.events.includes(event)) trace.events.push(event);
}

export function recordDrop(trace: PipelineTrace, drop: PipelineDrop) {
  trace.drops.push(drop);
  const current = trace.funnel.dropoffs[drop.reason] ?? 0;
  trace.funnel.dropoffs[drop.reason] = current + 1;
}

export function classifySearchRoles(results: Array<{ sourceRole?: string }>) {
  let productCandidates = 0;
  let newsCandidates = 0;
  let generalCandidates = 0;
  for (const result of results) {
    if (result.sourceRole === "product") productCandidates += 1;
    else if (result.sourceRole === "news") newsCandidates += 1;
    else generalCandidates += 1;
  }
  return { productCandidates, newsCandidates, generalCandidates };
}

export function funnelSummary(funnel: PipelineFunnel): string {
  const drops = Object.entries(funnel.dropoffs)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(" ");
  return [
    `search=${funnel.searchResults}`,
    `product=${funnel.productCandidates}`,
    `news=${funnel.newsCandidates}`,
    `general=${funnel.generalCandidates}`,
    `live=${funnel.liveProducts}`,
    `specialty=${funnel.specialtyPass}`,
    `quality=${funnel.qualityPass}`,
    `ai_selected=${funnel.aiSelected}`,
    `duplicate=${funnel.duplicates}`,
    `saved=${funnel.saved}`,
    `posted=${funnel.posted}`,
    drops,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isDropOffReason(value: string | null | undefined): value is DropOffReason {
  return Boolean(value && (DROP_OFF_REASONS as readonly string[]).includes(value));
}
