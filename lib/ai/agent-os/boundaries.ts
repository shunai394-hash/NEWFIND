/**
 * Layer boundary for the shared AI Agent / Research OS.
 *
 * NEWFIND and PriceSense keep separate apps and databases.
 * This module is the code-level map of what is common vs app-specific.
 * Do not implement COMMON rows as NEWFIND-only systems.
 */

export const RESEARCH_LAYER = {
  common: {
    agent: "lib/ai/agent-os + public.ai_agents",
    mission: "lib/ai/agent-os + public.ai_missions",
    task: "lib/ai/agent-os/types.ts AgentTask (queries on the research run)",
    researchRun: "public.ai_research_runs",
    source: "public.ai_research_sources",
    finding: "public.ai_findings",
    verification: "ai_findings.verification_status / verification_reason",
    memory: "lib/ai/agent-os/store.ts loadAgentMemory",
    handoff: "public.ai_handoffs",
    queryStrategy: "lib/ai/agent-os/query.ts",
    freshness: "lib/ai/agent-os/freshness.ts",
    quality: "lib/ai/agent-os/quality.ts (reuses discovery source_tier 1-4)",
    duplicate: "ai_findings.status = duplicate",
    rejection: "lib/ai/agent-os/rejection.ts + verification_reason",
    coverage: "lib/ai/agent-os/coverage.ts (derived from research runs)",
    marketplaceDiscovery: "lib/marketplace shared types/adapters/pipeline/supplier",
  },
  newfindOnly: {
    worldScout: "lib/ai/world-scouts.ts + lib/ai/world-scout-cycle.ts",
    scoutBeat: "lib/ai/world-scouts.ts ScoutBeat",
    discovery: "lib/discovery + lib/ai/discovery-upsert.ts",
    resident: "lib/ai/resident-life.ts + public.ai_personas",
    aiPost: "lib/ai/action-executor.ts + public.ai_posts",
    liveActivity: "lib/world/home-data.ts loadLiveActivities / mergeActivities",
    marketplaceCorrespondents:
      "lib/ai/marketplace-residents.ts (persona + avatar) + /correspondents UI",
  },
  pricesenseOnly: {
    correspondent: "PriceSense research_correspondents",
    company: "PriceSense companies / research_organizations",
    contact: "PriceSense contacts",
    lead: "PriceSense leads",
    salesSignal: "PriceSense research_signals",
    factHypothesis: "PriceSense research_discoveries.fact_text / hypothesis",
    promote: "PriceSense pricesense_status / newfind_status",
    productOpportunity:
      "lib/marketplace/pricesense.ts ProductOpportunity (never a Lead/Prospect)",
    marketplacePipeline:
      "lib/marketplace/pipeline.ts → qualifyForPricesense (PURSUE/WATCH/INVESTIGATE/DISQUALIFY)",
  },
} as const;

export const COMMON_RESEARCH_KEYS = [
  "agent",
  "mission",
  "task",
  "researchRun",
  "source",
  "finding",
  "verification",
  "memory",
  "handoff",
  "queryStrategy",
  "freshness",
  "quality",
  "duplicate",
  "rejection",
  "marketplaceDiscovery",
] as const;

export const NEWFIND_ONLY_KEYS = [
  "worldScout",
  "scoutBeat",
  "discovery",
  "resident",
  "aiPost",
  "liveActivity",
  "marketplaceCorrespondents",
] as const;

export const PRICESENSE_ONLY_KEYS = [
  "correspondent",
  "company",
  "contact",
  "lead",
  "salesSignal",
  "productOpportunity",
  "marketplacePipeline",
] as const;
