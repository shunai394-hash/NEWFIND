import { NextResponse } from "next/server";
import { getActiveAiPersonas, type AiPersona } from "@/lib/ai-post-engine";
import { getSharedWorldNews } from "@/lib/ai/gdelt";
import { getGoogleTrends } from "@/lib/ai/google-trends";
import { ensureAiResidentPopulation } from "@/lib/ai/resident-factory";
import { ensureFeaturedLivingResidents } from "@/lib/ai/ensure-featured-residents";
import { FEATURED_LIVING_RESIDENTS } from "@/lib/ai/featured-living-residents";
import { runResidentLifeCycle } from "@/lib/ai/resident-life";
import type { WorldSearchResult } from "@/lib/ai/world-search";

const DEFAULT_ACT_LIMIT = 8;

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

function pickResidentsToAct(personas: AiPersona[], limit: number): AiPersona[] {
  const featuredNames = new Set(
    FEATURED_LIVING_RESIDENTS.map((resident) => resident.personaName),
  );
  const featured = personas
    .filter((persona) => featuredNames.has(persona.persona_name))
    .sort((a, b) => dueStamp(a) - dueStamp(b));
  const rest = personas.filter(
    (persona) => !featuredNames.has(persona.persona_name),
  );
  const remaining = Math.max(0, limit - featured.length);
  return [...featured, ...pickByRole(rest, remaining)].slice(0, limit);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runAIAct(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const factory = await ensureAiResidentPopulation();
    let featuredResidents: Awaited<
      ReturnType<typeof ensureFeaturedLivingResidents>
    > = [];
    try {
      featuredResidents = await ensureFeaturedLivingResidents();
    } catch (error) {
      console.error("Featured living residents failed. Continuing.", error);
    }

    const personas = await getActiveAiPersonas();
    const limitParam = Number(new URL(request.url).searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), personas.length || 1)
        : Math.min(DEFAULT_ACT_LIMIT, personas.length || 1);
    const acting = pickResidentsToAct(personas, limit);

    if (personas.length === 0) {
      return NextResponse.json({
        ok: true,
        aiCount: 0,
        factory,
        results: [],
      });
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
          await runResidentLifeCycle(persona, worldNews, googleTrends),
        );
      } catch (error) {
        console.error("AI resident action failed:", persona.persona_name, error);
        results.push({
          persona: persona.persona_name,
          profileId: persona.profile_id,
          residentRole: persona.resident_role,
          action: { type: "IGNORE" },
          error:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      aiCount: personas.length,
      actedCount: acting.length,
      factory,
      featuredResidents,
      worldNewsCount: worldNews.length,
      results,
    });
  } catch (error) {
    console.error("AI act error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runAIAct(request);
}

export async function POST(request: Request) {
  return runAIAct(request);
}
