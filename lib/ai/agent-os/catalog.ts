import { WORLD_SCOUTS, type WorldScoutSpec } from "@/lib/ai/world-scouts";
import { MARKETPLACE_CORRESPONDENTS } from "@/lib/marketplace/correspondents";
import type { AgentType, HomeApp, MissionFrequency } from "./types";

export const COUNTRY_LABEL: Record<string, string> = {
  JP: "Japan",
  US: "US",
  GB: "UK",
  FR: "France",
  KR: "Korea",
  IT: "Italy",
};

export type AgentCatalogEntry = {
  agentKey: string;
  name: string;
  type: AgentType;
  role: string;
  region: string;
  countryCode: string | null;
  beats: string[];
  capabilities: string[];
  homeApp: HomeApp;
  status: "active" | "paused";
  username: string | null;
  personaName: string | null;
  mission: {
    objective: string;
    frequency: MissionFrequency;
  };
};

const SCOUT_CAPABILITIES = [
  "web_search",
  "product_verification",
  "source_tracking",
  "resident_handoff",
];

function scoutCatalogEntry(scout: WorldScoutSpec): AgentCatalogEntry {
  const country = scout.scoutBeat.countryCode;
  return {
    agentKey: scout.username,
    name: scout.displayName,
    type: "world_scout",
    role: "world_scout",
    region: COUNTRY_LABEL[country] || scout.scoutBeat.region || country,
    countryCode: country,
    beats: [...scout.scoutBeat.genres],
    capabilities: SCOUT_CAPABILITIES,
    homeApp: "newfind",
    status: "active",
    username: scout.username,
    personaName: scout.personaName,
    mission: {
      objective:
        scout.goals?.[0] ||
        `Explore newly appearing products and brands in ${COUNTRY_LABEL[country] || country}`,
      frequency: "daily",
    },
  };
}

export const GROWTH_AGENT_CATALOG: AgentCatalogEntry = {
  agentKey: "growth_agent_newfind",
  name: "Growth",
  type: "growth_agent",
  role: "growth_agent",
  region: "Global",
  countryCode: null,
  beats: ["community", "brand", "creator", "media", "service"],
  capabilities: ["web_search", "candidate_research", "recommendation"],
  homeApp: "newfind",
  status: "paused",
  username: null,
  personaName: null,
  mission: {
    objective:
      "Research overseas communities, brands, creators, media, and services related to NEWFIND. Produce candidates for human approval. Do not send DMs or mass-post.",
    frequency: "weekly",
  },
};

const MARKETPLACE_CAPABILITIES = [
  "official_api",
  "product_evaluation",
  "supplier_research",
  "fact_hypothesis",
  "human_review",
];

function marketplaceCatalogEntry(
  spec: (typeof MARKETPLACE_CORRESPONDENTS)[number],
): AgentCatalogEntry {
  return {
    agentKey: spec.agentKey,
    name: spec.name,
    type: "product_scout",
    role: "marketplace_correspondent",
    region: spec.region,
    countryCode: spec.countryCode,
    beats: spec.beats,
    capabilities: MARKETPLACE_CAPABILITIES,
    homeApp: "newfind",
    status: "active",
    username: spec.username,
    personaName: spec.name,
    mission: {
      objective: spec.mission,
      frequency: "daily",
    },
  };
}

export const AGENT_CATALOG: AgentCatalogEntry[] = [
  ...WORLD_SCOUTS.map(scoutCatalogEntry),
  ...MARKETPLACE_CORRESPONDENTS.map(marketplaceCatalogEntry),
  GROWTH_AGENT_CATALOG,
];

export function catalogEntryForUsername(username: string | null | undefined) {
  const key = (username ?? "").trim().toLowerCase();
  if (!key) return null;
  return AGENT_CATALOG.find((entry) => entry.username?.toLowerCase() === key) ?? null;
}

export function catalogEntryForPersonaName(name: string | null | undefined) {
  const key = (name ?? "").trim().toLowerCase();
  if (!key) return null;
  return AGENT_CATALOG.find((entry) => entry.personaName?.toLowerCase() === key) ?? null;
}
