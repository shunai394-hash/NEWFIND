import type { AiPersona } from "@/lib/ai-post-engine";
import {
  isNewsSignal,
  isProductSource,
  searchWorld,
  type WorldSearchResult,
} from "@/lib/ai/world-search";
import { evaluateProductCandidates } from "@/lib/ai/product-hunter";
import { getWorldScoutByUsername, type ScoutBeat } from "@/lib/ai/world-scouts";
import { upsertScoutDiscovery } from "@/lib/ai/discovery-upsert";
import { assignDiscoveryToResident } from "@/lib/ai/discovery-handoff";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import {
  beginAgentResearch,
  completeAgentResearch,
  recordCheckedSources,
  recordFinding,
  recordResidentHandoff,
} from "@/lib/ai/agent-os";
import { planResearchQueries } from "@/lib/ai/agent-os/query";
import { filterFreshSources } from "@/lib/ai/agent-os/freshness";
import { isLowQualitySource, sourceQualityFromType } from "@/lib/ai/agent-os/quality";

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

function mergeResults(groups: WorldSearchResult[]) {
  const unique = new Map<string, WorldSearchResult>();
  for (const result of groups) {
    const key = result.url.replace(/\/$/, "").toLowerCase();
    if (!key || unique.has(key)) continue;
    unique.set(key, result);
  }
  return [...unique.values()];
}

function verificationStatus(input: {
  isNew: boolean;
  verified: boolean;
}): "verified" | "needs_review" | "duplicate" {
  if (!input.isNew) return "duplicate";
  return input.verified ? "verified" : "needs_review";
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

  const session = await beginAgentResearch(persona, options?.runId);
  if (session.agent?.status === "paused") {
    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: "world_scout",
      action: "paused",
      detail: "Agent is paused",
      relatedRunId: options?.runId ?? null,
    });
    return {
      persona: persona.persona_name,
      profileId: persona.profile_id,
      beatKey: beat.beatKey,
      queries: [],
      searchCount: 0,
      candidateCount: 0,
      savedCount: 0,
      duplicateSourceCount: 0,
      assigned: [],
      noAction: true,
    };
  }

  try {
    const missionBeats =
      session.mission?.beats?.length ? session.mission.beats : beat.genres;
    const planned = planResearchQueries({
      region: session.mission?.region || beat.region || beat.countryCode,
      countryCode: session.mission?.countryCode || beat.countryCode,
      beats: missionBeats,
      objective: session.mission?.objective,
      language: persona.languages?.[0] || "en",
      seed: `${persona.id}:${new Date().toISOString().slice(0, 13)}`,
      recentQueries: session.memory.recentQueries,
    });

    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: "world_scout",
      action: "search",
      detail: planned.map((item) => item.query).join(" | "),
      relatedRunId: options?.runId ?? null,
      metadata: {
        researchRunId: session.runId,
        missionId: session.mission?.id ?? null,
        objective: session.mission?.objective ?? null,
      },
    });

    const empty = async (
      extras?: Partial<WorldScoutCycleResult> & { rejectedCount?: number },
      error?: string | null,
    ): Promise<WorldScoutCycleResult> => {
      const rejectedCount = extras?.rejectedCount ?? 0;
      const result: WorldScoutCycleResult = {
        persona: persona.persona_name,
        profileId: persona.profile_id,
        beatKey: beat.beatKey,
        queries: planned.map((item) => item.query),
        searchCount: extras?.searchCount ?? 0,
        candidateCount: extras?.candidateCount ?? 0,
        savedCount: extras?.savedCount ?? 0,
        duplicateSourceCount: extras?.duplicateSourceCount ?? 0,
        assigned: extras?.assigned ?? [],
        noAction: extras?.noAction ?? true,
      };
      await completeAgentResearch({
        session,
        queries: result.queries,
        sourcesChecked: result.searchCount,
        findingsCount: result.candidateCount,
        verifiedCount: 0,
        rejectedCount,
        duplicateCount: result.duplicateSourceCount,
        noAction: true,
        error: error ?? null,
      });
      return result;
    };

    let searched: WorldSearchResult[][];
    try {
      searched = await Promise.all(
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logAiActivity({
        personaId: persona.id,
        actorName: persona.display_name || persona.persona_name,
        actorRole: "world_scout",
        action: "error",
        detail: message,
        relatedRunId: options?.runId ?? null,
      });
      return empty({}, message);
    }

    const merged = mergeResults(searched.flat());
    const { fresh, skipped } = filterFreshSources(
      merged,
      session.memory.recentSources,
    );
    const news = [
      ...sharedWorldNews.filter(isNewsSignal),
      ...fresh.filter(isNewsSignal),
    ];
    const products = fresh.filter(isProductSource);
    const sourceIdsByHash = await recordCheckedSources(
      session,
      merged.map((result) => ({
        sourceUrl: result.url,
        sourceName: result.domain || result.title,
        sourceType: result.sourceType,
        publishedAt: result.publishedAt ?? null,
        title: result.title,
        snippet: result.snippet,
      })),
    );

    let rejectedCount = 0;
    let duplicateSourceCount = skipped.filter(
      (item) => item.freshness === "duplicate",
    ).length;

    for (const item of skipped.slice(0, 5)) {
      rejectedCount += 1;
      await recordFinding({
        session,
        title: item.item.title || item.item.url,
        description: item.item.snippet,
        sourceUrl: item.item.url,
        sourceIdsByHash,
        status: item.freshness === "duplicate" ? "duplicate" : "rejected",
        reason: item.freshness === "duplicate" ? "duplicate" : "stale",
      });
    }

    if (products.length === 0) {
      await logAiActivity({
        personaId: persona.id,
        actorName: persona.display_name || persona.persona_name,
        actorRole: "world_scout",
        action: "no_action",
        detail: `search=${merged.length} fresh=${fresh.length} news=${news.length} no product sources`,
        relatedRunId: options?.runId ?? null,
      });
      return empty({
        searchCount: merged.length,
        duplicateSourceCount,
        rejectedCount,
      });
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
      metadata: { researchRunId: session.runId },
    });

    const assigned: string[] = [];
    let savedCount = 0;
    let verifiedCount = 0;
    const candidateUrls = new Set(
      candidates.map((candidate) =>
        candidate.productUrl.replace(/\/$/, "").toLowerCase(),
      ),
    );

    for (const product of products.slice(0, 5)) {
      const key = product.url.replace(/\/$/, "").toLowerCase();
      if (candidateUrls.has(key)) continue;
      const quality = sourceQualityFromType(product.sourceType);
      rejectedCount += 1;
      await recordFinding({
        session,
        title: product.title || product.url,
        description: product.snippet,
        sourceUrl: product.url,
        sourceIdsByHash,
        status: "rejected",
        reason: isLowQualitySource(quality)
          ? "low_quality"
          : "insufficient_information",
      });
    }

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

      const status = verificationStatus({
        isNew: saved.isNew,
        verified: saved.status === "pending",
      });
      if (status === "verified") verifiedCount += 1;
      if (status === "duplicate") duplicateSourceCount += 1;

      const findingId = await recordFinding({
        session,
        title,
        description: candidate.description,
        sourceUrl: candidate.productUrl,
        sourceIdsByHash,
        status,
        reason:
          status === "duplicate"
            ? "duplicate"
            : status === "verified"
              ? "product page verified"
              : "insufficient_information",
        category: candidate.category,
        confidence: candidate.confidenceScore,
        destinationApp: "newfind",
        destinationKind: "discovery_product",
        destinationId: saved.productId,
        metadata: {
          brand: candidate.brand,
          productName: candidate.productName,
          origin: candidate.origin,
        },
      });

      if (status !== "verified") continue;

      const handoff = await assignDiscoveryToResident({
        productId: saved.productId,
        category: candidate.category,
        country: candidate.country || beat.countryCode,
        title,
        scoutName: persona.display_name || persona.persona_name,
        runId: options?.runId ?? null,
      });
      if (handoff) assigned.push(handoff.personaName);

      await recordResidentHandoff({
        session,
        findingId,
        toPersonaId: handoff?.personaId ?? null,
        toPersonaName: handoff?.personaName ?? null,
        title,
      });
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

    await completeAgentResearch({
      session,
      queries: planned.map((item) => item.query),
      sourcesChecked: merged.length,
      findingsCount: candidates.length + rejectedCount,
      verifiedCount,
      rejectedCount,
      duplicateCount: duplicateSourceCount,
      noAction,
    });

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completeAgentResearch({
      session,
      queries: [],
      sourcesChecked: 0,
      findingsCount: 0,
      verifiedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      noAction: true,
      error: message,
    });
    throw error;
  }
}
