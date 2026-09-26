import { getActiveAiPersonas, type AiPersona } from "@/lib/ai-post-engine";
import { getSharedWorldNews } from "@/lib/ai/gdelt";
import { getGoogleTrendsForWorld } from "@/lib/ai/google-trends";
import { ensureAiResidentPopulation } from "@/lib/ai/resident-factory";
import { ensureFeaturedLivingResidents } from "@/lib/ai/ensure-featured-residents";
import { featuredResidentsForScheduling } from "@/lib/ai/featured-living-residents";
import { SPECIALIST_PRODUCT_HUNTERS } from "@/lib/ai/specialist-product-hunters";
import { MARKETPLACE_RESIDENTS } from "@/lib/ai/marketplace-residents";
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

const DEFAULT_ACT_LIMIT = 12;

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

function pickByRole(personas: AiPersona[], limit: number): AiPersona[] {
  const byRole = new Map<string, AiPersona[]>();
  for (const persona of personas) {
    const role = persona.resident_role || "general_user";
    const list = byRole.get(role) ?? [];
    list.push(persona);
    byRole.set(role, list);
  }
  for (const list of byRole.values()) {
    list.sort((a, b) => dueStamp(a) - dueStamp(b));
  }

  const picked: AiPersona[] = [];
  const roles = [...byRole.keys()];
  while (picked.length < limit) {
    let added = false;
    for (const role of roles) {
      if (picked.length >= limit) break;
      const next = byRole.get(role)?.shift();
      if (next) {
        picked.push(next);
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
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
      .sort((a, b) => dueStamp(a) - dueStamp(b));
    const priority = hunters.filter((persona) => priorityPersonaIds.has(persona.id));
    const dueRest = hunters.filter(
      (persona) =>
        !priorityPersonaIds.has(persona.id) && isDue(persona),
    );
    return [...priority, ...dueRest].slice(0, Math.max(1, Math.min(limit, 6)));
  }

  const featuredNames = new Set(
    featuredResidentsForScheduling().map((resident) => resident.personaName),
  );
  const specialistNames = new Set(
    SPECIALIST_PRODUCT_HUNTERS.map((resident) => resident.personaName),
  );
  const marketplaceNames = new Set(
    MARKETPLACE_RESIDENTS.map((resident) => resident.personaName),
  );
  const featured = personas
    .filter(
      (persona) =>
        featuredNames.has(persona.persona_name) && isDue(persona),
    )
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const scouts = personas
    .filter(
      (persona) =>
        persona.resident_role === "world_scout" && isDue(persona),
    )
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const specialists = personas
    .filter(
      (persona) =>
        specialistNames.has(persona.persona_name) && isDue(persona),
    )
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const marketplace = personas
    .filter(
      (persona) =>
        marketplaceNames.has(persona.persona_name) && isDue(persona),
    )
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const rest = personas
    .filter(
      (persona) =>
        !featuredNames.has(persona.persona_name) &&
        !specialistNames.has(persona.persona_name) &&
        !marketplaceNames.has(persona.persona_name) &&
        persona.resident_role !== "world_scout" &&
        isDue(persona),
    )
    .sort((a, b) => dueStamp(a) - dueStamp(b));

  const picked = [...featured.slice(0, 3)];
  if (scouts[0] && !picked.some((row) => row.id === scouts[0].id)) {
    picked.push(scouts[0]);
  }
  if (marketplace[0] && !picked.some((row) => row.id === marketplace[0].id)) {
    picked.push(marketplace[0]);
  }
  const remaining = Math.max(0, limit - picked.length);
  const specialistSlots =
    remaining === 0
      ? 0
      : Math.min(specialists.length, Math.max(1, Math.ceil(remaining / 2)));
  picked.push(...specialists.slice(0, specialistSlots));
  const restRemaining = Math.max(0, limit - picked.length);
  return [...picked, ...pickByRole(rest, restRemaining)].slice(0, limit);
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

  await logAiActivity({
    actorName: "SYSTEM",
    actorRole: "engine",
    action: "run_started",
    detail: `${mode} via ${triggeredBy}`,
    relatedRunId: lock.runId,
  });

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

    const googleTrends = await getGoogleTrendsForWorld(["JP", "US", "GB", "KR"], 6);
    const results = [];

    for (const persona of acting) {
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
