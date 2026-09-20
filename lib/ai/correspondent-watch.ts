import type { AiPersona } from "@/lib/ai-post-engine";
import type { WorldSearchResult } from "@/lib/ai/world-search";
import { searchWorld, buildResidentSearchQuery } from "@/lib/ai/world-search";
import type { GoogleTrend } from "@/lib/ai/google-trends";
import type { Experience, Intent, SelfState } from "@/lib/ai/self-model";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  beatForPersona,
  classifyWorldInfo,
  correspondentQuery,
  decideWorldDispatch,
  detectTrendClusters,
  scoreWorldSignal,
  shouldExploreWorld,
  shouldExtraSearch,
  titleSimilar,
  worldInfoKey,
  worldQualityGate,
  type CorrespondentBeat,
  type InfoKind,
  type PeerWorldSignal,
  type WorldDispatch,
} from "@/lib/ai/correspondent";
import {
  correspondentIdentityFromLens,
  correspondentViewpoint,
} from "@/lib/ai/correspondent-identity";
import type { ExplorationQuest } from "@/lib/ai/today-exploration";

export type CorrespondentWatchResult = {
  beat: CorrespondentBeat;
  identityTitle?: string;
  city?: string;
  query: string | null;
  scanned: number;
  classified: Partial<Record<InfoKind, number>>;
  accepted: WorldDispatch[];
  dropped: Array<{ title: string; url: string; reason: string }>;
  trends: Array<{ theme: string; count: number }>;
  searched: boolean;
  searchPasses?: number;
  newResultCount?: number;
  exploration?: {
    axis: string;
    goal: string;
    region: string;
    queries: string[];
    sources: string[];
  } | null;
};

export async function loadPeerWorldSignals(
  excludePersonaId?: string,
): Promise<PeerWorldSignal[]> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 36 * 36e5).toISOString();
    const { data, error } = await admin
      .from("ai_activity_logs")
      .select("persona_id, actor_name, detail, metadata, occurred_at")
      .gte("occurred_at", since)
      .in("action", ["candidate_found", "posted", "ai_decision"])
      .order("occurred_at", { ascending: false })
      .limit(80);
    if (error || !data) return [];
    return data
      .map((row) => {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        if (meta.world !== true) return null;
        const url = String(meta.url ?? "");
        const title = String(meta.title ?? row.detail ?? "");
        if (!url || !title) return null;
        if (excludePersonaId && row.persona_id === excludePersonaId) return null;
        return {
          fromPersonaId: String(row.persona_id ?? ""),
          fromName: String(row.actor_name ?? "resident"),
          title,
          url,
          infoKind: (meta.infoKind as InfoKind) || "NEWS",
          beat: String(meta.beat ?? ""),
        } satisfies PeerWorldSignal;
      })
      .filter((item): item is PeerWorldSignal => Boolean(item))
      .slice(0, 16);
  } catch {
    return [];
  }
}

function trendToWorldResult(trend: GoogleTrend): WorldSearchResult {
  return {
    title: trend.title,
    url: trend.link || `https://trends.google.com/trending?q=${encodeURIComponent(trend.title)}`,
    snippet: `Trend signal ${trend.traffic || ""} ${(trend.relatedQueries ?? []).slice(0, 3).join(", ")}`.trim(),
    sourceType: "other",
    domain: "trends.google.com",
    publishedAt: trend.publishedAt,
    sourceRole: "news",
    origin: "web",
    retrievedAt: new Date().toISOString(),
  };
}

export async function watchWorldForResident(
  persona: AiPersona,
  input: {
    intent: Intent;
    selfState?: SelfState | null;
    experiences?: Experience[];
    worldNews: WorldSearchResult[];
    googleTrends: GoogleTrend[];
    peerSignals?: PeerWorldSignal[];
    hunterUrls?: string[];
    dryRun?: boolean;
    runId?: string | null;
    exploration?: ExplorationQuest | null;
  },
): Promise<CorrespondentWatchResult> {
  const identity = correspondentIdentityFromLens({
    username: persona.username,
    name: persona.persona_name,
    displayName: persona.display_name,
    role: persona.resident_role,
    expertise: persona.expertise,
    interests: persona.interests,
    preferredCategories: persona.preferred_categories,
    huntingSpecialty: (persona.expertise ?? []).slice(0, 3).join(" / "),
    countryCode: persona.country_code,
    region: persona.region,
    languages: persona.languages,
    goals: persona.goals,
  });
  const beat = beatForPersona({
    username: persona.username,
    name: persona.persona_name,
    role: persona.resident_role,
    expertise: persona.expertise,
    interests: persona.interests,
    preferredCategories: persona.preferred_categories,
    huntingSpecialty: (persona.expertise ?? []).slice(0, 3).join(" / "),
    countryCode: persona.country_code,
    region: persona.region,
    languages: persona.languages,
    lastFocus: input.intent.focus,
    goals: persona.goals,
  });
  const empty: CorrespondentWatchResult = {
    beat,
    identityTitle: identity.title,
    city: identity.city,
    query: null,
    scanned: 0,
    classified: {},
    accepted: [],
    dropped: [],
    trends: [],
    searched: false,
    searchPasses: 0,
    newResultCount: 0,
    exploration: input.exploration
      ? {
          axis: input.exploration.axis,
          goal: input.exploration.goal,
          region: input.exploration.city,
          queries: input.exploration.queries,
          sources: input.exploration.sources,
        }
      : null,
  };
  if (!shouldExploreWorld({
    intent: input.intent,
    role: persona.resident_role,
    activityLevel: persona.activity_level,
  })) {
    return empty;
  }

  const peer = (input.peerSignals ?? []).find((item) =>
    item.beat === beat.primary ||
    beat.secondary.includes(item.beat) ||
    `${item.title} ${item.infoKind}`.toLowerCase().includes(beat.primary),
  ) ?? null;
  const query = input.exploration?.queries[0]
    || correspondentQuery({ beat, intent: input.intent, peer, identity });
  let extra: WorldSearchResult[] = [];
  let searched = false;
  let searchPasses = 0;
  if (shouldExtraSearch({
    intent: input.intent,
    role: persona.resident_role,
    activityLevel: persona.activity_level,
  })) {
    const planned = buildResidentSearchQuery({
      residentName: persona.persona_name,
      interests: persona.interests ?? [],
      preferredCategories: persona.preferred_categories ?? [],
      goals: persona.goals ?? [],
      country: persona.country_code,
      language: persona.languages?.[0],
      expertise: persona.expertise ?? [],
      values: persona.values ?? [],
      region: identity.city || persona.region,
      discoveryKeywords: identity.searchTerms,
      huntingSpecialty: identity.primaryBeat,
    });
    const passQueries = uniqueStrings([
      query,
      ...(input.exploration?.queries ?? []),
    ]).slice(0, 3);
    for (const passQuery of passQueries) {
      try {
        const more = await searchWorld({
          ...planned,
          residentId: persona.id,
          query: passQuery,
          region: input.exploration?.city || identity.city || persona.region,
          includeDomains:
            searchPasses === 0 ? input.exploration?.includeDomains : undefined,
          excludeDomains: input.exploration?.excludeDomains,
        });
        extra = [...extra, ...more];
        searched = true;
        searchPasses += 1;
        const fresh = more.filter((item) => {
          const key = canonicalizeSafe(item.url);
          return key && !input.experiences?.some((exp) => (exp.entityKey || "").includes(key));
        });
        if (fresh.length >= 3) break;
      } catch (error) {
        console.warn("correspondent extra search failed", persona.persona_name, error);
      }
    }
  }

  const pool = [
    ...input.worldNews,
    ...input.googleTrends.slice(0, 8).map(trendToWorldResult),
    ...extra,
  ];
  const unique = new Map<string, WorldSearchResult>();
  for (const item of pool) {
    const key = canonicalizeSafe(item.url);
    if (!key || unique.has(key)) continue;
    unique.set(key, item);
  }
  const results = [...unique.values()];
  const knownKeys = new Set([
    ...(input.experiences ?? []).map((item) => item.entityKey || item.seen),
    ...(input.hunterUrls ?? []),
    ...(input.peerSignals ?? []).map((item) => worldInfoKey(item.url, item.title)),
  ]);
  const peerTitles = (input.peerSignals ?? []).map((item) => item.title);
  const classified: Partial<Record<InfoKind, number>> = {};
  const accepted: WorldDispatch[] = [];
  const dropped: Array<{ title: string; url: string; reason: string }> = [];

  for (const result of results.slice(0, 24)) {
    const infoKind = classifyWorldInfo(result);
    classified[infoKind] = (classified[infoKind] ?? 0) + 1;
    const key = worldInfoKey(result.url, result.title);
    const known = knownKeys.has(key) || knownKeys.has(result.url);
    const followUp = (input.peerSignals ?? []).some(
      (item) => item.url === result.url || titleSimilar(item.title, result.title),
    );
    const quality = worldQualityGate({ result, infoKind });
    const scores = scoreWorldSignal({
      result,
      infoKind,
      beat,
      knownKeys,
      peerTitles,
    });
    const decision = decideWorldDispatch({
      persona: {
        name: persona.persona_name,
        username: persona.username,
        role: persona.resident_role,
        values: persona.values,
        interests: persona.interests,
        expertise: persona.expertise,
        activityLevel: persona.activity_level,
        huntingSpecialty: beat.primary,
      },
      beat,
      intent: input.intent,
      infoKind,
      scores,
      qualityOk: quality.ok,
      qualityReason: quality.reason,
      known,
      followUp,
    });
    const dispatch: WorldDispatch = {
      infoKind,
      dispatchKind: decision.dispatchKind,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      sourceType: result.sourceType,
      domain: result.domain,
      publishedAt: result.publishedAt ?? null,
      scores,
      decision: decision.decision,
      reason: `${decision.reason} | ${correspondentViewpoint(identity, `${result.title} ${result.snippet}`)}`,
      provenance: `${result.sourceType}:${result.url}`,
      dropReason: decision.dropReason,
    };
    if (decision.decision === "POST") accepted.push(dispatch);
    else dropped.push({ title: result.title, url: result.url, reason: decision.dropReason || decision.reason });
  }

  const trends = detectTrendClusters([...accepted, ...dropped].map((item) => ({
    title: item.title,
    url: item.url,
  })));
  if (trends[0] && trends[0].count >= 2) {
    const theme = trends[0].theme;
    for (const item of accepted) {
      if (titleSimilar(item.title, theme) || compactHas(item.title, theme)) {
        item.dispatchKind = "TREND";
      }
    }
  }

  accepted.sort((a, b) => b.scores.total - a.scores.total);
  const top = accepted.slice(0, persona.activity_level === "high" ? 3 : 1);

  if (!input.dryRun) {
    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: persona.resident_role || "resident",
      action: top.length ? "ai_decision" : "no_action",
      detail: top[0]
        ? `${top[0].dispatchKind} ${top[0].infoKind}: ${top[0].title}`
        : `correspondent scanned ${results.length}, posted 0`,
      relatedRunId: input.runId ?? null,
      metadata: {
        world: true,
        beat: beat.primary,
        identityTitle: identity.title,
        city: identity.city,
        fromPeer: peer?.fromName ?? null,
        followUpTitle: peer?.title ?? null,
        query,
        scanned: results.length,
        classified,
        accepted: top.length,
        dropped: dropped.length,
        exploration: input.exploration
          ? {
              axis: input.exploration.axis,
              goal: input.exploration.goal,
              region: input.exploration.city,
              queries: passQueriesSafe(input.exploration.queries, query),
              sources: input.exploration.sources,
              searchPasses,
            }
          : null,
        title: top[0]?.title,
        url: top[0]?.url,
        infoKind: top[0]?.infoKind,
        dispatchKind: top[0]?.dispatchKind,
        scores: top[0]?.scores,
        trends,
      },
    });
  }

  return {
    beat,
    identityTitle: identity.title,
    city: identity.city,
    query,
    scanned: results.length,
    classified,
    accepted: top,
    dropped: dropped.slice(0, 20),
    trends,
    searched,
    searchPasses,
    newResultCount: extra.length,
    exploration: input.exploration
      ? {
          axis: input.exploration.axis,
          goal: input.exploration.goal,
          region: input.exploration.city,
          queries: input.exploration.queries,
          sources: input.exploration.sources,
        }
      : null,
  };
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    const folded = key.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(key);
  }
  return out;
}

function passQueriesSafe(queries: string[], fallback: string) {
  return uniqueStrings([fallback, ...queries]).slice(0, 3);
}

function canonicalizeSafe(url: string) {
  try {
    return url.replace(/\/$/, "").toLowerCase();
  } catch {
    return url;
  }
}

function compactHas(title: string, theme: string) {
  return title.toLowerCase().includes(theme.toLowerCase());
}
