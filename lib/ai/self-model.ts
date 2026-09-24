/**
 * Deterministic self-model for NEWFIND residents and sales agents.
 * LLM is not required: thought → intent → decision → action → outcome
 * must change state here, then persistence writes the snapshot.
 */

import { hunterLane, textFitsHunterSpecialty } from "@/lib/ai/specialty-fit";
import { correspondentIdentityFromLens } from "@/lib/ai/correspondent-identity";
import { planTodayExploration } from "@/lib/ai/today-exploration";

export type Stance =
  | "explore"
  | "investigate"
  | "observe"
  | "interact"
  | "reflect"
  | "rest"
  | "follow_up"
  | "wait";

export type ResidentChoice =
  | "IGNORE"
  | "SAVE"
  | "INVESTIGATE_MORE"
  | "DISCOVER"
  | "POST"
  | "COMMENT"
  | "FOLLOW"
  | "WAIT"
  | "OBSERVE";

export type RelationshipKind =
  | "friend"
  | "interesting"
  | "trusted"
  | "disagree"
  | "similar_interest"
  | "competitor"
  | "unknown";

export type Experience = {
  seen: string;
  judgment: ResidentChoice;
  reason: string;
  outcome: string;
  next: string;
  entityKey?: string;
  at: string;
};

export type Intent = {
  stance: Stance;
  focus: string;
  why: string;
  terms: string[];
  avoid: string[];
};

export type DecisionRecord = {
  decision: ResidentChoice;
  reasonSummary: string;
  confidence: number;
  evidenceIds: string[];
  alternativeCount: number;
  uncertainty: number;
  known: string;
  unknown: string;
};

export type SelfState = {
  identity: string;
  role: string;
  correspondentTitle: string;
  correspondentCity: string;
  primaryBeat: string;
  currentIntent: Intent;
  currentFocus: string;
  confidence: number;
  likes: string[];
  dislikes: string[];
  beliefs: string[];
  relationships: Record<string, RelationshipKind>;
  lastDecision: DecisionRecord | null;
  lastOutcome: string;
  nextIntent: Intent | null;
  autonomyLevel: 0 | 1 | 2 | 3 | 4;
  updatedAt: string;
};

export type PersonaLens = {
  id?: string;
  name: string;
  username?: string | null;
  role?: string | null;
  personality?: string;
  values?: string[];
  interests?: string[];
  expertise?: string[];
  goals?: string[];
  activityLevel?: "low" | "medium" | "high";
  lastAction?: string | null;
  huntingSpecialty?: string;
  countryCode?: string | null;
  region?: string | null;
  languages?: string[] | null;
};

export type ProductView = {
  brand: string;
  productName: string;
  url?: string;
  category?: string;
  description?: string;
  evidenceScore?: number;
  specialtyFit?: number;
  origin?: string;
  officialUrl?: string | null;
};

const MAX_LIKES = 8;
const MAX_DISLIKES = 8;
const MAX_BELIEFS = 6;

export function autonomyCeiling(role: string | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const value = (role || "").toLowerCase();
  if (value === "world_scout") return 2;
  if (value === "product_hunter") return 3;
  if (value === "sales") return 3;
  return 4;
}

export function emptyIntent(focus = "specialty"): Intent {
  return {
    stance: "explore",
    focus,
    why: "default specialty exploration",
    terms: [],
    avoid: [],
  };
}

export function buildSelfState(persona: PersonaLens, previous?: SelfState | null): SelfState {
  const role = persona.role || "general_user";
  const identity = correspondentIdentityFromLens({
    username: persona.username,
    name: persona.name,
    role: persona.role,
    expertise: persona.expertise,
    interests: persona.interests,
    huntingSpecialty: persona.huntingSpecialty,
    countryCode: persona.countryCode,
    region: persona.region,
    languages: persona.languages,
    goals: persona.goals,
  });
  const focus =
    previous?.currentFocus ||
    identity.searchTerms.slice(0, 3).join(" / ") ||
    (persona.expertise ?? []).slice(0, 2).join(" / ") ||
    "world";
  const intent = previous?.nextIntent || previous?.currentIntent || emptyIntent(focus);
  return {
    identity: persona.name,
    role,
    correspondentTitle: identity.title,
    correspondentCity: identity.city,
    primaryBeat: identity.primaryBeat,
    currentIntent: intent,
    currentFocus: intent.focus || focus,
    confidence: previous?.confidence ?? 55,
    likes: previous?.likes?.slice(0, MAX_LIKES) ?? (persona.interests ?? []).slice(0, 4),
    dislikes: previous?.dislikes?.slice(0, MAX_DISLIKES) ?? [],
    beliefs: previous?.beliefs?.slice(0, MAX_BELIEFS) ?? (persona.values ?? []).slice(0, 3),
    relationships: previous?.relationships ?? {},
    lastDecision: previous?.lastDecision ?? null,
    lastOutcome: previous?.lastOutcome ?? "",
    nextIntent: previous?.nextIntent ?? null,
    autonomyLevel: autonomyCeiling(role),
    updatedAt: previous?.updatedAt ?? new Date(0).toISOString(),
  };
}

function pushUnique(list: string[], value: string, max: number) {
  const token = value.trim().toLowerCase();
  if (!token) return list;
  const next = [token, ...list.filter((item) => item !== token)];
  return next.slice(0, max);
}

export function entityKeyFromProduct(product: ProductView) {
  return `${product.brand}|${product.productName}|${product.url || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOverlap(a: string, b: string) {
  const left = a.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((item) => item.length >= 4);
  const right = new Set(b.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((item) => item.length >= 4));
  return left.some((item) => right.has(item));
}

export function formIntent(input: {
  persona: PersonaLens;
  state: SelfState;
  experiences: Experience[];
  peerSignals?: Array<{ title: string; beat?: string; fromName?: string }>;
  recentQuests?: import("@/lib/ai/today-exploration").ExplorationQuest[];
  openInvestigations?: Array<{ title: string; status?: string }>;
}): Intent {
  const recent = input.experiences.slice(0, 6);
  const last = recent[0];
  const identity = correspondentIdentityFromLens({
    username: input.persona.username,
    name: input.persona.name,
    role: input.persona.role,
    expertise: input.persona.expertise,
    interests: input.persona.interests,
    huntingSpecialty: input.persona.huntingSpecialty,
    countryCode: input.persona.countryCode,
    region: input.persona.region,
    languages: input.persona.languages,
    goals: input.persona.goals,
  });
  const specialty =
    input.persona.huntingSpecialty ||
    identity.specialties.slice(0, 2).join(" ") ||
    (input.persona.expertise ?? []).slice(0, 2).join(" ") ||
    (input.persona.interests ?? []).slice(0, 2).join(" ") ||
    "product";
  const avoid = [
    ...input.state.currentIntent.avoid,
    ...recent
      .filter((item) => item.judgment === "IGNORE" || item.judgment === "WAIT")
      .map((item) => item.entityKey || item.seen)
      .filter(Boolean),
  ].slice(0, 10);

  const openLead = input.openInvestigations?.[0];
  if (openLead) {
    return {
      stance: "investigate",
      focus: openLead.title.slice(0, 80),
      why: `continue ${openLead.status || "investigation"} as ${identity.title} in ${identity.city}`,
      terms: uniqueStrings(
        [openLead.title, identity.city, identity.primaryBeat, specialty],
        5,
      ),
      avoid,
    };
  }

  if (last?.judgment === "INVESTIGATE_MORE") {
    return {
      stance: "investigate",
      focus: (last.seen || input.state.currentFocus).slice(0, 80),
      why: last.next || `keep investigating as ${identity.title}`,
      terms: uniqueStrings([last.seen, identity.city, identity.primaryBeat], 5),
      avoid,
    };
  }

  const peer = (input.peerSignals ?? []).find((item) => {
    const lens = `${specialty} ${(input.persona.expertise ?? []).join(" ")} ${(input.persona.interests ?? []).join(" ")}`.toLowerCase();
    const beat = (item.beat || "").toLowerCase();
    if (beat && lens.includes(beat)) return true;
    return tokensOverlap(specialty, item.title);
  });
  if (peer && last?.judgment !== "SAVE" && last?.judgment !== "DISCOVER" && last?.judgment !== "POST") {
    const peerTerms = peer.title.split(/\s+/).filter((item) => item.length > 3);
    return {
      stance: "follow_up",
      focus: peer.title.slice(0, 80),
      why: `${peer.fromName || "another resident"} found this; I follow up as ${identity.title}`,
      terms: [...peerTerms, identity.city, identity.primaryBeat].filter(Boolean).slice(0, 5),
      avoid,
    };
  }

  const quest = planTodayExploration({
    persona: input.persona,
    experiences: input.experiences,
    recentQuests: input.recentQuests,
  });
  const questAvoid = uniqueStrings([...avoid, ...quest.avoidEntities], 12);

  if (last?.next) {
    const official = /公式|ingredient|official/i.test(last.next);
    const rest = /rest|wait|休/i.test(last.next);
    if (rest) {
      return {
        stance: "wait",
        focus: input.state.currentFocus,
        why: last.next,
        terms: [],
        avoid: questAvoid,
      };
    }
    if (official) {
      return {
        stance: "investigate",
        focus: last.seen || quest.goal,
        why: `${last.next} | ${quest.reason}`,
        terms: uniqueStrings([last.seen, "official", ...quest.terms], 5),
        avoid: questAvoid,
      };
    }
    if (/overseas|unknown|新しい海外|未上陸/i.test(last.next)) {
      return {
        stance: "explore",
        focus: `overseas unknown brands / ${quest.city}`,
        why: `${last.next} | ${quest.reason}`,
        terms: uniqueStrings(["overseas", "independent", ...quest.terms], 5),
        avoid: questAvoid,
      };
    }
  }

  if (
    input.persona.activityLevel === "low" &&
    /POST|HUNT/i.test(input.persona.lastAction || "")
  ) {
    return {
      stance: "observe",
      focus: quest.goal,
      why: `low activity already acted; still keep ${quest.city} ${quest.axis} in view`,
      terms: quest.terms,
      avoid: questAvoid,
    };
  }

  return {
    stance: "explore",
    focus: quest.goal,
    why: quest.reason,
    terms: quest.terms,
    avoid: questAvoid,
  };
}

function uniqueStrings(values: string[], max: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = (value || "").trim();
    if (!key) continue;
    const folded = key.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(key);
    if (out.length >= max) break;
  }
  return out;
}

export function freezeCanonicalIdentity(state: SelfState, persona: PersonaLens): SelfState {
  const identity = correspondentIdentityFromLens({
    username: persona.username,
    name: persona.name,
    role: persona.role,
    expertise: persona.expertise,
    interests: persona.interests,
    huntingSpecialty: persona.huntingSpecialty,
    countryCode: persona.countryCode,
    region: persona.region,
    languages: persona.languages,
    goals: persona.goals,
  });
  return {
    ...state,
    identity: persona.name,
    role: persona.role || state.role,
    correspondentTitle: identity.title,
    correspondentCity: identity.city,
    primaryBeat: identity.primaryBeat,
  };
}

export function decideTowardProduct(input: {
  persona: PersonaLens;
  state: SelfState;
  product: ProductView;
  experiences?: Experience[];
}): DecisionRecord {
  const alternatives: ResidentChoice[] = ["IGNORE", "WAIT", "INVESTIGATE_MORE", "SAVE"];
  const key = entityKeyFromProduct(input.product);
  const seen = (input.experiences ?? []).some(
    (item) => item.entityKey === key || item.seen === input.product.productName,
  );
  const haystack = [
    input.product.brand,
    input.product.productName,
    input.product.category,
    input.product.description,
    input.product.url,
  ]
    .filter(Boolean)
    .join(" ");
  const lane = hunterLane(input.persona.username, input.persona.huntingSpecialty);
  const inSpecialty = textFitsHunterSpecialty({
    text: haystack,
    username: input.persona.username,
    huntingSpecialty: input.persona.huntingSpecialty,
  });
  const evidence = input.product.evidenceScore ?? 0;
  const fit = input.product.specialtyFit ?? (inSpecialty ? 70 : 20);
  const role = (input.persona.role || input.state.role || "").toLowerCase();
  const known = [
    inSpecialty ? "specialty match" : "specialty unclear",
    evidence ? `evidence ${evidence}` : "no evidence score",
    seen ? "seen before" : "not in recent memory",
  ].join("; ");
  const unknown = [
    evidence < 55 ? "thin page facts" : "",
    input.product.officialUrl ? "" : "no official url",
  ]
    .filter(Boolean)
    .join("; ") || "none material";

  if (input.state.currentIntent.stance === "wait" || input.state.currentIntent.stance === "rest") {
    return {
      decision: "WAIT",
      reasonSummary: "current intent is to wait rather than act",
      confidence: 80,
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 20,
      known,
      unknown,
    };
  }

  if (input.state.currentIntent.stance === "observe" && role !== "product_hunter") {
    return {
      decision: "OBSERVE",
      reasonSummary: "intent is to observe, not to claim a discovery",
      confidence: 70,
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 30,
      known,
      unknown,
    };
  }

  if (seen) {
    return {
      decision: "WAIT",
      reasonSummary: "already experienced this entity recently",
      confidence: 85,
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 15,
      known,
      unknown,
    };
  }

  if (lane && lane !== "world" && !inSpecialty) {
    return {
      decision: "IGNORE",
      reasonSummary: "outside this resident's specialty",
      confidence: 90,
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 10,
      known,
      unknown,
    };
  }

  if (role === "critic") {
    if (evidence < 70) {
      return {
        decision: "IGNORE",
        reasonSummary: "critic requires stronger evidence than a hunter",
        confidence: 75,
        evidenceIds: input.product.url ? [input.product.url] : [],
        alternativeCount: alternatives.length,
        uncertainty: 25,
        known,
        unknown,
      };
    }
    return {
      decision: "INVESTIGATE_MORE",
      reasonSummary: "critic will inspect before amplifying",
      confidence: 60,
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 40,
      known,
      unknown,
    };
  }

  if (role === "general_user") {
    return {
      decision: "OBSERVE",
      reasonSummary: "general resident does not claim product discoveries",
      confidence: 80,
      evidenceIds: [],
      alternativeCount: 2,
      uncertainty: 20,
      known,
      unknown,
    };
  }

  if (evidence > 0 && evidence < 55) {
    return {
      decision: "INVESTIGATE_MORE",
      reasonSummary: "interesting but evidence is too thin to save as fact",
      confidence: 58,
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 45,
      known,
      unknown,
    };
  }

  if (fit < 50) {
    return {
      decision: "IGNORE",
      reasonSummary: "product quality may be fine, but it is not my beat",
      confidence: 82,
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 18,
      known,
      unknown,
    };
  }

  if (role === "world_scout") {
    return {
      decision: "SAVE",
      reasonSummary: "in-lane candidate with enough evidence to hand off",
      confidence: Math.min(90, Math.max(55, evidence || 65)),
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 25,
      known,
      unknown,
    };
  }

  if (role === "product_hunter" || role === "curator") {
    return {
      decision: evidence >= 70 ? "DISCOVER" : "SAVE",
      reasonSummary: "matches specialty, evidence, and current hunting intent",
      confidence: Math.min(92, Math.max(55, (evidence || 60) - 5 + Math.round(fit / 10))),
      evidenceIds: input.product.url ? [input.product.url] : [],
      alternativeCount: alternatives.length,
      uncertainty: 22,
      known,
      unknown,
    };
  }

  return {
    decision: "OBSERVE",
    reasonSummary: "no strong reason to claim this as my discovery",
    confidence: 60,
    evidenceIds: input.product.url ? [input.product.url] : [],
    alternativeCount: alternatives.length,
    uncertainty: 40,
    known,
    unknown,
  };
}

export function applyExperience(state: SelfState, experience: Experience): SelfState {
  const likes =
    experience.judgment === "SAVE" || experience.judgment === "DISCOVER"
      ? pushUnique(state.likes, experience.seen, MAX_LIKES)
      : state.likes;
  const dislikes =
    experience.judgment === "IGNORE"
      ? pushUnique(state.dislikes, experience.seen, MAX_DISLIKES)
      : state.dislikes;
  let confidence = state.confidence;
  if (experience.judgment === "SAVE" || experience.judgment === "DISCOVER") confidence += 3;
  if (experience.judgment === "IGNORE") confidence -= 1;
  if (/duplicate/i.test(experience.outcome)) confidence -= 2;
  if (experience.judgment === "INVESTIGATE_MORE") confidence -= 1;
  confidence = Math.max(20, Math.min(90, confidence));

  const nextIntent: Intent = experience.next
    ? {
        stance: /公式|ingredient|official/i.test(experience.next)
          ? "investigate"
          : /wait|rest/i.test(experience.next)
            ? "wait"
            : "explore",
        focus: experience.next,
        why: experience.reason,
        terms: experience.next.split(/[\/,]/).map((item) => item.trim()).filter(Boolean).slice(0, 4),
        avoid: experience.judgment === "IGNORE" || experience.judgment === "WAIT"
          ? pushUnique(state.currentIntent.avoid, experience.entityKey || experience.seen, 10)
          : state.currentIntent.avoid,
      }
    : state.currentIntent;

  return {
    ...state,
    role: state.role,
    correspondentTitle: state.correspondentTitle,
    correspondentCity: state.correspondentCity,
    primaryBeat: state.primaryBeat,
    likes,
    dislikes,
    confidence,
    currentIntent: nextIntent,
    currentFocus: nextIntent.focus,
    lastOutcome: experience.outcome,
    nextIntent,
    updatedAt: experience.at,
  };
}

export function reflectWithoutLlm(input: {
  state: SelfState;
  experiences: Experience[];
  lastDecision: DecisionRecord | null;
  outcome: string;
}): { summary: string; beliefs: string[]; next: string } {
  const recent = input.experiences.slice(0, 5);
  const ignored = recent.filter((item) => item.judgment === "IGNORE").length;
  const saved = recent.filter(
    (item) => item.judgment === "SAVE" || item.judgment === "DISCOVER",
  ).length;
  const thin = recent.filter((item) => item.judgment === "INVESTIGATE_MORE").length;
  let next = input.state.currentIntent.focus;
  const beliefs = [...input.state.beliefs];

  if (thin >= 2 && !beliefs.some((item) => item.includes("official"))) {
    beliefs.unshift("prefer official ingredient or spec pages");
    next = "official evidence first";
  }
  if (saved >= 1 && ignored === 0) {
    next = "keep specialty lane, avoid repeating the same brand";
  }
  if (ignored >= 2) {
    next = "leave this lane and explore a neighboring interest";
  }

  const summary = [
    input.lastDecision
      ? `decision=${input.lastDecision.decision} conf=${input.lastDecision.confidence}`
      : "no decision",
    `outcome=${input.outcome}`,
    `saved=${saved} ignored=${ignored} investigate=${thin}`,
    `next=${next}`,
  ].join(" | ");

  return { summary, beliefs: beliefs.slice(0, MAX_BELIEFS), next };
}

export function applyReflection(
  state: SelfState,
  reflection: { summary: string; beliefs: string[]; next: string },
): SelfState {
  return {
    ...state,
    beliefs: reflection.beliefs,
    lastOutcome: reflection.summary,
    currentIntent: {
      ...state.currentIntent,
      focus: reflection.next,
      why: reflection.summary,
    },
    nextIntent: {
      ...state.currentIntent,
      focus: reflection.next,
      why: reflection.summary,
    },
    currentFocus: reflection.next,
    updatedAt: new Date().toISOString(),
  };
}

export function relateFromSocial(input: {
  existing?: RelationshipKind;
  action: string;
  sameInterest: boolean;
}): RelationshipKind {
  if (input.action === "FOLLOW") return "friend";
  if (input.action === "SAVE") return "trusted";
  if (input.action === "COMMENT" && input.sameInterest) return "similar_interest";
  if (input.action === "COMMENT") return "interesting";
  if (input.action === "LIKE" && input.sameInterest) return "similar_interest";
  if (input.action === "IGNORE" && input.existing === "friend") return "friend";
  if (input.action === "IGNORE") return input.existing || "unknown";
  return input.existing || "interesting";
}

export function shouldSearchNow(intent: Intent) {
  return intent.stance === "explore" || intent.stance === "investigate" || intent.stance === "follow_up";
}

export function shouldSaveNow(intent: Intent, decision: ResidentChoice) {
  if (!shouldSearchNow(intent) && intent.stance === "observe") return false;
  return decision === "SAVE" || decision === "DISCOVER";
}

export function serializeSelfState(state: SelfState) {
  return JSON.stringify(state);
}

export function parseSelfState(value: string | null | undefined): SelfState | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as SelfState;
    if (!parsed || typeof parsed.identity !== "string") return null;
    if (!parsed.currentIntent || typeof parsed.currentIntent.stance !== "string") return null;
    return {
      ...parsed,
      correspondentTitle: parsed.correspondentTitle || "",
      correspondentCity: parsed.correspondentCity || "",
      primaryBeat: parsed.primaryBeat || "",
    };
  } catch {
    return null;
  }
}

export function parseExperience(value: string | null | undefined): Experience | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Experience;
    if (!parsed.seen || !parsed.judgment) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function experienceLine(experience: Experience) {
  return `${experience.judgment} ${experience.seen}: ${experience.reason} → ${experience.next}`;
}
