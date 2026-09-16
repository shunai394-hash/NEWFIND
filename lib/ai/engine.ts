import { getActiveAiPersonas, type AiPersona } from "@/lib/ai-post-engine";
import { getSharedWorldNews } from "@/lib/ai/gdelt";
import { getGoogleTrends } from "@/lib/ai/google-trends";
import { ensureAiResidentPopulation } from "@/lib/ai/resident-factory";
import { ensureFeaturedLivingResidents } from "@/lib/ai/ensure-featured-residents";
import { featuredResidentsForScheduling } from "@/lib/ai/featured-living-residents";
import { SPECIALIST_PRODUCT_HUNTERS } from "@/lib/ai/specialist-product-hunters";
import { runResidentLifeCycle } from "@/lib/ai/resident-life";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import {
  acquireEngineLock,
  finishEngineRun,
} from "@/lib/ai/control-tower/runs";
import { ensureAgentOs } from "@/lib/ai/agent-os";
import type { EngineRunType, EngineTrigger } from "@/lib/ai/control-tower/types";
import type { WorldSearchResult } from "@/lib/ai/world-search";

const DEFAULT_ACT_LIMIT = 8;

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
): AiPersona[] {
  if (mode === "world_scout") {
    return personas
      .filter((persona) => persona.resident_role === "world_scout")
      .sort((a, b) => dueStamp(a) - dueStamp(b))
      .slice(0, Math.max(1, Math.min(limit, 3)));
  }
  if (mode === "product_hunter") {
    return personas
      .filter((persona) => persona.resident_role === "product_hunter")
      .sort((a, b) => dueStamp(a) - dueStamp(b))
      .slice(0, Math.max(1, Math.min(limit, 4)));
  }

  const featuredNames = new Set(
    featuredResidentsForScheduling().map((resident) => resident.personaName),
  );
  const specialistNames = new Set(
    SPECIALIST_PRODUCT_HUNTERS.map((resident) => resident.personaName),
  );
  const featured = personas
    .filter((persona) => featuredNames.has(persona.persona_name))
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const scouts = personas
    .filter((persona) => persona.resident_role === "world_scout")
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const specialists = personas
    .filter((persona) => specialistNames.has(persona.persona_name))
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const rest = personas.filter(
    (persona) =>
      !featuredNames.has(persona.persona_name) &&
      !specialistNames.has(persona.persona_name) &&
      persona.resident_role !== "world_scout",
  );

  const picked = [...featured];
  if (scouts[0] && !picked.some((row) => row.id === scouts[0].id)) {
    picked.push(scouts[0]);
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
  for (const item of results) {
    const result = item as {
      error?: string;
      action?: {
        work?: { posted?: boolean; type?: string };
        social?: { type?: string };
      };
      productHunter?: { savedProductIds?: string[] } | null;
      worldScout?: { savedCount?: number; noAction?: boolean } | null;
    };
    if (result.error) errors += 1;
    if (result.action?.work?.posted) posts += 1;
    const social = result.action?.social?.type;
    if (social && social !== "IGNORE") reactions += 1;
    discoveries += result.productHunter?.savedProductIds?.length ?? 0;
    discoveries += result.worldScout?.savedCount ?? 0;
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
  return { posts, reactions, discoveries, errors, noAction, acted: results.length };
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
    const acting = pickResidentsToAct(personas, limit, mode);

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

    const googleTrends = await getGoogleTrends(10);
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
      detail: `${runStatus} posts=${summary.posts} discoveries=${summary.discoveries} reactions=${summary.reactions}`,
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
