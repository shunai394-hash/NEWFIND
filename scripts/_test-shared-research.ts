import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());

  const { planResearchQueries } = await import("../lib/ai/agent-os/query");
  const { assessSourceFreshness } = await import("../lib/ai/agent-os/freshness");
  const { sourceQualityFromType } = await import("../lib/ai/agent-os/quality");
  const { REJECTION_REASONS } = await import("../lib/ai/agent-os/rejection");
  const { RESEARCH_LAYER } = await import("../lib/ai/agent-os/boundaries");

  const queries = planResearchQueries({
    region: "Japan",
    countryCode: "JP",
    beats: ["beauty", "food", "product"],
    seed: "aoi-test",
    recentQueries: ["independent perfume official Japan"],
    maxQueries: 2,
  });
  if (queries.length !== 2) throw new Error("query cap failed");
  if (!queries.some((item) => item.query.includes("-pinterest"))) {
    throw new Error("junk negative missing");
  }

  const duplicate = assessSourceFreshness({
    sourceUrl: "https://example.com/a",
    recentSourceUrls: ["https://example.com/a/"],
  });
  const staleNews = assessSourceFreshness({
    sourceUrl: "https://news.example.com/old",
    sourceType: "news",
    publishedAt: "2020-01-01T00:00:00.000Z",
    recentSourceUrls: [],
  });
  if (duplicate !== "duplicate") throw new Error("freshness duplicate failed");
  if (staleNews !== "stale") throw new Error("freshness stale failed");
  if (sourceQualityFromType("brand_official") !== 1) {
    throw new Error("quality mapping failed");
  }
  if (!REJECTION_REASONS.includes("insufficient_information")) {
    throw new Error("rejection reasons missing");
  }

  console.log("COMMON_QUERY", queries.map((item) => item.query).join(" | "));
  console.log("COMMON_LAYER", Object.keys(RESEARCH_LAYER.common).join(","));
  console.log("NEWFIND_ONLY", Object.keys(RESEARCH_LAYER.newfindOnly).join(","));
  console.log("PRICESENSE_ONLY", Object.keys(RESEARCH_LAYER.pricesenseOnly).join(","));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("SCOUT_RUN skipped: supabase env missing");
    return;
  }

  const { ensureAgentOs } = await import("../lib/ai/agent-os/ensure");
  const { getActiveAiPersonas } = await import("../lib/ai-post-engine");
  const { runWorldScoutCycle } = await import("../lib/ai/world-scout-cycle");

  const ensured = await ensureAgentOs();
  console.log("ENSURE_AGENTS", JSON.stringify(ensured));

  const personas = await getActiveAiPersonas();
  const scout = personas.find((persona) => persona.resident_role === "world_scout");
  if (!scout) {
    console.log("SCOUT_RUN skipped: no world_scout persona");
    return;
  }

  const result = await runWorldScoutCycle(scout, []);
  console.log(
    "SCOUT_RUN",
    JSON.stringify({
      persona: result.persona,
      beatKey: result.beatKey,
      queries: result.queries,
      searchCount: result.searchCount,
      candidateCount: result.candidateCount,
      savedCount: result.savedCount,
      duplicateSourceCount: result.duplicateSourceCount,
      assigned: result.assigned,
      noAction: result.noAction,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
