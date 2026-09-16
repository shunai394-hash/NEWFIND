import type { AiPersona } from "@/lib/ai-post-engine";
import {
  isNewsSignal,
  isProductSource,
  searchWorld,
  type WorldSearchResult,
} from "@/lib/ai/world-search";
import { evaluateProductCandidates } from "@/lib/ai/product-hunter";
import {
  getWorldScoutByUsername,
  type ScoutBeat,
  type ScoutGenre,
} from "@/lib/ai/world-scouts";
import { upsertScoutDiscovery } from "@/lib/ai/discovery-upsert";
import { assignDiscoveryToResident } from "@/lib/ai/discovery-handoff";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";

export type WorldScoutCycleResult = {
  persona: string;
  profileId: string;
  beatKey: string;
  queries: string[];
  searchCount: number;
  candidateCount: number;
  savedCount: number;
  duplicateSourceCount: number;
  assigned: string[];
  noAction: boolean;
};

const GENRE_QUERIES: Record<ScoutGenre, string[]> = {
  product: ["new product official", "independent brand product page"],
  food: ["new food brand official", "craft food product"],
  beauty: ["new skincare product", "independent perfume official"],
  fashion: ["new collection official product", "independent fashion product"],
  culture: ["new independent brand", "new community app official"],
  trend: ["emerging brand 2026", "rising independent product"],
};

function rotate<T>(items: T[], seed: string) {
  if (items.length === 0) return items;
  const index =
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

function countryQuery(countryCode: string) {
  const map: Record<string, string> = {
    JP: "Japan",
    US: "United States",
    GB: "United Kingdom",
    FR: "France",
    KR: "Korea",
    IT: "Italy",
  };
  return map[countryCode] || countryCode;
}

function buildScoutQueries(beat: ScoutBeat, persona: AiPersona) {
  const hour = new Date().toISOString().slice(0, 13);
  const genres = rotate(beat.genres, `${persona.id}:${hour}`);
  const country = countryQuery(beat.countryCode);
  const language = (persona.languages?.[0] || "en").slice(0, 2);
  return genres.slice(0, 2).map((genre, index) => {
    const phrase = rotate(GENRE_QUERIES[genre], `${persona.id}:${genre}`)[0];
    return {
      genre,
      query: `${phrase} ${country} -pinterest -aliexpress`,
      language,
      label: index === 0 ? "primary" : "explore",
    };
  });
}

function mergeResults(groups: WorldSearchResult[]) {
  const unique = new Map<string, WorldSearchResult>();
  for (const result of groups) {
    const key = result.url.replace(/\/$/, "").toLowerCase();
    if (!key || unique.has(key)) continue;
    unique.set(key, result);
  }
  return [...unique.values()];
}

export async function runWorldScoutCycle(
  persona: AiPersona,
  sharedWorldNews: WorldSearchResult[] = [],
  options?: { runId?: string | null },
): Promise<WorldScoutCycleResult> {
  const named = getWorldScoutByUsername(persona.username);
  const beat: ScoutBeat = named?.scoutBeat ?? {
    countryCode: (persona.country_code || "US").toUpperCase(),
    region: persona.region || "",
    genres: ["product", "culture", "trend"],
    beatKey: (persona.country_code || "US").toUpperCase(),
  };

  const planned = buildScoutQueries(beat, persona);
  await logAiActivity({
    personaId: persona.id,
    actorName: persona.display_name || persona.persona_name,
    actorRole: "world_scout",
    action: "search",
    detail: planned.map((item) => item.query).join(" | "),
    relatedRunId: options?.runId ?? null,
  });

  const searched = await Promise.all(
    planned.map((item) =>
      searchWorld({
        residentId: persona.id,
        residentName: persona.persona_name,
        interests: persona.interests ?? named?.interests ?? [],
        preferredCategories:
          persona.preferred_categories ?? named?.preferredCategories ?? [],
        goals: persona.goals ?? named?.goals ?? [],
        query: item.query,
        country: beat.countryCode,
        language: item.language,
        favoriteBrands: persona.favorite_brands ?? [],
        expertise: persona.expertise ?? named?.expertise ?? [],
        values: persona.values ?? named?.values ?? [],
        region: beat.region,
        discoveryKeywords: named?.interests ?? persona.interests ?? [],
        huntingSpecialty: beat.genres.join(" / "),
      }),
    ),
  );

  const merged = mergeResults(searched.flat());
  const news = [
    ...sharedWorldNews.filter(isNewsSignal),
    ...merged.filter(isNewsSignal),
  ];
  const products = merged.filter(isProductSource);

  const empty: WorldScoutCycleResult = {
    persona: persona.persona_name,
    profileId: persona.profile_id,
    beatKey: beat.beatKey,
    queries: planned.map((item) => item.query),
    searchCount: merged.length,
    candidateCount: 0,
    savedCount: 0,
    duplicateSourceCount: 0,
    assigned: [],
    noAction: true,
  };

  if (products.length === 0) {
    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: "world_scout",
      action: "no_action",
      detail: `search=${merged.length} news=${news.length} no product sources`,
      relatedRunId: options?.runId ?? null,
    });
    return empty;
  }

  const candidates = await evaluateProductCandidates({
    residentId: persona.id,
    residentName: persona.persona_name,
    personality: persona.personality,
    interests: persona.interests ?? [],
    preferredCategories: persona.preferred_categories ?? [],
    goals: persona.goals ?? [],
    expertise: persona.expertise ?? [],
    values: persona.values ?? [],
    region: beat.region,
    languages: persona.languages ?? [],
    culture: persona.culture,
    huntingSpecialty: beat.genres.join(" / "),
    hunterUsername: persona.username ?? undefined,
    results: [...news.slice(0, 4), ...products],
  });

  await logAiActivity({
    personaId: persona.id,
    actorName: persona.display_name || persona.persona_name,
    actorRole: "world_scout",
    action: "verification",
    detail: `${candidates.length} candidate(s) after verification`,
    relatedRunId: options?.runId ?? null,
  });

  const assigned: string[] = [];
  let savedCount = 0;
  let duplicateSourceCount = 0;

  for (const candidate of candidates.slice(0, 3)) {
    if (candidate.origin === "catalog") continue;
    const title = `${candidate.brand} ${candidate.productName}`.trim();
    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: "world_scout",
      action: "candidate_found",
      detail: title,
      relatedRunId: options?.runId ?? null,
    });

    const saved = await upsertScoutDiscovery({
      scoutId: persona.id,
      scoutName: persona.display_name || persona.persona_name,
      beatKey: beat.beatKey,
      candidate,
    });

    if (saved.isNew) savedCount += 1;
    else if (saved.sourceAttached) duplicateSourceCount += 1;

    const handoff = await assignDiscoveryToResident({
      productId: saved.productId,
      category: candidate.category,
      country: candidate.country || beat.countryCode,
      title,
      scoutName: persona.display_name || persona.persona_name,
      runId: options?.runId ?? null,
    });
    if (handoff) assigned.push(handoff.personaName);
  }

  const noAction = savedCount === 0 && duplicateSourceCount === 0;
  if (noAction) {
    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: "world_scout",
      action: "no_action",
      detail: "verified candidates produced no durable discovery",
      relatedRunId: options?.runId ?? null,
    });
  }

  return {
    persona: persona.persona_name,
    profileId: persona.profile_id,
    beatKey: beat.beatKey,
    queries: planned.map((item) => item.query),
    searchCount: merged.length,
    candidateCount: candidates.length,
    savedCount,
    duplicateSourceCount,
    assigned,
    noAction,
  };
}
