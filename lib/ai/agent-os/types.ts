/**
 * Shared AI Agent / Research OS contract.
 *
 * This is the smallest model NEWFIND and PriceSense can both implement
 * without merging databases or publishing a shared npm package.
 *
 * Mapping:
 *   NEWFIND World Scout persona  → AI Resident (world inhabitant)
 *   NEWFIND Agent                 → worker that explores (World Scout / Growth)
 *   PriceSense Correspondent      → Agent
 *   PriceSense research_run       → Research Run (succeeded≈success; add no_action)
 *   PriceSense research_sources   → Source
 *   PriceSense research_discoveries → Finding
 *   PriceSense promote            → Handoff
 *
 * Shared:
 *   Agent, Mission, Task, Research Run, Source, Finding,
 *   Verification, Memory, Activity, Handoff, Control
 *
 * NEWFIND-only destination:
 *   Product, Brand, Trend, Discovery, Resident, Post, Reaction
 *
 * PriceSense-only destination:
 *   Company, Contact, Lead, Sales Signal, Opportunity, Sales Action
 */

export const AGENT_TYPES = [
  "world_scout",
  "product_scout",
  "trend_scout",
  "growth_agent",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_STATUSES = ["active", "paused", "stalled", "error"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const RESEARCH_RUN_STATUSES = [
  "running",
  "success",
  "no_action",
  "failed",
] as const;
export type ResearchRunStatus = (typeof RESEARCH_RUN_STATUSES)[number];

export const FINDING_ENTITY_TYPES = [
  "product",
  "brand",
  "company",
  "person",
  "place",
  "trend",
  "service",
  "event",
] as const;
export type FindingEntityType = (typeof FINDING_ENTITY_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "verified",
  "rejected",
  "duplicate",
  "needs_review",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const HANDOFF_STATUSES = ["pending", "completed", "failed"] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HOME_APPS = ["newfind", "pricesense"] as const;
export type HomeApp = (typeof HOME_APPS)[number];

export const MISSION_FREQUENCIES = ["hourly", "daily", "weekly"] as const;
export type MissionFrequency = (typeof MISSION_FREQUENCIES)[number];

export type AgentTaskKind = "search" | "verify" | "handoff" | "recommend";

export type AgentRecord = {
  id: string;
  agentKey: string;
  name: string;
  type: AgentType;
  role: string;
  region: string;
  countryCode: string | null;
  beats: string[];
  status: AgentStatus;
  capabilities: string[];
  personaId: string | null;
  homeApp: HomeApp;
  lastRunAt: string | null;
  lastActionAt: string | null;
  createdAt: string;
};

export type MissionRecord = {
  id: string;
  agentId: string;
  region: string;
  countryCode: string | null;
  beats: string[];
  objective: string;
  frequency: string;
  isActive: boolean;
};

export type AgentTask = {
  kind: AgentTaskKind;
  query?: string;
  label?: string;
  status: "pending" | "running" | "done" | "skipped";
};

export type ResearchRunRecord = {
  id: string;
  agentId: string;
  missionId: string | null;
  engineRunId: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: ResearchRunStatus;
  queriesCount: number;
  sourcesChecked: number;
  findingsCount: number;
  verifiedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  error: string | null;
  metadata: Record<string, unknown>;
};

export type ResearchSourceRecord = {
  id: string;
  runId: string | null;
  agentId: string | null;
  sourceUrl: string;
  sourceName: string | null;
  sourceType: string;
  publishedAt: string | null;
  discoveredAt: string;
  sourceHash: string;
  sourceQuality: number | null;
};

export type ResearchSourceInput = {
  sourceUrl: string;
  sourceName?: string | null;
  sourceType?: string;
  publishedAt?: string | null;
  title?: string | null;
  snippet?: string | null;
};

export type FindingRecord = {
  id: string;
  runId: string | null;
  sourceId: string | null;
  agentId: string | null;
  entityType: FindingEntityType;
  title: string;
  description: string;
  region: string | null;
  category: string | null;
  firstSeenAt: string;
  confidence: number;
  status: VerificationStatus;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  verificationSources: string[];
  verificationReason: string | null;
  destinationApp: HomeApp | null;
  destinationKind: string | null;
  destinationId: string | null;
};

export type HandoffRecord = {
  id: string;
  fromAgentId: string | null;
  toAgentId: string | null;
  toPersonaId: string | null;
  findingId: string | null;
  reason: string;
  status: HandoffStatus;
  createdAt: string;
};

export type AgentMemory = {
  recentQueries: string[];
  recentSources: string[];
  recentFindings: string[];
  recentRejections: string[];
  recentDuplicates: string[];
  recentVerifiedFindings: string[];
};

export type AgentResearchSession = {
  available: boolean;
  agent: AgentRecord | null;
  mission: MissionRecord | null;
  runId: string | null;
  memory: AgentMemory;
};

export const EMPTY_AGENT_MEMORY: AgentMemory = {
  recentQueries: [],
  recentSources: [],
  recentFindings: [],
  recentRejections: [],
  recentDuplicates: [],
  recentVerifiedFindings: [],
};

export type AgentOsAgentRow = {
  agentId: string;
  name: string;
  type: string;
  role: string;
  region: string;
  countryCode: string | null;
  beats: string[];
  status: AgentStatus;
  lastRunAt: string | null;
  lastActionAt: string | null;
  lastRunStatus: string | null;
};

export type AgentOsRunRow = {
  id: string;
  agentName: string;
  missionObjective: string | null;
  startedAt: string;
  status: string;
  sourcesChecked: number;
  findingsCount: number;
  verifiedCount: number;
  duplicateCount: number;
};

export type AgentOsHandoffRow = {
  id: string;
  fromAgent: string;
  toName: string;
  findingTitle: string;
  status: string;
  createdAt: string;
};

export type AgentOsCoverageRow = {
  agentId: string;
  name: string;
  region: string;
  beats: string[];
  runs: number;
  sources: number;
  findings: number;
  verified: number;
  rejected: number;
  duplicates: number;
  noAction: number;
};

export type AgentOsTower = {
  agents: AgentOsAgentRow[];
  runs: AgentOsRunRow[];
  research: {
    sources: number;
    findings: number;
    verified: number;
    duplicates: number;
  };
  coverage: AgentOsCoverageRow[];
  handoff: {
    pending: number;
    completed: number;
    failed: number;
    recent: AgentOsHandoffRow[];
  };
};

export const EMPTY_AGENT_OS_TOWER: AgentOsTower = {
  agents: [],
  runs: [],
  research: { sources: 0, findings: 0, verified: 0, duplicates: 0 },
  coverage: [],
  handoff: { pending: 0, completed: 0, failed: 0, recent: [] },
};
