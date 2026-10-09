import { getActiveAiPersonas, type AiPersona } from "@/lib/ai-post-engine";
import { getSharedWorldNews } from "@/lib/ai/gdelt";
import { getGoogleTrendsForWorld } from "@/lib/ai/google-trends";
import { arxivWorldSourceCollector } from "@/lib/ai/world-sources/arxiv";
import { collectFutureTechNews } from "@/lib/ai/world-sources/future-tech-news";
import { ensureAiResidentPopulation } from "@/lib/ai/resident-factory";
import { ensureFeaturedLivingResidents } from "@/lib/ai/ensure-featured-residents";
import { runResidentLifeCycle } from "@/lib/ai/resident-life";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import {
  acquireEngineLock,
  finishEngineRun,
} from "@/lib/ai/control-tower/runs";
import { ensureAgentOs } from "@/lib/ai/agent-os";
import type { EngineRunType, EngineTrigger } from "@/lib/ai/control-tower/types";
import type { WorldSearchResult } from "@/lib/ai/world-search";
import { listAssignedDiscoveryResidentIds } from "@/lib/ai/discovery-handoff";

// Keep the daily cron bounded: resident life is intentionally sequential because
// each turn can perform several AI/network operations. Two turns per run
// preserve rotation while keeping the 300s Vercel budget reliable.
const DEFAULT_ACT_LIMIT = 2;
const MAX_RUN_MS = 210_000; // Keep 90s headroom for final persistence and runtime shutdown.

export type AiEngineMode = "ai_engine" | "world_scout" | "product_hunter";

export type AiEngineRequest = {
  mode?: AiEngineMode;
  triggeredBy?: EngineTrigger;
  limit?: number;
};

function dueStamp(persona: AiPersona): number {
  const parsed = Date.parse(persona.next_action_at || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDue(persona: AiPersona, now = Date.now()): boolean {
  const parsed = Date.parse(persona.next_action_at || "");
  return !Number.isFinite(parsed) || parsed <= now;
}

function pickResidentsToAct(
  personas: AiPersona[],
  limit: number,
  mode: AiEngineMode,
  priorityPersonaIds: Set<string> = new Set(),
): AiPersona[] {
  if (mode === "world_scout") {
    return personas
      .filter(
        (persona) =>
          persona.resident_role === "world_scout" && isDue(persona),
      )
      .sort((a, b) => dueStamp(a) - dueStamp(b))
      .slice(0, Math.max(1, Math.min(limit, 4)));
  }
  if (mode === "product_hunter") {
    const hunters = personas
      .filter((persona) => persona.resident_role === "product_hunter")
      .filter((persona) => isDue(persona))
      .sort((a, b) => {
        const aPriority = priorityPersonaIds.has(a.id) ? 0 : 1;
        const bPriority = priorityPersonaIds.has(b.id) ? 0 : 1;
        return aPriority - bPriority || dueStamp(a) - dueStamp(b);
      });
    return hunters.slice(0, Math.max(1, Math.min(limit, 6)));
  }

  // Every due resident must get a fair turn. Previously featured residents
  // were always inserted first, which could starve ordinary residents when
  // the engine limit was smaller than the active population.
  const due = personas
    .filter((persona) => isDue(persona))
    .sort((a, b) => {
      const dueDelta = dueStamp(a) - dueStamp(b);
      if (dueDelta !== 0) return dueDelta;

      // Keep role diversity when residents become due at the same instant.
      const aRole = a.resident_role || "general_user";
      const bRole = b.resident_role || "general_user";
      if (aRole !== bRole) return aRole.localeCompare(bRole);

      return a.persona_name.localeCompare(b.persona_name);
    });

  return due.slice(0, limit);
}

function summarizeResults(results: unknown[]) {
  let posts = 0;
  let reactions = 0;
  let discoveries = 0;
  let errors = 0;
  let noAction = 0;
  let searches = 0;
  let newCandidates = 0;
  const axes: string[] = [];
  const cities: string[] = [];
  const funnels: string[] = [];
  for (const item of results) {
    const result = item as {
      error?: string;
      action?: {
        work?: { posted?: boolean; type?: string };
        social?: { type?: string };
      };
      productHunter?: {
        savedProductIds?: string[];
        funnelSummary?: string;
        searchPasses?: number;
        newResultCount?: number;
      } | null;
      worldScout?: { savedCount?: number; noAction?: boolean; funnelSummary?: string } | null;
      correspondent?: { searchPasses?: number; newResultCount?: number } | null;
      exploration?: { axis?: string; city?: string; queries?: string[] } | null;
    };
    if (result.error) errors += 1;
    if (result.action?.work?.posted) posts += 1;
    const social = result.action?.social?.type;
    if (social && social !== "IGNORE") reactions += 1;
    discoveries += result.productHunter?.savedProductIds?.length ?? 0;
    discoveries += result.worldScout?.savedCount ?? 0;
    if (result.productHunter?.funnelSummary) {
      funnels.push(result.productHunter.funnelSummary);
    }
    if (result.worldScout?.funnelSummary) {
      funnels.push(result.worldScout.funnelSummary);
    }
    searches +=
      (result.productHunter?.searchPasses ?? 0) +
      (result.correspondent?.searchPasses ?? 0);
    newCandidates +=
      (result.productHunter?.newResultCount ?? 0) +
      (result.correspondent?.newResultCount ?? 0);
    if (result.exploration?.axis) axes.push(result.exploration.axis);
    if (result.exploration?.city) cities.push(result.exploration.city);
    const workType = result.action?.work?.type;
    if (
      !result.error &&
      workType !== "POST" &&
      workType !== "PRODUCT_HUNT" &&
      workType !== "WORLD_SCOUT" &&
      (!social || social === "IGNORE")
    ) {
      noAction += 1;
    }
    if (result.worldScout?.noAction && workType === "WORLD_SCOUT") {
      noAction += 1;
    }
  }
  return {
    posts,
    reactions,
    discoveries,
    errors,
    noAction,
    acted: results.length,
    funnels: funnels.slice(0, 8),
    searches,
    newCandidates,
    sourceDiversity: [...new Set(axes)].slice(0, 8),
    regionDiversity: [...new Set(cities)].slice(0, 8),
  };
}

export async function executeAiEngine(input: AiEngineRequest = {}) {
  const mode: AiEngineMode = input.mode ?? "ai_engine";
  const triggeredBy: EngineTrigger = input.triggeredBy ?? "cron";
  const runType: EngineRunType = mode;

  const lock = await acquireEngineLock({
    runType,
    triggeredBy,
  });

  if (!lock.ok) {
    return {
      ok: lock.reason !== "unavailable",
      skipped: true,
      reason: lock.reason,
      error: lock.message,
      status: lock.reason === "paused" ? 200 : lock.reason === "busy" ? 409 : 503,
    };
  }

  // Budget the entire invocation, including resident setup and external source collection.
  // Starting this clock only before the resident loop allowed preflight work plus a full
  // 240s loop to exceed Vercel's 300s function ceiling.
  const runStartedAt = Date.now();

  await logAiActivity({
    actorName: "SYSTEM",
    actorRole: "engine",
    action: "run_started",
    detail: `${mode} via ${triggeredBy}`,
    relatedRunId: lock.runId,
  });

  // Start the budget before resident setup and network-source collection so
  // preflight work is counted against the platform's execution ceiling too.
  const runStartedAt = Date.now();

  try {
    const factory = await ensureAiResidentPopulation();
    let featuredResidents: Awaited<
      ReturnType<typeof ensureFeaturedLivingResidents>
    > = [];
    try {
      featuredResidents = await ensureFeaturedLivingResidents();
    } catch (error) {
      console.error("Featured living residents failed. Continuing.", error);
    }

    try {
      await ensureAgentOs();
    } catch (error) {
      console.error("Agent OS ensure failed. Continuing.", error);
    }

    const personas = await getActiveAiPersonas();
    const limit =
      typeof input.limit === "number" && input.limit > 0
        ? Math.min(Math.floor(input.limit), personas.length || 1)
        : Math.min(DEFAULT_ACT_LIMIT, personas.length || 1);
    const priorityPersonaIds =
      mode === "product_hunter"
        ? await listAssignedDiscoveryResidentIds()
        : new Set<string>();

    const acting = pickResidentsToAct(
      personas,
      limit,
      mode,
      priorityPersonaIds,
    );

    if (personas.length === 0 || acting.length === 0) {
      await finishEngineRun({
        runId: lock.runId,
        status: "no_action",
        summary: { aiCount: personas.length, actedCount: 0, factory },
      });
      return {
        ok: true,
        skipped: false,
        status: 200,
        body: {
          ok: true,
          aiCount: personas.length,
          actedCount: 0,
          factory,
          results: [],
        },
      };
    }

    let worldNews: WorldSearchResult[] = [];
    try {
      worldNews = await getSharedWorldNews();
    } catch (error) {
      console.error("Shared world news failed. Continuing without GDELT.", error);
      worldNews = [];
    }

    let researchSourceCount = 0;
    let futureTechNewsCount = 0;
    const seenWorldUrls = new Set(
      worldNews.map((item) => item.url.replace(/\/$/, "").toLowerCase()),
    );
    try {
      // Academic research is a first-class discovery source, not product-search noise.
      const research = await arxivWorldSourceCollector.collect({ limit: 12 });
      for (const item of research) {
        const key = item.url.replace(/\/$/, "").toLowerCase();
        if (!key || seenWorldUrls.has(key)) continue;
        seenWorldUrls.add(key);
        worldNews.push(item);
        researchSourceCount += 1;
      }
      console.info("[AI engine] official research items:", researchSourceCount);
    } catch (error) {
      console.warn("arXiv research collection failed. Continuing with other sources.", error);
    }

    try {
      // Pull real publisher and research-lab feeds; one unavailable feed must not
      // cancel the rest of the resident cycle. These items keep their source URLs.
      const futureTechNews = await collectFutureTechNews(4);
      for (const item of futureTechNews) {
        const key = item.url.replace(/\/$/, "").toLowerCase();
        if (!key || seenWorldUrls.has(key)) continue;
        seenWorldUrls.add(key);
        worldNews.push(item);
        futureTechNewsCount += 1;
      }
      console.info("[AI engine] future-tech news items:", futureTechNewsCount);
    } catch (error) {
      console.warn("Future-tech news collection failed. Continuing with shared news.", error);
    }

    let googleTrends: Awaited<ReturnType<typeof getGoogleTrendsForWorld>> = [];
    try {
      googleTrends = await getGoogleTrendsForWorld(["JP", "US", "GB", "KR"], 6);
    } catch (error) {
      console.error("Google Trends failed. Continuing without trends.", error);
    }
    const results = [];

    for (const persona of acting) {
      // A resident turn can fan out into search, AI generation, Supabase writes,
      // editorial review, and world correspondence. Stop starting new turns
      // before the platform timeout so one slow cycle cannot kill the patrol.
      if (Date.now() - runStartedAt >= MAX_RUN_MS) {
        await logAiActivity({
          actorName: "SYSTEM",
          actorRole: "engine",
          action: "run_budget_reached",
          detail: `stopped before ${persona.persona_name}; elapsed=${Date.now() - runStartedAt}ms`,
          relatedRunId: lock.runId,
        });
        break;
      }
      try {
        results.push(
          await runResidentLifeCycle(persona, worldNews, googleTrends, {
            runId: lock.runId,
          }),
        );
      } catch (error) {
        console.error("AI resident action failed:", persona.persona_name, error);
        results.push({
          persona: persona.persona_name,
          profileId: persona.profile_id,
          residentRole: persona.resident_role,
          action: { type: "IGNORE" as const },
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const summary = summarizeResults(results);
    const runStatus =
      summary.errors === results.length && results.length > 0
        ? "failed"
        : summary.posts + summary.discoveries + summary.reactions === 0
          ? "no_action"
          : "success";

    await finishEngineRun({
      runId: lock.runId,
      status: runStatus,
      error:
        summary.errors === results.length && results.length > 0
          ? "All acting residents failed"
          : null,
      summary: {
        mode,
        aiCount: personas.length,
        actedCount: acting.length,
        ...summary,
      },
    });

    await logAiActivity({
      actorName: "SYSTEM",
      actorRole: "engine",
      action: "run_finished",
      detail: `${runStatus} posts=${summary.posts} discoveries=${summary.discoveries} reactions=${summary.reactions}${
        summary.funnels[0] ? ` ${summary.funnels[0]}` : ""
      }`,
      relatedRunId: lock.runId,
    });

    return {
      ok: true,
      skipped: false,
      status: 200,
      body: {
        ok: true,
        aiCount: personas.length,
        actedCount: acting.length,
        factory,
        featuredResidents,
        worldNewsCount: worldNews.length,
        researchSourceCount,
        results,
        summary,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishEngineRun({
      runId: lock.runId,
      status: "failed",
      error: message,
    });
    await logAiActivity({
      actorName: "SYSTEM",
      actorRole: "engine",
      action: "error",
      detail: message,
      relatedRunId: lock.runId,
    });
    return {
      ok: false,
      skipped: false,
      status: 500,
      error: message,
    };
  }
}
