/**
 * World correspondent layer for NEWFIND residents.
 * Deterministic: classify, score, and decide whether a world signal
 * is worth posting. Does not invent facts, products, or URLs.
 */

import {
  isLowQualitySource,
  sourceQualityFromType,
  type SourceQuality,
} from "@/lib/ai/agent-os/quality";
import { canonicalizeSourceUrl } from "@/lib/ai/agent-os/hash";
import type { WorldSearchResult } from "@/lib/ai/world-search";
import type { Intent, PersonaLens, ResidentChoice, Stance } from "@/lib/ai/self-model";
import { shouldSearchNow } from "@/lib/ai/self-model";
import {
  correspondentIdentityFromLens,
  correspondentViewpoint,
  type CorrespondentIdentity,
} from "@/lib/ai/correspondent-identity";

export const INFO_KINDS = [
  "PRODUCT",
  "NEWS",
  "TREND",
  "BRAND",
  "SERVICE",
  "CULTURE",
  "RESEARCH",
  "GENERAL",
] as const;

export type InfoKind = (typeof INFO_KINDS)[number];

export const DISPATCH_KINDS = [
  "BREAKING",
  "DISCOVERY",
  "TREND",
  "DEEP_DIVE",
  "FOLLOW_UP",
] as const;

export type DispatchKind = (typeof DISPATCH_KINDS)[number];

export type CorrespondentBeat = {
  primary: string;
  secondary: string[];
  regions: string[];
  languages: string[];
  sources: string[];
  expertise: string[];
  curiosity: string;
};

export type WorldSignalScores = {
  freshness: number;
  novelty: number;
  sourceQuality: number;
  relevance: number;
  globalSignal: number;
  total: number;
};

export type PeerWorldSignal = {
  fromPersonaId: string;
  fromName: string;
  title: string;
  url: string;
  infoKind: InfoKind;
  beat: string;
};

export type WorldDispatch = {
  infoKind: InfoKind;
  dispatchKind: DispatchKind;
  title: string;
  url: string;
  snippet: string;
  sourceType: string;
  domain: string;
  publishedAt: string | null;
  scores: WorldSignalScores;
  decision: ResidentChoice;
  reason: string;
  provenance: string;
  dropReason?: string;
};

function compact(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(value: string) {
  return compact(value)
    .split(" ")
    .filter((item) => item.length >= 4)
    .slice(0, 12);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function beatForPersona(input: {
  username?: string | null;
  name?: string | null;
  displayName?: string | null;
  role?: string | null;
  expertise?: string[] | null;
  interests?: string[] | null;
  preferredCategories?: string[] | null;
  huntingSpecialty?: string | null;
  countryCode?: string | null;
  region?: string | null;
  languages?: string[] | null;
  lastFocus?: string | null;
  goals?: string[] | null;
}): CorrespondentBeat {
  const identity = correspondentIdentityFromLens({
    ...input,
    displayName: input.displayName || input.name,
  });
  return beatFromIdentity(identity, input.lastFocus);
}

export function beatFromIdentity(
  identity: CorrespondentIdentity,
  lastFocus?: string | null,
): CorrespondentBeat {
  return {
    primary: identity.primaryBeat,
    secondary: identity.subSpecialties.slice(0, 3),
    regions: identity.territories,
    languages: ["en"],
    sources: ["official", "press", "specialty_media", "news"],
    expertise: identity.specialties,
    curiosity: lastFocus || identity.city,
  };
}

export function classifyWorldInfo(result: {
  title: string;
  url: string;
  snippet?: string | null;
  sourceType?: string | null;
  sourceRole?: string | null;
}): InfoKind {
  const text = `${result.title} ${result.snippet ?? ""}`.toLowerCase();
  const path = result.url.toLowerCase();
  const role = (result.sourceRole || "").toLowerCase();
  const type = (result.sourceType || "").toLowerCase();

  if (role === "product" || /\/products?\//i.test(path)) return "PRODUCT";
  if (
    /research|study|whitepaper|arxiv|journal/.test(text) ||
    /\/research\//.test(path)
  ) {
    return "RESEARCH";
  }
  if (
    /launch|released|announces|発表|新作|debut/.test(text) &&
    /app|saas|platform|service|subscription/.test(text)
  ) {
    return "SERVICE";
  }
  if (
    type === "brand_official" &&
    (/\/about|brand|maison|house/.test(path) || /brand|maison/.test(text))
  ) {
    return "BRAND";
  }
  if (
    /trend|viral|rising|急上昇|流行/.test(text) ||
    type === "sns"
  ) {
    return "TREND";
  }
  if (
    /festival|culture|museum|exhibition|音楽|映画|art/.test(text)
  ) {
    return "CULTURE";
  }
  if (role === "news" || type === "news" || /\/news\/|press/.test(path)) {
    return "NEWS";
  }
  if (role === "general") return "GENERAL";
  return "NEWS";
}

export function worldInfoKey(url: string, title?: string) {
  const canonical = canonicalizeSourceUrl(url);
  const titlePart = compact(title || "").slice(0, 48);
  return `${canonical}::${titlePart}`;
}

export function titleSimilar(a: string, b: string) {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return false;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.min(left.size, right.size) >= 0.6;
}

export function scoreWorldSignal(input: {
  result: WorldSearchResult;
  infoKind: InfoKind;
  beat: CorrespondentBeat;
  knownKeys: Set<string>;
  peerTitles?: string[];
}): WorldSignalScores {
  const published = input.result.publishedAt
    ? Date.parse(input.result.publishedAt)
    : NaN;
  const ageHours = Number.isFinite(published)
    ? (Date.now() - published) / 36e5
    : 72;
  const freshness =
    ageHours <= 12 ? 95 : ageHours <= 48 ? 80 : ageHours <= 24 * 14 ? 55 : 20;

  const key = worldInfoKey(input.result.url, input.result.title);
  const known = input.knownKeys.has(key) ||
    (input.peerTitles ?? []).some((title) => titleSimilar(title, input.result.title));
  const novelty = known ? 15 : 78;

  const qualityTier: SourceQuality = sourceQualityFromType(input.result.sourceType);
  const sourceQuality = qualityTier === 1 ? 95 : qualityTier === 2 ? 78 : qualityTier === 3 ? 55 : 22;

  const haystack = `${input.result.title} ${input.result.snippet} ${input.result.domain}`.toLowerCase();
  const needles = [input.beat.primary, ...input.beat.secondary, ...input.beat.expertise];
  const hits = needles.filter((item) => item && haystack.includes(item.toLowerCase())).length;
  let relevance = hits === 0 ? 18 : clamp(40 + hits * 18);
  if (input.beat.curiosity && haystack.includes(input.beat.curiosity.toLowerCase())) {
    relevance = clamp(relevance + 14);
  }

  const regionHit = input.beat.regions.some((region) =>
    haystack.includes(region.toLowerCase()),
  );
  const homeHit = Boolean(
    input.beat.curiosity && haystack.includes(input.beat.curiosity.toLowerCase()),
  );
  const globalSignal = homeHit ? 82 : regionHit ? 70 : /international|global|world|海外/.test(haystack) ? 50 : 28;

  const total = clamp(
    freshness * 0.25 +
      novelty * 0.25 +
      sourceQuality * 0.2 +
      relevance * 0.2 +
      globalSignal * 0.1,
  );
  return { freshness, novelty, sourceQuality, relevance, globalSignal, total };
}

export function worldQualityGate(input: {
  result: WorldSearchResult;
  infoKind: InfoKind;
}): { ok: boolean; reason: string } {
  if (!/^https?:\/\//i.test(input.result.url)) {
    return { ok: false, reason: "URL_INVALID" };
  }
  if (!input.result.title || input.result.title.trim().length < 8) {
    return { ok: false, reason: "LOW_EVIDENCE" };
  }
  if (input.result.sourceType === "sns") {
    return { ok: false, reason: "WEAK_SOURCE" };
  }
  if (input.infoKind === "GENERAL") {
    return { ok: false, reason: "NOT_RELEVANT" };
  }
  if (input.infoKind === "PRODUCT" && input.result.sourceRole === "news") {
    return { ok: false, reason: "NOT_PRODUCT" };
  }
  if (isLowQualitySource(sourceQualityFromType(input.result.sourceType)) && input.infoKind !== "TREND") {
    return { ok: false, reason: "QUALITY_REJECTED" };
  }
  return { ok: true, reason: "ok" };
}

export function decideWorldDispatch(input: {
  persona: PersonaLens;
  beat: CorrespondentBeat;
  intent: Intent;
  infoKind: InfoKind;
  scores: WorldSignalScores;
  qualityOk: boolean;
  qualityReason: string;
  known: boolean;
  followUp: boolean;
}): { decision: ResidentChoice; dispatchKind: DispatchKind; reason: string; dropReason?: string } {
  const role = (input.persona.role || "").toLowerCase();
  const activity = input.persona.activityLevel || "medium";
  const threshold = activity === "high" ? 55 : activity === "low" ? 75 : 62;

  if (!input.qualityOk) {
    return {
      decision: input.qualityReason === "LOW_EVIDENCE" ? "INVESTIGATE_MORE" : "IGNORE",
      dispatchKind: "DISCOVERY",
      reason: input.qualityReason,
      dropReason: input.qualityReason,
    };
  }
  if (input.known && !input.followUp) {
    return {
      decision: "WAIT",
      dispatchKind: "FOLLOW_UP",
      reason: "already circulating in NEWFIND",
      dropReason: "DUPLICATE",
    };
  }
  if (input.infoKind === "PRODUCT" && role !== "product_hunter") {
    return {
      decision: "OBSERVE",
      dispatchKind: "DISCOVERY",
      reason: "product pages are hunter work, not a news dispatch",
      dropReason: "NOT_PRODUCT",
    };
  }
  if (input.infoKind === "PRODUCT" && role === "product_hunter") {
    return {
      decision: input.scores.relevance >= 30 && input.scores.total >= 60 ? "SAVE" : "INVESTIGATE_MORE",
      dispatchKind: "DISCOVERY",
      reason: "product belongs on the hunter path",
    };
  }
  if (input.scores.relevance < 30) {
    return {
      decision: "IGNORE",
      dispatchKind: "DISCOVERY",
      reason: "outside this correspondent's beat",
      dropReason: "SPECIALTY_MISMATCH",
    };
  }
  if (input.scores.total < threshold) {
    return {
      decision: "WAIT",
      dispatchKind: "DISCOVERY",
      reason: `below post-worth threshold ${threshold}`,
      dropReason: "AI_REJECTED",
    };
  }
  if (input.intent.stance === "wait" || input.intent.stance === "rest") {
    return {
      decision: "WAIT",
      dispatchKind: "FOLLOW_UP",
      reason: "resident is resting",
      dropReason: "WAIT",
    };
  }

  const dispatchKind: DispatchKind = input.followUp
    ? "FOLLOW_UP"
    : input.infoKind === "TREND"
      ? "TREND"
      : input.scores.freshness >= 85
        ? "BREAKING"
        : input.intent.stance === "investigate"
          ? "DEEP_DIVE"
          : "DISCOVERY";

  if (role === "critic" && input.scores.sourceQuality < 70) {
    return {
      decision: "INVESTIGATE_MORE",
      dispatchKind,
      reason: "critic needs a stronger source before amplifying",
    };
  }

  return {
    decision: "POST",
    dispatchKind,
    reason: `${input.infoKind.toLowerCase()} is worth telling NEWFIND about`,
  };
}

export function shouldExploreWorld(input: {
  intent: Intent;
  role?: string | null;
  activityLevel?: string | null;
}): boolean {
  const role = (input.role || "").toLowerCase();
  if (role === "world_scout") return false;
  if (input.intent.stance === "wait" || input.intent.stance === "rest") return false;
  if (input.intent.stance === "observe") {
    return (
      role === "media" ||
      role === "trend_hunter" ||
      role === "critic" ||
      role === "curator" ||
      input.activityLevel === "high"
    );
  }
  return true;
}

export function shouldExtraSearch(input: {
  intent: Intent;
  role?: string | null;
  activityLevel?: string | null;
}): boolean {
  if (!shouldExploreWorld(input)) return false;
  if (input.intent.stance === "wait" || input.intent.stance === "rest") return false;
  const role = (input.role || "").toLowerCase();
  if (role === "media" || role === "trend_hunter" || role === "critic" || role === "curator") {
    return true;
  }
  if (input.intent.stance === "explore" || input.intent.stance === "investigate" || input.intent.stance === "follow_up") {
    return true;
  }
  return input.activityLevel === "high";
}

export function correspondentQuery(input: {
  beat: CorrespondentBeat;
  intent: Intent;
  peer?: PeerWorldSignal | null;
  identity?: CorrespondentIdentity | null;
}): string {
  const identityTerms = input.identity?.searchTerms ?? [];
  const terms = input.intent.terms.length
    ? input.intent.terms.slice(0, 3)
    : identityTerms.slice(0, 3).length
      ? identityTerms.slice(0, 3)
      : [input.beat.primary, input.beat.curiosity].filter(Boolean);
  const place = input.identity?.city || input.beat.curiosity || input.beat.regions[0] || "";
  const peer = input.peer?.title ? tokens(input.peer.title).slice(0, 2).join(" ") : "";
  const axis = input.intent.focus.split(" ").slice(0, 4).join(" ");
  return [peer || terms.join(" "), input.beat.primary, place, axis, "new"]
    .filter(Boolean)
    .join(" ")
    .slice(0, 160);
}

export function detectTrendClusters(items: Array<{ title: string; url: string }>) {
  const clusters = new Map<string, string[]>();
  for (const item of items) {
    for (const token of tokens(item.title).slice(0, 4)) {
      const list = clusters.get(token) ?? [];
      list.push(item.url);
      clusters.set(token, list);
    }
  }
  return [...clusters.entries()]
    .filter(([, urls]) => new Set(urls).size >= 2)
    .map(([theme, urls]) => ({ theme, count: new Set(urls).size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function correspondentStanceFromRole(role?: string | null): Stance {
  const value = (role || "").toLowerCase();
  if (value === "media" || value === "trend_hunter") return "explore";
  if (value === "critic") return "observe";
  if (value === "curator") return "observe";
  return "explore";
}
