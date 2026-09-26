import { CATALOG_PRODUCTS } from "@/lib/products/catalog";
import { siteUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseStore } from "@/lib/store/supabase";
import { isUsableProductImage } from "@/lib/discovery/media";
import { listDiscoveryProductsFromDb } from "@/lib/discovery/db";
import type { AiPersona } from "@/lib/ai-post-engine";
import type { GoogleTrend } from "@/lib/ai/google-trends";
import type { WorldSearchResult } from "@/lib/ai/world-search";
import {
  decideAIAction,
  decideResidentLifePost,
  type AIAction,
  type ResidentLifeDecision,
} from "@/lib/ai/brain";
import { generateAIText } from "@/lib/ai/groq";
import {
  evaluateCaptionQuality,
  roleCaptionLens,
} from "@/lib/ai/post-quality";
import { reviewDiscoveryForPost } from "@/lib/ai/editorial-board";
import {
  loadResidentHumanSignals,
  signalsToMemoryLine,
} from "@/lib/ai/human-signals";
import { isPostableDiscovery } from "@/lib/ai/discovery-report";
import { getActiveAiPersonas } from "@/lib/ai-post-engine";
import {
  executeAIAction,
  publishAIProductPost,
} from "@/lib/ai/action-executor";
import {
  runResidentProductHunter,
  type ResidentProductHunterResult,
} from "@/lib/ai/resident-product-hunter";
import { runWorldScoutCycle } from "@/lib/ai/world-scout-cycle";
import { listAssignedDiscoveries } from "@/lib/ai/discovery-handoff";
import {
  expireStaleInvestigations,
  loadOpenInvestigations,
  loadVerifiedUnposted,
  markInvestigationPosted,
} from "@/lib/ai/investigations";
import { resolveOnePendingCommentInvestigation } from "@/lib/ai/comment-investigation";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import {
  getRolePlaybook,
  type RolePlaybook,
} from "@/lib/ai/resident-roles";
import {
  shouldAttemptFallbackTweet,
  tweetCategory,
} from "@/lib/posts/text-post";
import {
  applyExperience,
  applyReflection,
  buildSelfState,
  experienceLine,
  formIntent,
  freezeCanonicalIdentity,
  reflectWithoutLlm,
  relateFromSocial,
  type Experience,
  type SelfState,
} from "@/lib/ai/self-model";
import { loadRecentExplorations, loadSelfSnapshot, persistSelfSnapshot } from "@/lib/ai/self-memory";
import {
  commentHasInformationValue,
  isLowValueComment,
  nextExplorationHint,
  planTodayExploration,
  serializeExploration,
  subjectLooksRepeated,
  type ExplorationQuest,
} from "@/lib/ai/today-exploration";
import {
  loadPeerWorldSignals,
  watchWorldForResident,
  type CorrespondentWatchResult,
} from "@/lib/ai/correspondent-watch";
import {
  correspondentIdentityFromLens,
  correspondentIdentityStatement,
} from "@/lib/ai/correspondent-identity";


export type ResidentLifeCycleOptions = {
  dryRun?: boolean;
  runId?: string | null;
};

export type ResidentLifeCycleResult = {
  persona: string;
  profileId: string;
  residentRole: string | null | undefined;
  action: {
    type: "LIFE_CYCLE";
    work: {
      type: "POST" | "SKIP_POST" | "PRODUCT_HUNT" | "WORLD_SCOUT" | "NO_ACTION";
      posted?: boolean;
      skipReason?: string;
      caption?: string;
      subjectCount?: number;
    };
    social: AIAction;
  };
  result: {
    work: unknown;
    social: unknown;
  };
  productHunter: ResidentProductHunterResult | null;
  correspondent?: CorrespondentWatchResult | null;
  worldScout?: import("@/lib/ai/world-scout-cycle").WorldScoutCycleResult | null;
  observation?: {
    sources: string[];
    query: string | null;
    subjectKinds: string[];
    followingCount: number;
    feedCount: number;
    newsCount: number;
    trendCount: number;
    newsHeadlines?: string[];
    trendTitles?: string[];
    feedCaptions?: string[];
    followingNames?: string[];
    subjects?: Array<{ id: string; kind: string; label: string }>;
    hunterOrigins?: string[];
    reason?: string;
  };
    memoryCandidate?: string;
  exploration?: ExplorationQuest | null;
  mind?: {
    intent: string;
    focus: string;
    why: string;
    decision?: string;
    outcome?: string;
    reflection?: string;
    nextIntent?: string;
    confidence?: number;
  };
  social: {
    persona: string;
    profileId: string;
    residentRole: string | null | undefined;
    targetPostId: string | null;
    action: AIAction;
    result: unknown;
  };
};

type PostSubject = {
  id: string;
  kind: "hunter" | "catalog" | "discovery" | "world" | "feed" | "news";
  label: string;
  productName?: string;
  brand?: string;
  productUrl?: string | null;
  mediaUrl?: string | null;
  category?: string;
  sourceUrl?: string | null;
  sourceRef?: string | null;
  discoveryProductId?: string | null;
  hunterIndex?: number;
  /** World Scout → specialist handoff (listAssignedDiscoveries). */
  followUp?: boolean;
  assigned?: boolean;
};

type FeedCandidate = {
  id: string;
  authorId: string;
  authorName: string;
  category: string;
  caption: string;
  productUrl: string | null;
  comments: Array<{
    id: string;
    author: string;
    authorId?: string;
    body: string;
    parentCommentId: string | null;
  }>;
};

type RelationshipContext = {
  following: Array<{ id: string; name: string }>;
  recentMemories: string[];
};

function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function absoluteMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isHttpUrl(value)) return value;
  if (value.startsWith("/")) {
    return `${siteUrl()}${value}`;
  }
  return null;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  let state = hashSeed(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    const j = Math.abs(state) % (i + 1);
    const current = copy[i];
    const swap = copy[j];
    if (current === undefined || swap === undefined) continue;
    copy[i] = swap;
    copy[j] = current;
  }
  return copy;
}

function hoursSince(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / 36e5;
}

function usesJapanese(persona: AiPersona): boolean {
  return (persona.languages ?? []).some((lang) => /ja|japanese/i.test(lang));
}

function fallbackLifePost(
  persona: AiPersona,
  subjects: PostSubject[],
  encourage: boolean,
): ResidentLifeDecision {
  if (!subjects.length || !encourage) {
    return { type: "SKIP_POST", reason: "no live subject" };
  }
  return { type: "SKIP_POST", reason: "quality-first skip instead of template post" };
}

function fallbackLifeTweet(_persona: AiPersona): ResidentLifeDecision {
  return { type: "SKIP_POST", reason: "no template tweet on API fallback" };
}

function resolvePostSubject(
  subjects: PostSubject[],
  subjectId: string,
): PostSubject | undefined {
  const trimmed = subjectId.trim();
  const exact = subjects.find((item) => item.id === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  return subjects.find(
    (item) =>
      item.label.toLowerCase().includes(lower) ||
      (item.productName || "").toLowerCase().includes(lower) ||
      (item.brand || "").toLowerCase().includes(lower),
  );
}

function normalizeSpeech(value: string): string {
  return value
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/[、。,.!！?？「」『』"'“”]/g, "");
}

function captionLooksCopied(caption: string, sources: string[]): boolean {
  const a = normalizeSpeech(caption);
  if (a.length < 18) return false;
  for (const source of sources) {
    const b = normalizeSpeech(source);
    if (b.length < 18) continue;
    if (a === b) return true;
    if (a.startsWith(b) || b.startsWith(a)) return true;
    if (a.includes(b) && b.length / a.length >= 0.55) return true;
    if (b.includes(a) && a.length / b.length >= 0.55) return true;
    const n = Math.min(a.length, b.length, 48);
    if (n >= 24 && a.slice(0, n) === b.slice(0, n)) return true;
  }
  return false;
}

async function polishCaption(input: {
  persona: AiPersona;
  caption: string;
  subject?: PostSubject;
  recentCaptions: string[];
}): Promise<string | null> {
  let caption = input.caption.trim();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const quality = evaluateCaptionQuality({
      caption,
      role: input.persona.resident_role,
      recentCaptions: input.recentCaptions,
      subjectLabel: input.subject?.label ?? null,
    });
    if (quality.ok) return caption;
    try {
      caption = (
        await generateAIText(
          [
            `Rewrite this NEWFIND resident caption. Keep 1-3 sentences.`,
            roleCaptionLens(input.persona.resident_role),
            `Resident: ${input.persona.persona_name}`,
            `Personality: ${input.persona.personality}`,
            `Posting style: ${input.persona.posting_style}`,
            input.subject
              ? `Subject: ${input.subject.brand ?? ""} ${input.subject.productName ?? input.subject.label}`
              : "No product subject.",
            "Do not copy recent captions.",
            `Recent: ${input.recentCaptions.slice(0, 5).join(" | ") || "none"}`,
            `Original: ${caption}`,
            "Return the rewritten caption only.",
          ].join("\n"),
          { temperature: 0.9, maxTokens: 220 },
        )
      )
        .trim()
        .replace(/^["']|["']$/g, "");
    } catch (error) {
      console.error("caption rewrite failed", error);
      return null;
    }
  }
  const finalQuality = evaluateCaptionQuality({
    caption,
    role: input.persona.resident_role,
    recentCaptions: input.recentCaptions,
    subjectLabel: input.subject?.label ?? null,
  });
  return finalQuality.ok ? caption : null;
}

function captionCopiesSubject(
  caption: string,
  subject: PostSubject | undefined,
  extraSources: string[] = [],
): boolean {
  const sources = [
    subject?.label,
    subject?.productName,
    ...extraSources,
  ].filter((item): item is string => Boolean(item));
  return captionLooksCopied(caption, sources);
}

function isAssignedDiscoverySubject(subject: PostSubject): boolean {
  return (
    subject.kind === "discovery" &&
    Boolean(subject.discoveryProductId) &&
    subject.assigned === true
  );
}

function isPostableAssignedDiscovery(subject: PostSubject): boolean {
  return (
    isAssignedDiscoverySubject(subject) &&
    isHttpUrl(subject.productUrl) &&
    isUsableProductImage(subject.mediaUrl ?? null)
  );
}

async function rewriteSubjectCaption(input: {
  persona: AiPersona;
  playbook: RolePlaybook;
  subject: PostSubject;
}): Promise<ResidentLifeDecision> {
  const { persona, playbook, subject } = input;
  const rewriteContext = `
${personaVoiceBlock(persona, playbook)}

この投稿文は題材の本文をコピーしているため使用できません。
以下の商品について、自分自身の視点で短い投稿文を1つ書いてください。
商品: ${subject.productName || subject.label}
ブランド: ${subject.brand || "不明"}
カテゴリ: ${subject.category || "other"}
商品URL: ${subject.productUrl || "なし"}
元の文章を言い換えるだけではなく、自分の視点を加えてください。
商品名・ブランド・URLは捏造しないでください。

ルール:
- 必ず subjectId "${subject.id}" を使って POST してください。
- captionは1〜3文。その住民がスマホで書く口調。
- 題材の本文のコピー・ほぼ同じ言い換えは禁止。
- 有効な投稿文が書けない場合のみ SKIP_POST。
`;
  try {
    const decision = await decideResidentLifePost(rewriteContext);
    if (decision.type !== "POST") {
      return {
        type: "SKIP_POST",
        reason: decision.reason || "rewrite skipped",
      };
    }
    const caption = decision.caption.trim();
    if (!caption) {
      return { type: "SKIP_POST", reason: "rewrite missing caption" };
    }
    if (captionCopiesSubject(caption, subject)) {
      return { type: "SKIP_POST", reason: "rewrite still copies subject" };
    }
    return { type: "POST", caption, subjectId: subject.id };
  } catch (error) {
    console.error("subject caption rewrite failed", persona.persona_name, error);
    return { type: "SKIP_POST", reason: "rewrite failed" };
  }
}

function isProductLikeSubject(subject: PostSubject | undefined): boolean {
  if (!subject) return false;
  if (subject.kind === "world" || subject.kind === "news") return false;
  return (
    subject.kind === "hunter" ||
    subject.kind === "catalog" ||
    subject.kind === "discovery" ||
    Boolean(subject.productUrl)
  );
}

function shouldEncouragePost(persona: AiPersona): boolean {
  const last = (persona.last_action || "").toUpperCase();
  const hours = hoursSince(persona.last_observed_at);
  const postedRecently =
    last.includes("WORK:POST") || /(^|\+)POST(\+|$)/.test(last);

  if (!postedRecently) return true;
  if (persona.activity_level === "high") return hours >= 4;
  if (persona.activity_level === "low") return hours >= 16;
  return hours >= 8;
}

function nextActionAt(persona: AiPersona): string {
  const hours =
    persona.activity_level === "high"
      ? 4
      : persona.activity_level === "low"
        ? 16
        : 8;
  return new Date(Date.now() + hours * 36e5).toISOString();
}

function isUuid(value: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || "",
  );
}

function matchesPersona(persona: AiPersona, text: string): boolean {
  const haystack = text.toLowerCase();
  const needles = [
    ...(persona.interests ?? []),
    ...(persona.preferred_categories ?? []),
    ...(persona.expertise ?? []),
    ...(persona.favorite_brands ?? []),
  ]
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (needles.length === 0) return true;
  return needles.some((needle) => haystack.includes(needle));
}

function roleWorkMemory(
  playbook: RolePlaybook,
  subject: PostSubject | null,
  caption: string,
): { memoryType: string; content: string } {
  if (!subject) {
    return {
      memoryType: playbook.role === "media" || playbook.role === "trend_hunter"
        ? "observation"
        : "post",
      content: `Tweeted as ${playbook.role}: ${caption.slice(0, 80)}`,
    };
  }

  const label = subject.label;
  switch (playbook.role) {
    case "product_hunter":
      return {
        memoryType: "discovery",
        content: `Brought home ${label}`,
      };
    case "fan":
      return {
        memoryType: "affection",
        content: `Stayed with ${label}`,
      };
    case "critic":
      return {
        memoryType: "critique",
        content: `Judged ${label}: ${caption.slice(0, 80)}`,
      };
    case "reviewer":
      return {
        memoryType: "review",
        content: `Reviewed ${label}: ${caption.slice(0, 80)}`,
      };
    case "influencer":
      return {
        memoryType: "spotlight",
        content: `Introduced ${label}`,
      };
    case "media":
      return {
        memoryType: "observation",
        content: `Noted ${label} in the current weather`,
      };
    case "trend_hunter":
      return {
        memoryType: "trend",
        content: `Caught a signal around ${label}`,
      };
    case "curator":
      return {
        memoryType: "keep",
        content: `Kept ${label}`,
      };
    default:
      return {
        memoryType: "post",
        content: `Posted about ${label}`,
      };
  }
}

function roleSocialMemory(
  playbook: RolePlaybook,
  action: AIAction,
): { memoryType: string; content: string } {
  const verb = action.type;
  switch (playbook.role) {
    case "fan":
      return { memoryType: "affection", content: `${verb} someone/something I follow` };
    case "critic":
      return { memoryType: "critique", content: `${verb} after judging a post` };
    case "reviewer":
      return { memoryType: "review", content: `${verb} with a use-lens` };
    case "influencer":
      return { memoryType: "spotlight", content: `${verb} in a social circle` };
    case "media":
      return { memoryType: "observation", content: `${verb} a circulating post` };
    case "trend_hunter":
      return { memoryType: "trend", content: `${verb} a moving signal` };
    case "curator":
      return { memoryType: "keep", content: `${verb} while selecting` };
    case "product_hunter":
      return { memoryType: "discovery", content: `${verb} around a found object` };
    default:
      return { memoryType: "social", content: `${verb} in NEWFIND` };
  }
}

function personaVoiceBlock(persona: AiPersona, playbook: RolePlaybook): string {
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
  return [
    `名前: ${persona.persona_name}`,
    `特派員: ${identity.title} / ${identity.titleJa}`,
    `担当: ${identity.flag} ${identity.city} / ${identity.territories.join(" / ")}`,
    `専門: ${identity.specialties.join(" / ")}`,
    `Mission: ${identity.mission}`,
    `自己認識: ${correspondentIdentityStatement(identity)}`,
    `仕事: ${playbook.role} / ${playbook.label}`,
    `この住民の仕事: ${playbook.work}`,
    `目標: ${(persona.goals ?? []).join(", ") || "特になし"}`,
    `人格: ${persona.personality}`,
    `興味: ${(persona.interests ?? []).join(", ") || "特になし"}`,
    `好きなブランド: ${(persona.favorite_brands ?? []).join(", ") || "特になし"}`,
    `投稿スタイル: ${persona.posting_style}`,
    `コメントスタイル: ${persona.comment_style}`,
    `地域: ${persona.region || persona.country_code || "不明"}`,
    `言語: ${(persona.languages ?? []).join(", ") || "日本語"}`,
    `専門分野: ${(persona.expertise ?? []).join(", ") || "特になし"}`,
    `価値観: ${(persona.values ?? []).join(", ") || "特になし"}`,
    `文化: ${persona.culture || "特になし"}`,
    `前回の行動: ${persona.last_action || "なし"}`,
    `記憶: ${persona.memory_summary || "まだ少ない"}`,
  ].join("\n");
}

async function loadPostComments(postId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("comments")
    .select("id, user_id, body, parent_comment_id, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(8);

  if (error || !data?.length) return [];

  const userIds = [...new Set(data.map((row) => row.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, username")
    .in("id", userIds);

  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.display_name || profile.username || "resident",
    ]),
  );

  return data.map((row) => ({
    id: row.id,
    author: names.get(row.user_id) || "resident",
    authorId: String(row.user_id),
    body: String(row.body ?? "").trim(),
    parentCommentId: row.parent_comment_id ?? null,
  }));
}

async function loadRelationships(
  persona: AiPersona,
): Promise<RelationshipContext> {
  const admin = createAdminClient();
  const following: Array<{ id: string; name: string }> = [];

  try {
    if (isUuid(persona.profile_id)) {
      const { data: followRows } = await admin
        .from("follows")
        .select("followee_id")
        .eq("follower_id", persona.profile_id)
        .limit(24);

      const ids = (followRows ?? []).map((row) => row.followee_id as string);
      if (ids.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, display_name, username")
          .in("id", ids);
        for (const profile of profiles ?? []) {
          following.push({
            id: profile.id,
            name: profile.display_name || profile.username || "resident",
          });
        }
      }
    }
  } catch (error) {
    console.error("loadRelationships follows failed", error);
  }

  let recentMemories: string[] = [];
  try {
    if (!isUuid(persona.id)) {
      return { following, recentMemories };
    }
    const { data: memories } = await admin
      .from("ai_resident_memories")
      .select("content, created_at")
      .eq("persona_id", persona.id)
      .order("created_at", { ascending: false })
      .limit(6);
    recentMemories = (memories ?? [])
      .map((row) => String(row.content ?? "").trim())
      .filter(Boolean);
  } catch {
    recentMemories = [];
  }

  return { following, recentMemories };
}

async function remember(
  personaId: string,
  memoryType: string,
  subjectType: string | null,
  subjectId: string | null,
  content: string,
) {
  try {
    const admin = createAdminClient();
    await admin.from("ai_resident_memories").insert({
      persona_id: personaId,
      memory_type: memoryType,
      subject_type: subjectType,
      subject_id: subjectId,
      content,
      importance: 1,
    });
  } catch (error) {
    console.error("ai_resident_memories insert failed", error);
  }
}

async function persistPersonaState(
  persona: AiPersona,
  lastAction: string,
  lastThought: string,
  extras?: {
    discoveryDelta?: number;
    interactionDelta?: number;
    humanLine?: string;
    selfState?: SelfState | null;
    experience?: Experience | null;
    reflection?: string | null;
    decision?: string | null;
  },
) {
  const admin = createAdminClient();
  const identity = correspondentIdentityFromLens({
    username: persona.username,
    name: persona.persona_name,
    displayName: persona.display_name,
    role: persona.resident_role,
    expertise: persona.expertise,
    interests: persona.interests,
    countryCode: persona.country_code,
    region: persona.region,
    languages: persona.languages,
    goals: persona.goals,
  });
  const memoryBits = [
    `${identity.title} · ${identity.flag} ${identity.city} · ${identity.primaryBeat}`,
    persona.memory_summary,
    extras?.humanLine,
    lastThought,
  ]
    .filter(Boolean)
    .join(" / ")
    .slice(-480);

  const { error: stateError } = await admin
    .from("ai_personas")
    .update({
      last_action: lastAction,
      last_thought: lastThought.slice(0, 500),
      last_observed_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      next_action_at: nextActionAt(persona),
      memory_summary: memoryBits,
      discovery_count:
        (persona.discovery_count ?? 0) + (extras?.discoveryDelta ?? 0),
      interaction_count:
        (persona.interaction_count ?? 0) + (extras?.interactionDelta ?? 0),
    })
    .eq("id", persona.id);

  if (stateError) {
    throw new Error(`AI resident state update failed: ${stateError.message}`);
  }

  if (extras?.selfState) {
    await persistSelfSnapshot({
      personaId: persona.id,
      state: extras.selfState,
      experience: extras.experience,
      reflection: extras.reflection,
      decision: extras.decision,
    });
  }

  await remember(
    persona.id,
    "identity",
    "self",
    persona.id,
    correspondentIdentityStatement(identity),
  );
}

async function gatherPostSubjects(
  persona: AiPersona,
  hunter: ResidentProductHunterResult | null,
  feed: FeedCandidate[],
  playbook: RolePlaybook,
  correspondent?: CorrespondentWatchResult | null,
  verifiedLeads?: Array<{
    title: string;
    sourceUrl: string | null;
    sourceKind: string | null;
    provenance?: string | null;
  }>,
): Promise<PostSubject[]> {
  const subjects: PostSubject[] = [];
  let n = 1;
  const allow = new Set(playbook.subjectKinds);

  if (playbook.role !== "world_scout") {
    try {
      const assigned = await listAssignedDiscoveries(persona.id);
      for (const product of assigned) {
        const productUrl = String(product.product_url ?? "");
        if (!isHttpUrl(productUrl)) continue;
        subjects.push({
          id: String(n++),
          kind: "discovery",
          label: `${product.brand} ${product.product_name}`.trim(),
          productName: String(product.product_name ?? ""),
          brand: String(product.brand ?? ""),
          productUrl,
          mediaUrl: isUsableProductImage(
            (product.product_image_url as string | null) ?? null,
          )
            ? (product.product_image_url as string)
            : null,
          category: String(product.category ?? "other"),
          sourceUrl: String(product.official_url || product.product_url || ""),
          discoveryProductId: String(product.id),
          sourceRef: String(product.id),
          assigned: true,
        });
      }
    } catch (error) {
      console.warn("assigned discoveries unavailable", error);
    }
  }

  if (allow.has("hunter") && hunter) {
    hunter.discoveries.forEach((discovery) => {
      const candidate = hunter.candidates[discovery.candidateIndex];
      if (!candidate || !isHttpUrl(candidate.productUrl)) return;
      if (candidate.origin === "catalog") return;
      subjects.push({
        id: String(n++),
        kind: "hunter",
        label: `${candidate.brand} ${candidate.productName}`.trim(),
        productName: candidate.productName,
        brand: candidate.brand,
        productUrl: candidate.productUrl,
        mediaUrl: isUsableProductImage(candidate.productImageUrl)
          ? candidate.productImageUrl
          : null,
        category: candidate.category,
        sourceUrl: candidate.officialUrl || candidate.productUrl,
        discoveryProductId: discovery.discoveryProductId,
        hunterIndex: discovery.candidateIndex,
      });
    });
  }

  if (allow.has("feed")) {
    for (const post of feed) {
      if (!isHttpUrl(post.productUrl)) continue;
      if (
        !matchesPersona(
          persona,
          `${post.caption} ${post.category} ${post.authorName}`,
        ) &&
        playbook.role !== "critic" &&
        playbook.role !== "media" &&
        playbook.role !== "trend_hunter"
      ) {
        continue;
      }
      subjects.push({
        id: String(n++),
        kind: "feed",
        label: `${post.authorName} / ${post.category || "find"}`.slice(0, 60),
        productName: post.caption.slice(0, 42),
        productUrl: post.productUrl,
        category: post.category,
        sourceUrl: post.productUrl,
        sourceRef: post.id,
      });
    }
  }

  if (allow.has("catalog")) {
    let catalogMatches = seededShuffle(
      CATALOG_PRODUCTS.filter((product) =>
        matchesPersona(
          persona,
          [
            product.name,
            product.brand,
            product.description,
            ...(product.collections ?? []),
            ...(product.tags ?? []),
          ].join(" "),
        ),
      ),
      `${persona.id}:catalog:${new Date().toISOString().slice(0, 13)}`,
    ).slice(0, playbook.role === "curator" ? 2 : 4);

    if (catalogMatches.length === 0 && playbook.role === "general_user") {
      catalogMatches = seededShuffle(
        CATALOG_PRODUCTS,
        `${persona.id}:catalog-fallback`,
      ).slice(0, 2);
    }

    for (const product of catalogMatches) {
      const productUrl = product.purchaseUrl || product.sourceUrl;
      if (!isHttpUrl(productUrl)) continue;
      subjects.push({
        id: String(n++),
        kind: "catalog",
        label: `${product.brand} ${product.name}`.trim(),
        productName: product.name,
        brand: product.brand,
        productUrl,
        mediaUrl: absoluteMediaUrl(product.imageUrl),
        category: product.collections[0] || "other",
        sourceUrl: product.sourceUrl,
        sourceRef: product.id,
      });
    }
  }

  if (allow.has("discovery")) {
    try {
      const discovered = await listDiscoveryProductsFromDb({
        admin: true,
        status: "all",
      });
      const picked = seededShuffle(
        discovered.filter((product) => {
          if (!isHttpUrl(product.productUrl)) return false;
          return matchesPersona(
            persona,
            `${product.brand} ${product.productName} ${product.description} ${product.category}`,
          );
        }),
        `${persona.id}:discovery`,
      ).slice(0, playbook.role === "curator" ? 2 : 3);

      for (const product of picked) {
        subjects.push({
          id: String(n++),
          kind: "discovery",
          label: `${product.brand} ${product.productName}`.trim(),
          productName: product.productName,
          brand: product.brand,
          productUrl: product.productUrl,
          mediaUrl: isUsableProductImage(product.productImageUrl)
            ? product.productImageUrl
            : null,
          category: product.category,
          sourceUrl: product.officialUrl || product.productUrl,
          discoveryProductId: product.id,
          sourceRef: product.id,
        });
      }
    } catch (error) {
      console.error("gather discovery products failed", error);
    }
  }

  if (allow.has("world") && correspondent) {
    for (const dispatch of correspondent.accepted) {
      if (dispatch.decision !== "POST") continue;
      if (dispatch.infoKind === "PRODUCT") continue;
      if (!isHttpUrl(dispatch.url)) continue;
      if (!isUsableProductImage(dispatch.imageUrl ?? null)) continue;
      subjects.push({
        id: String(n++),
        kind: "world",
        label: `${dispatch.dispatchKind} ${dispatch.title}`.slice(0, 80),
        category: dispatch.infoKind.toLowerCase(),
        mediaUrl: dispatch.imageUrl ?? null,
        sourceUrl: dispatch.url,
        sourceRef: dispatch.provenance,
      });
    }
  }

  for (const lead of verifiedLeads ?? []) {
    if (!isHttpUrl(lead.sourceUrl)) continue;
    subjects.push({
      id: String(n++),
      kind: "world",
      label: `VERIFIED ${lead.title}`.slice(0, 80),
      category: (lead.sourceKind || "news").toLowerCase(),
      sourceUrl: lead.sourceUrl,
      sourceRef: lead.provenance || lead.sourceUrl,
      followUp: true,
    });
  }

  const unique: PostSubject[] = [];
  const seen = new Set<string>();
  for (const subject of subjects) {
    const key = `${subject.kind}:${subject.productUrl || subject.sourceUrl || subject.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(subject);
  }

  return unique.slice(0, 8);
}

function dropRepeatedSubjects(
  subjects: PostSubject[],
  avoidEntities: string[],
  recentOwnPostKeys: Set<string> = new Set(),
) {
  return subjects.filter((subject) => {
    if (subjectLooksRepeated(subject, avoidEntities)) return false;
    const urlKey = (subject.productUrl || subject.sourceUrl || "").trim().replace(/\/$/, "").toLowerCase();
    if (urlKey && recentOwnPostKeys.has(`url:${urlKey}`)) return false;
    if (subject.discoveryProductId && recentOwnPostKeys.has(`discovery:${subject.discoveryProductId}`)) return false;
    return true;
  });
}

async function loadRecentOwnPostKeys(profileId: string, hours = 48) {
  if (!isUuid(profileId)) return new Set<string>();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("posts")
      .select("product_url, discovery_product_id")
      .eq("author_id", profileId)
      .gte("created_at", new Date(Date.now() - hours * 36e5).toISOString())
      .limit(100);

    if (error) {
      if (/discovery_product_id|schema cache|42703/i.test(error.message)) {
        const fallback = await admin
          .from("posts")
          .select("product_url")
          .eq("author_id", profileId)
          .gte("created_at", new Date(Date.now() - hours * 36e5).toISOString())
          .limit(100);
        if (fallback.error) throw new Error(fallback.error.message);
        return new Set(
          (fallback.data ?? [])
            .map((row) => String(row.product_url ?? "").trim().replace(/\/$/, "").toLowerCase())
            .filter(Boolean)
            .map((url) => `url:${url}`),
        );
      }
      throw new Error(error.message);
    }

    const keys = new Set<string>();
    for (const row of data ?? []) {
      const url = String(row.product_url ?? "").trim().replace(/\/$/, "").toLowerCase();
      if (url) keys.add(`url:${url}`);
      const discoveryId = String(row.discovery_product_id ?? "").trim();
      if (discoveryId) keys.add(`discovery:${discoveryId}`);
    }
    return keys;
  } catch (error) {
    console.error("loadRecentOwnPostKeys failed", personaSafeName(profileId), error);
    return new Set<string>();
  }
}

function personaSafeName(_profileId: string) {
  return "AI resident";
}

async function loadFeedCandidates(
  persona: AiPersona,
  followingIds: Set<string>,
  playbook: RolePlaybook,
): Promise<FeedCandidate[]> {
  if (!isUuid(persona.profile_id)) return [];
  let feedResult: Awaited<ReturnType<typeof supabaseStore.getFeed>>;
  try {
    feedResult = await supabaseStore.getFeed(
      "foryou",
      persona.profile_id,
      0,
      24,
    );
  } catch (error) {
    console.error("loadFeedCandidates failed", persona.persona_name, error);
    return [];
  }

  const others = feedResult.posts.filter(
    (post) => post.author.id !== persona.profile_id,
  );
  const followed = others.filter((post) => followingIds.has(post.author.id));
  const matching = others.filter((post) =>
    matchesPersona(persona, `${post.caption} ${post.category}`),
  );
  const rest = seededShuffle(
    others.filter((post) => !followingIds.has(post.author.id)),
    `${persona.id}:feed:${new Date().toISOString().slice(0, 10)}`,
  );

  let ranked: typeof others = [];
  if (playbook.role === "fan") {
    ranked = [...followed, ...matching, ...rest];
  } else if (playbook.role === "critic") {
    ranked = [...matching, ...rest, ...followed];
  } else if (playbook.role === "trend_hunter" || playbook.role === "media") {
    ranked = [...others];
  } else if (playbook.role === "influencer") {
    ranked = [...followed, ...rest];
  } else {
    ranked = [...followed, ...rest];
  }

  const unique: typeof others = [];
  const seen = new Set<string>();
  for (const post of ranked) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    unique.push(post);
  }

  return Promise.all(
    unique.slice(0, 6).map(async (post) => ({
      id: post.id,
      authorId: post.author.id,
      authorName: post.author.displayName,
      category: post.category,
      caption: post.caption,
      productUrl: post.productUrl ?? null,
      comments: await loadPostComments(post.id),
    })),
  );
}

function fallbackSocialAction(
  persona: AiPersona,
  candidates: FeedCandidate[],
  followingIds: Set<string>,
  playbook: RolePlaybook,
  city = "",
  preferConversation = false,
): AIAction {
  if (candidates.length === 0) return { type: "IGNORE" };

  const followedPost = candidates.find((post) => followingIds.has(post.authorId));
  const interestPost = candidates.find((post) =>
    matchesPersona(persona, `${post.caption} ${post.category}`),
  );
  const unmatched = candidates.find(
    (post) => !matchesPersona(persona, `${post.caption} ${post.category}`),
  );
  const target =
    playbook.role === "critic"
      ? unmatched || interestPost || followedPost || candidates[0]
      : followedPost || interestPost || candidates[0];
  if (!target) return { type: "IGNORE" };

  const reply = target.comments[0];
  const roll = hashSeed(`${persona.id}:${target.id}:${persona.last_action || ""}`) % 10;
  const ja = usesJapanese(persona);

  // Living timeline: when the resident is investigating / following up / interacting,
  // prefer meaningful COMMENT / REPLY over silent likes.
  if (preferConversation || playbook.preferredSocial.includes("COMMENT")) {
    if (reply && (preferConversation || roll < 4)) {
      return {
        type: "REPLY",
        postId: target.id,
        parentCommentId: reply.id,
        text: ja
          ? `${city || "現地"}では別の読み方もある。続報はまだ出ているか。`
          : `From ${city || "here"} there's another reading. Any follow-up yet?`,
      };
    }
    if (preferConversation || roll < 7) {
      return {
        type: "COMMENT",
        postId: target.id,
        text: ja
          ? `${city || "現地"}で見ると、まだ公式確認前の話に聞こえる。価格と発売地域を知りたい。`
          : `From ${city || "here"} this still sounds pre-confirmation. Price and launch region?`,
      };
    }
  }

  if (playbook.role === "critic") {
    if (roll < 4) return { type: "IGNORE" };
    return {
      type: "COMMENT",
      postId: target.id,
      text: ja
        ? `${city || "現地"}で見ると、流行りだけで判断するのは早い。作りと値段はまだ見たい。`
        : `From ${city || "here"}, the noise is ahead of the cut and price. Not convinced yet.`,
    };
  }

  if (playbook.role === "fan") {
    if (followedPost || interestPost) {
      if (roll < 5) return { type: "LIKE", postId: target.id };
      if (roll < 7) return { type: "SAVE", postId: target.id };
    }
  }

  if (playbook.role === "curator" && roll < 4) {
    return { type: "SAVE", postId: target.id };
  }

  if (playbook.role === "reviewer") {
    return {
      type: "COMMENT",
      postId: target.id,
      text: ja
        ? "使う前から素材と持ちが気になる。実際の耐久を見てから判断したい。"
        : "I'd test the material and durability before the praise.",
    };
  }

  if (playbook.role === "media") {
    if (reply && roll < 5) {
      return {
        type: "REPLY",
        postId: target.id,
        parentCommentId: reply.id,
        text: ja
          ? `${city || "現地"}では今この話が先に出ている。他地域と比べたい。`
          : `In ${city || "this city"} this story is already circulating. How does it compare elsewhere?`,
      };
    }
    return {
      type: "COMMENT",
      postId: target.id,
      text: ja
        ? `${city || "現地"}の流れだと、これが先に話題になっている。`
        : `In ${city || "this city"} this is already the story in the air.`,
    };
  }

  if (playbook.role === "trend_hunter" && roll < 5) {
    return { type: "SAVE", postId: target.id };
  }

  if (reply && roll < 2) {
    return {
      type: "REPLY",
      postId: target.id,
      parentCommentId: reply.id,
      text: ja
        ? "その視点は現地と違う。発売地域はまだ限定的ではないか。"
        : "That reading differs from the local one. Is availability still limited?",
    };
  }

  if (roll < 6) {
    return { type: "LIKE", postId: target.id };
  }

  if (roll < 8 && target.authorId !== persona.profile_id) {
    return { type: "FOLLOW", profileId: target.authorId };
  }

  return { type: "SAVE", postId: target.id };
}

async function executeWorkPost(
  persona: AiPersona,
  subject: PostSubject,
  caption: string,
  hunter: ResidentProductHunterResult | null,
) {
  if (subject.kind === "hunter" && hunter && subject.hunterIndex != null) {
    const candidate = hunter.candidates[subject.hunterIndex];
    const discoveryProductId = subject.discoveryProductId;
    if (candidate && discoveryProductId) {
      if (!isUsableProductImage(candidate.productImageUrl)) {
        return {
          executed: false,
          skipped: true,
          reason: "PRODUCT_IMAGE_REQUIRED",
          discoveryProductId,
        };
      }
      if (!isPostableDiscovery(candidate.report)) {
        return {
          executed: false,
          skipped: true,
          reason: "DISCOVERY_NOT_POSTABLE",
          discoveryProductId,
        };
      }
      const board = await getActiveAiPersonas().catch(() => []);
      const verdict = await reviewDiscoveryForPost({
        report: candidate.report,
        hunter: persona,
        critic: board.find((item) => item.resident_role === "critic") ?? null,
        curator: board.find((item) => item.resident_role === "curator") ?? null,
      });
      if (!verdict.post) {
        return {
          executed: false,
          skipped: true,
          reason: `EDITORIAL_NO_POST:${verdict.reasons.join(",") || "rejected"}`,
          discoveryProductId,
        };
      }

      return publishAIProductPost(persona.profile_id, {
        discoveryProductId,
        brand: candidate.brand,
        productName: candidate.productName,
        category: candidate.category,
        productUrl: candidate.productUrl,
        productImageUrl: candidate.productImageUrl ?? null,
        description: candidate.description,
        residentName: persona.persona_name,
        attentionReason: candidate.attentionReason,
        caption,
      });
    }
  }

  return executeAIAction(
    {
      type: "POST",
      caption,
      subjectId: subject.id,
      productUrl: subject.productUrl ?? null,
      productLabel: subject.productName ?? subject.label,
      mediaUrl: subject.mediaUrl ?? null,
      category: subject.category || "other",
      discoveryProductId: subject.discoveryProductId ?? null,
      sourceUrl: subject.sourceUrl ?? subject.productUrl ?? null,
      sourceRef: subject.sourceRef ?? subject.discoveryProductId ?? null,
    },
    persona.profile_id,
  );
}

export async function runResidentLifeCycle(
  persona: AiPersona,
  worldNews: WorldSearchResult[],
  googleTrends: GoogleTrend[],
  options?: ResidentLifeCycleOptions,
): Promise<ResidentLifeCycleResult> {
  const dryRun = Boolean(options?.dryRun);
  const playbook = getRolePlaybook(persona.resident_role);
  const snapshot = await loadSelfSnapshot(persona.id);
  const recentQuests = await loadRecentExplorations(persona.id).catch(() => []);
  const peerSignals = await loadPeerWorldSignals(persona.id).catch(() => []);
  const openInvestigations = await loadOpenInvestigations(persona.id).catch(() => []);
  await expireStaleInvestigations(persona.id).catch(() => undefined);
  const verifiedLeads = await loadVerifiedUnposted(persona.id).catch(() => []);
  const personaLens = {
    id: persona.id,
    name: persona.persona_name,
    username: persona.username,
    role: persona.resident_role,
    personality: persona.personality,
    values: persona.values,
    interests: persona.interests,
    expertise: persona.expertise,
    goals: persona.goals,
    activityLevel: persona.activity_level,
    lastAction: persona.last_action,
    huntingSpecialty: (persona.expertise ?? []).slice(0, 3).join(" / "),
    countryCode: persona.country_code,
    region: persona.region,
    languages: persona.languages,
  };
  const baseState = buildSelfState(personaLens, snapshot.state);
  const exploration = planTodayExploration({
    persona: personaLens,
    experiences: snapshot.experiences,
    recentQuests,
  });
  const intent = formIntent({
    persona: personaLens,
    state: baseState,
    experiences: snapshot.experiences,
    recentQuests,
    peerSignals: peerSignals.map((item) => ({
      title: item.title,
      beat: item.beat,
      fromName: item.fromName,
    })),
    openInvestigations: openInvestigations.map((item) => ({
      title: item.title,
      status: item.status,
    })),
  });
  let selfState: SelfState = {
    ...baseState,
    currentIntent: intent,
    currentFocus: intent.focus,
  };

  if (playbook.role === "world_scout") {
    const scout = await runWorldScoutCycle(persona, worldNews, {
      runId: options?.runId,
      dryRun,
    });
    const scoutExperience: Experience = {
      seen: scout.queries[0] || scout.beatKey,
      judgment: scout.savedCount > 0 ? "SAVE" : "WAIT",
      reason: scout.funnelSummary || `saved=${scout.savedCount}`,
      outcome: scout.noAction ? "no durable candidate" : `saved ${scout.savedCount}`,
      next: scout.noAction
        ? "explore a neighboring beat"
        : "avoid repeating handed-off products",
      at: new Date().toISOString(),
    };
    const reflected = reflectWithoutLlm({
      state: selfState,
      experiences: [scoutExperience, ...snapshot.experiences],
      lastDecision: selfState.lastDecision,
      outcome: scoutExperience.outcome,
    });
    selfState = freezeCanonicalIdentity(
      applyReflection(applyExperience(selfState, scoutExperience), reflected),
      personaLens,
    );
    if (!dryRun) {
      await persistPersonaState(
        persona,
        scout.noAction ? "NO_ACTION" : "WORLD_SCOUT",
        scout.noAction
          ? `Scouted ${scout.beatKey} with no durable candidate`
          : `Scouted ${scout.beatKey}: saved ${scout.savedCount}, assigned ${scout.assigned.join(", ")}`,
        {
          discoveryDelta: scout.savedCount,
          selfState,
          experience: scoutExperience,
          reflection: reflected.summary,
          decision: scoutExperience.judgment,
        },
      );
    }
    return {
      persona: persona.persona_name,
      profileId: persona.profile_id,
      residentRole: persona.resident_role,
      action: {
        type: "LIFE_CYCLE",
        work: {
          type: scout.noAction ? "NO_ACTION" : "WORLD_SCOUT",
          posted: false,
          subjectCount: scout.candidateCount,
        },
        social: { type: "IGNORE" },
      },
      result: { work: scout, social: { skipped: true } },
      productHunter: null,
      correspondent: null,
      worldScout: scout,
      observation: {
        sources: playbook.sources,
        query: scout.queries.join(" || "),
        subjectKinds: [],
        followingCount: 0,
        feedCount: 0,
        newsCount: worldNews.length,
        trendCount: 0,
        reason: `${playbook.work} | beat=${scout.beatKey} saved=${scout.savedCount} intent=${intent.stance}:${intent.focus}`,
      },
      social: {
        persona: persona.persona_name,
        profileId: persona.profile_id,
        residentRole: persona.resident_role,
        targetPostId: null,
        action: { type: "IGNORE" },
        result: { skipped: true },
      },
      mind: {
        intent: intent.stance,
        focus: intent.focus,
        why: intent.why,
        decision: scout.savedCount > 0 ? "SAVE" : "WAIT",
        outcome: scout.noAction ? "no durable candidate" : `saved ${scout.savedCount}`,
        reflection: reflected.summary,
        nextIntent: selfState.nextIntent?.focus || intent.focus,
        confidence: selfState.confidence,
      },
    };
  }

  const relationships = await loadRelationships(persona);
  const followingIds = new Set(relationships.following.map((row) => row.id));
  for (const row of relationships.following) {
    if (!selfState.relationships[row.id]) {
      selfState.relationships[row.id] = "friend";
    }
  }

  // Additive, independent of the normal social action below: if this
  // persona has a real question it acknowledged earlier (via the
  // INVESTIGATE action) and enough time has passed, try to resolve it now
  // with a real search pass and a grounded reply. This does not replace
  // or compete with the normal LIKE/COMMENT/REPLY decision later in this
  // cycle -- a resident can both follow up on an old thread and react to
  // something new in the same run.
  if (!dryRun) {
    try {
      const resolution = await resolveOnePendingCommentInvestigation(persona);
      if (resolution.resolved) {
        await remember(
          persona.id,
          "investigation",
          "comment",
          resolution.postId ?? null,
          `Followed up on an earlier question (${resolution.status ?? "updated"}).`,
        );
      }
    } catch (error) {
      console.error("comment investigation resolution failed", persona.persona_name, error);
    }
  }

  const candidates = await loadFeedCandidates(persona, followingIds, playbook);

  let hunter: ResidentProductHunterResult | null = null;
  if (playbook.role === "product_hunter") {
    try {
      hunter = await runResidentProductHunter(persona, worldNews, {
        dryRun,
        intent,
        selfState,
        experiences: snapshot.experiences,
        exploration,
      });
    } catch (error) {
      console.error("product hunter failed", persona.persona_name, error);
    }
  }

  let correspondent: CorrespondentWatchResult | null = null;
  try {
    correspondent = await watchWorldForResident(persona, {
        intent,
        selfState,
        experiences: snapshot.experiences,
        worldNews,
        googleTrends,
        peerSignals,
        hunterUrls: hunter?.candidates.map((item) => item.productUrl) ?? [],
        dryRun,
        runId: options?.runId,
        exploration,
        openInvestigations: openInvestigations.map((item) => ({
          title: item.title,
          sourceUrl: item.sourceUrl,
          nextAction: item.nextAction,
        })),
      });
    } catch (error) {
      console.error("correspondent watch failed", persona.persona_name, error);
    }

  const rawSubjects = await gatherPostSubjects(
    persona,
    hunter,
    candidates,
    playbook,
    correspondent,
    verifiedLeads.map((item) => ({
      title: item.title,
      sourceUrl: item.sourceUrl,
      sourceKind: item.sourceKind,
      provenance: item.entityKey,
    })),
  );
  const recentOwnPostKeys = await loadRecentOwnPostKeys(persona.profile_id);
  const subjects = dropRepeatedSubjects(
    rawSubjects,
    [...exploration.avoidEntities, ...intent.avoid],
    recentOwnPostKeys,
  );
  const assignedDiscoverySubjects = subjects.filter(isAssignedDiscoverySubject);
  const postableAssignedDiscoveries = assignedDiscoverySubjects.filter(
    isPostableAssignedDiscovery,
  );
  const hasAssignedHandoff = postableAssignedDiscoveries.length > 0;
  const cadenceReady = shouldEncouragePost(persona);
  const humanSignals = await loadResidentHumanSignals({
    profileId: persona.profile_id,
    discoveryProductIds: hunter?.savedProductIds,
  }).catch(() => null);
  const humanLine = humanSignals ? signalsToMemoryLine(humanSignals) : "";
  const hasProductSubject = subjects.some((subject) => isProductLikeSubject(subject));
  const mayTweet =
    playbook.allowTrendTweet &&
    shouldAttemptFallbackTweet({
      activityLevel: persona.activity_level,
      seed: `${persona.id}:${new Date().toISOString().slice(0, 13)}:tweet`,
      hasProductSubject,
    });
  // Assigned handoffs are real verified products from World Scout — do not
  // drop them solely because the resident posted recently (cadence).
  const encouragePost =
    (cadenceReady && (subjects.length > 0 || mayTweet)) || hasAssignedHandoff;

  const newsLines =
    playbook.sources.includes("world_news") && worldNews.length
      ? worldNews
          .slice(0, 5)
          .filter((article) => isHttpUrl(article.url))
          .map((article) => `- ${article.title}`)
          .join("\n")
      : playbook.sources.includes("world_news")
        ? "いま使える世界ニュース信号はありません"
        : "この役割では世界ニュースは主情報源ではない。";

  const trendLines =
    playbook.sources.includes("google_trends") && googleTrends.length
      ? googleTrends
          .slice(0, 8)
          .map(
            (trend) =>
              `- ${trend.title}${trend.traffic ? ` / ${trend.traffic}` : ""}`,
          )
          .join("\n")
      : playbook.sources.includes("google_trends")
        ? "現在取得できるGoogle Trendsはありません"
        : "この役割ではGoogle Trendsは主情報源ではない。";

  const assignedHandoffBlock = hasAssignedHandoff
    ? [
        "World Scoutから今回正式に担当へ届いた商品があります。",
        "これは優先して検討する題材です。",
        "商品名、ブランド、商品URL、画像URLは題材データを使用してください。",
        "架空の商品や架空URLを作らないでください。",
        "",
        postableAssignedDiscoveries
          .map((subject) =>
            [
              `【担当handoff 題材 ${subject.id}】`,
              `種類: discovery (assigned)`,
              `名前: ${subject.label}`,
              subject.brand ? `ブランド: ${subject.brand}` : "",
              subject.productUrl ? `商品URL: ${subject.productUrl}` : "",
              subject.mediaUrl ? `画像URL: ${subject.mediaUrl}` : "",
              subject.category ? `カテゴリ: ${subject.category}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n"),
        "",
      ].join("\n")
    : "";

  const subjectLines = subjects.length
    ? subjects
        .map((subject) =>
          [
            `【題材 ${subject.id}】`,
            `種類: ${subject.kind}${subject.assigned ? " (World Scout handoff)" : ""}`,
            `名前: ${subject.label}`,
            subject.brand ? `ブランド: ${subject.brand}` : "",
            subject.productUrl ? `商品URL: ${subject.productUrl}` : "商品URL: なし",
            subject.sourceUrl ? `情報源: ${subject.sourceUrl}` : "",
            subject.kind === "world" ? "種類: 世界情報（商品ページではない）" : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")
    : mayTweet
      ? "今使える実在の題材はありません。商品を作らず、日常の短いつぶやきならPOSTしてよい。毎回投稿する必要はない。"
      : "今使える実在の題材はありません。SKIP_POSTしてください。";

  const cadenceGuidance = hasAssignedHandoff
    ? "World Scoutから正式に担当へ届いた商品があります。最近投稿していても、その担当商品だけは優先して検討してください。通常のつぶやきや別題材は無理に出さなくてよい。"
    : cadenceReady
      ? mayTweet || subjects.length > 0
        ? "今日は発信してもよい番です。商品投稿・つぶやき・SKIP_POSTのどれでも自然です。"
        : "今日は交流が中心でもよい。無理に投稿しなくていい。"
      : "最近投稿したばかりならSKIP_POSTしてください。";

  const hasFollowUpSubject = subjects.some((subject) => subject.followUp === true);
  const postAngleHint = hasAssignedHandoff
    ? "特派員から届いたばかりの発見（Discovery）。「〜を見つけた」に近い自然な一報として書ける。"
    : hasFollowUpSubject
      ? "以前の発見の続報・確認（Follow-up / Verification）。前回と何が変わったか・何が確認できたかを書ける。"
      : openInvestigations.length > 0
        ? "進行中の調査がある。「今〜を調べている」という調査中の切り口も自然。"
        : "新しい発見（Discovery）、現地からの一言（Field Note）、比較など、そのとき一番自然な角度でよい。";

  const workContext = `
${personaVoiceBlock(persona, playbook)}

関係:
フォロー中: ${
    relationships.following.map((row) => row.name).join(", ") || "まだ少ない"
  }
最近の記憶:
${relationships.recentMemories.join("\n") || "まだ少ない"}
${humanLine ? `人間の反応: ${humanLine}` : ""}

観察:
${playbook.sources.join(", ")}

${playbook.sources.includes("google_trends") ? `現在のGoogle Trends:\n${trendLines}` : ""}

${playbook.sources.includes("world_news") ? `世界ニュース（発見/トレンドの信号。商品そのものではない。URLを商品URLに使わない）:\n${newsLines}` : ""}

今日の探索クエスト:
軸: ${exploration.axis}
地域: ${exploration.city} / ${exploration.region}
beat: ${exploration.beat}
目的: ${exploration.goal}
理由: ${exploration.reason}
クエリ: ${exploration.queries.join(" | ")}
ソース種別: ${exploration.sources.join(", ")}

今の意図: ${intent.stance} / ${intent.focus}
なぜ: ${intent.why}
避けたいもの: ${intent.avoid.slice(0, 5).join(", ") || "なし"}
最近の経験:
${snapshot.experiences.slice(0, 4).map(experienceLine).join("\n") || "まだ少ない"}
担当世界: ${
    correspondent
      ? `${correspondent.identityTitle || correspondent.beat.primary} / ${correspondent.city || ""} / ${correspondent.beat.regions.join(", ")}`
      : "未設定"
  }
他の住民から届いた信号: ${
    peerSignals
      .slice(0, 3)
      .map((item) => `${item.fromName}: ${item.title}`)
      .join(" / ") || "なし"
  }
${
    correspondent
      ? `今回の世界観察: scanned=${correspondent.scanned} accepted=${correspondent.accepted.length} dropped=${correspondent.dropped.length} query=${correspondent.query || "shared"}`
      : ""
  }

${
    hunter
      ? `今回の探索クエリ: ${hunter.searchQuery}\n今回見つけたWeb商品候補: ${hunter.candidates
          .filter((item) => item.origin !== "catalog")
          .map((item) => `${item.brand} ${item.productName}`)
          .join(" / ") || "なし"}`
      : ""
  }

${assignedHandoffBlock}今使える実在の題材:
${subjectLines}

この役割の仕事:
${playbook.work}
${playbook.workBias}

ルール:
- あなたはNEWFINDで生活している住民です。コンテンツ生成ボットではありません。
- 他の役割の仕事をしない。product_hunter以外はWeb商品狩りをしない。
- 題材リストにある実在情報だけを商品投稿に使ってください。
- 題材の本文・他の住民の投稿文をそのままコピーしない。必ず自分の言葉で書く。
- 存在しない商品・URL・画像を作ってはいけません。
- catalog / discovery / feed の題材は「NEWFIND世界にある物」であり、「今Webで見つけた」とは書かない。
- ニュース記事・検索結果・カテゴリページを商品として扱わない。
- kind が world の題材は世界情報。商品URLにせず、情報源URLを本文か出典として残す。存在しないニュースは書かない。
- 同じ世界情報を他の住民が既に扱っているなら、新しい視点か続報だけ書く。なければSKIP_POST。
- 昨日と同じ商品・同じ記事を「また見つけた」と書かない。競合、別地域、続報だけが新しい理由になる。
- 投稿するなら ${exploration.city} の ${playbook.role} として、他の住民と違う視点を出す。
- 商品がない日は、人格に沿った短いつぶやきでもよい。その場合は subjectId を付けない。
- つぶやきに架空の商品リンクを付けない。
- 投稿文は ${persona.posting_style || "短く自然な一人称"} で。
- 視点: ${roleCaptionLens(persona.resident_role)}
- 今回の切り口: ${postAngleHint}
- ${cadenceGuidance}
- ${
    hasAssignedHandoff
      ? "assigned discoveryがある場合、まずその題材をPOST候補として検討してください。"
      : "無理に毎回投稿しなくてよい。"
  }
- IGNOREという行動はありません。POSTかSKIP_POSTだけです。
`;

  let workDecision: ResidentLifeDecision;
  const feedCaptions = candidates.map((item) => item.caption);
  try {
    workDecision = await decideResidentLifePost(workContext);
  } catch (error) {
    console.error("life post decision failed", persona.persona_name, error);
    workDecision = fallbackLifePost(persona, subjects, encouragePost);
  }
  if (workDecision.type === "POST") {
    const subjectId = workDecision.subjectId;
    if (subjectId) {
      const matched = resolvePostSubject(subjects, subjectId);
      // Prefer assigned handoff only when the returned subjectId did not resolve.
      // Do not silently swap a valid matched subject for a different product.
      const subject =
        matched ??
        postableAssignedDiscoveries[0] ??
        (cadenceReady ? subjects[0] : undefined);
      if (!subject) {
        workDecision = {
          type: "SKIP_POST",
          reason: "subject not in list",
        };
      } else if (
        isAssignedDiscoverySubject(subject) &&
        !isPostableAssignedDiscovery(subject)
      ) {
        workDecision = {
          type: "SKIP_POST",
          reason: "assigned discovery missing usable product image",
        };
      } else {
        const copied = captionCopiesSubject(
          workDecision.caption,
          subject,
          feedCaptions,
        );
        const needsRewrite = !matched || copied;
        if (needsRewrite) {
          const rewritten = await rewriteSubjectCaption({
            persona,
            playbook,
            subject,
          });
          workDecision =
            rewritten.type === "POST"
              ? {
                  type: "POST",
                  caption: rewritten.caption,
                  subjectId: subject.id,
                }
              : {
                  type: "SKIP_POST",
                  reason: rewritten.reason || "caption rewrite failed",
                };
        } else {
          workDecision = {
            type: "POST",
            caption: workDecision.caption,
            subjectId: subject.id,
          };
        }
      }
    } else if (!mayTweet || !cadenceReady) {
      workDecision = {
        type: "SKIP_POST",
        reason: "tweet not in cadence",
      };
    }
  }

  // If cadence alone caused a soft skip but a verified handoff exists, retry once.
  if (
    workDecision.type === "SKIP_POST" &&
    hasAssignedHandoff &&
    !cadenceReady
  ) {
    const handoff = postableAssignedDiscoveries[0];
    try {
      const handoffRetry = await decideResidentLifePost(
        workContext +
          `\n\n追加: 通常の投稿間隔だけでは担当handoff商品を捨てないでください。題材ID ${handoff.id}（${handoff.label}）について、自分の視点でPOSTするか、本当に書けないときだけSKIP_POSTしてください。`,
      );
      if (handoffRetry.type === "POST") {
        const matched =
          (handoffRetry.subjectId
            ? resolvePostSubject(subjects, handoffRetry.subjectId)
            : undefined) ?? handoff;
        const subject = isPostableAssignedDiscovery(matched)
          ? matched
          : handoff;
        const copied = captionCopiesSubject(
          handoffRetry.caption,
          subject,
          feedCaptions,
        );
        if (copied || !handoffRetry.subjectId) {
          const rewritten = await rewriteSubjectCaption({
            persona,
            playbook,
            subject,
          });
          workDecision =
            rewritten.type === "POST"
              ? {
                  type: "POST",
                  caption: rewritten.caption,
                  subjectId: subject.id,
                }
              : {
                  type: "SKIP_POST",
                  reason: rewritten.reason || "handoff rewrite failed",
                };
        } else {
          workDecision = {
            type: "POST",
            caption: handoffRetry.caption,
            subjectId: subject.id,
          };
        }
      }
    } catch (error) {
      console.error(
        "assigned handoff post retry failed",
        persona.persona_name,
        error,
      );
    }
  }

  if (
    workDecision.type === "SKIP_POST" &&
    playbook.forcePostRetry &&
    (cadenceReady || hasAssignedHandoff) &&
    (subjects.length > 0 || hasAssignedHandoff)
  ) {
    try {
      const retry = await decideResidentLifePost(
        workContext +
          (hasAssignedHandoff
            ? "\n\n追加: World Scoutからの担当商品を優先し、題材IDを1つ選び自分の口調でPOSTしてください。catalogをWeb発見とは書かないでください。"
            : "\n\n追加: 今日は自分の役割として発信してよい番です。題材IDを1つ選び、自分の口調でPOSTしてください。catalogをWeb発見とは書かないでください。"),
      );
      if (retry.type === "POST") {
        if (retry.subjectId) {
          const matched = resolvePostSubject(subjects, retry.subjectId);
          const subject =
            matched ??
            postableAssignedDiscoveries[0] ??
            subjects[0];
          if (subject) {
            if (
              isAssignedDiscoverySubject(subject) &&
              !isPostableAssignedDiscovery(subject)
            ) {
              workDecision = {
                type: "SKIP_POST",
                reason: "assigned discovery missing usable product image",
              };
            } else {
              const copied = captionCopiesSubject(
                retry.caption,
                subject,
                feedCaptions,
              );
              const needsRewrite = !matched || copied;
              if (needsRewrite) {
                const rewritten = await rewriteSubjectCaption({
                  persona,
                  playbook,
                  subject,
                });
                workDecision =
                  rewritten.type === "POST"
                    ? {
                        type: "POST",
                        caption: rewritten.caption,
                        subjectId: subject.id,
                      }
                    : {
                        type: "SKIP_POST",
                        reason: rewritten.reason || "caption rewrite failed",
                      };
              } else {
                workDecision = {
                  type: "POST",
                  caption: retry.caption,
                  subjectId: subject.id,
                };
              }
            }
          }
        } else {
          workDecision = retry;
        }
      } else {
        workDecision = fallbackLifePost(persona, subjects, true);
      }
    } catch (error) {
      console.error("life post retry failed", persona.persona_name, error);
      workDecision = fallbackLifePost(persona, subjects, true);
    }
  }

  if (
    workDecision.type === "SKIP_POST" &&
    cadenceReady &&
    mayTweet &&
    playbook.allowTrendTweet
  ) {
    workDecision = fallbackLifeTweet(persona);
  }

  if (workDecision.type === "POST") {
    const posted = workDecision;
    const subject = posted.subjectId
      ? subjects.find((item) => item.id === posted.subjectId)
      : undefined;
    if (
      subject &&
      isAssignedDiscoverySubject(subject) &&
      !isPostableAssignedDiscovery(subject)
    ) {
      workDecision = {
        type: "SKIP_POST",
        reason: "assigned discovery missing usable product image",
      };
    } else {
      const polished = await polishCaption({
        persona,
        caption: posted.caption,
        subject,
        recentCaptions: feedCaptions,
      });
      if (!polished) {
        workDecision = {
          type: "SKIP_POST",
          reason: "caption failed uniqueness/quality",
        };
      } else {
        workDecision = { ...posted, caption: polished };
      }
    }
  }

  let workResult: unknown = { skipped: true };
  let workType: "POST" | "SKIP_POST" | "PRODUCT_HUNT" =
    workDecision.type === "POST" ? "POST" : "SKIP_POST";
  let memoryCandidate = "";

  if (workDecision.type === "POST") {
    const posted = workDecision;
    const subject = posted.subjectId
      ? subjects.find((item) => item.id === posted.subjectId)
      : undefined;
    const workMemory = roleWorkMemory(playbook, subject ?? null, posted.caption);
    memoryCandidate = workMemory.content;
    if (subject) {
      if (dryRun) {
        workResult = { dryRun: true, subject: subject.label };
        workType = "POST";
      } else {
        try {
          workResult = await executeWorkPost(
            persona,
            subject,
            posted.caption,
            hunter,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("work post execution failed", persona.persona_name, error);
          workResult = {
            executed: false,
            skipped: true,
            reason: "WORK_POST_FAILED",
            error: message,
          };
        }
        const skipped =
          workResult != null &&
          typeof workResult === "object" &&
          ("skipped" in workResult || "executed" in workResult) &&
          (Boolean((workResult as { skipped?: boolean }).skipped) ||
            (("executed" in workResult) &&
              (workResult as { executed?: boolean }).executed === false));
        if (skipped) {
          workType = hunter ? "PRODUCT_HUNT" : "SKIP_POST";
        } else {
          workType = "POST";
          await remember(
            persona.id,
            workMemory.memoryType,
            "subject",
            subject.id,
            workMemory.content,
          );
          await logAiActivity({
            personaId: persona.id,
            actorName: persona.display_name || persona.persona_name,
            actorRole: playbook.role,
            action: "posted",
            detail: posted.caption.slice(0, 180),
            relatedProductId: subject.discoveryProductId ?? null,
            relatedRunId: options?.runId ?? null,
            metadata: {
              world: subject.kind === "world",
              title: subject.label,
              url: subject.sourceUrl ?? subject.productUrl,
              infoKind: subject.category,
            },
          });
          const postedId =
            workResult &&
            typeof workResult === "object" &&
            "result" in workResult
              ? String(
                  (workResult as { result?: { id?: string; post?: { id?: string } } })
                    .result?.id ||
                    (workResult as { result?: { post?: { id?: string } } }).result
                      ?.post?.id ||
                    "",
                ) || null
              : null;
          const lead =
            verifiedLeads.find(
              (item) => item.sourceUrl && item.sourceUrl === subject.sourceUrl,
            ) ??
            openInvestigations.find(
              (item) => item.sourceUrl && item.sourceUrl === subject.sourceUrl,
            );
          if (lead) {
            await markInvestigationPosted({
              id: lead.id,
              postId: postedId,
            });
          }
        }
      }
    } else if (!posted.subjectId) {
      if (dryRun) {
        workResult = { dryRun: true, tweet: posted.caption };
        workType = "POST";
      } else {
        workResult = await executeAIAction(
          {
            type: "POST",
            caption: posted.caption,
            category: tweetCategory([
              ...(persona.preferred_categories ?? []),
              ...(persona.interests ?? []),
            ]),
          },
          persona.profile_id,
        );
        workType = "POST";
        await remember(
          persona.id,
          workMemory.memoryType,
          "tweet",
          persona.id,
          workMemory.content,
        );
      }
    }
  } else {
    workResult = { skipped: true, reason: workDecision.reason };
    memoryCandidate = `${playbook.role} skipped post: ${workDecision.reason || "no post"}`;
  }

  const candidateLines = candidates.length
    ? (
        await Promise.all(
          candidates.map(async (post, index) => {
            const commentLines = post.comments.length
              ? post.comments
                  .map((comment) => {
                    const reply = comment.parentCommentId
                      ? ` (reply to ${comment.parentCommentId})`
                      : "";
                    return `- ${comment.id}${reply} / ${comment.author}: ${comment.body}`;
                  })
                  .join("\n")
              : "コメントなし";
            return [
              `【投稿候補 ${index + 1}】`,
              `投稿ID: ${post.id}`,
              `投稿者ID: ${post.authorId}`,
              `投稿者名: ${post.authorName}`,
              followingIds.has(post.authorId) ? "関係: フォロー中" : "関係: まだ疎い",
              `カテゴリ: ${post.category}`,
              `本文: ${post.caption}`,
              `商品URL: ${post.productUrl ?? "なし"}`,
              `コメント:`,
              commentLines,
            ].join("\n");
          }),
        )
      ).join("\n\n")
    : "現在、他の住民の投稿候補はありません。";

  const socialContext = `
${personaVoiceBlock(persona, playbook)}

あなたがフォローしている住民:
${
    relationships.following
      .map((row) => `${row.name} (${row.id})`)
      .join("\n") || "まだ少ない"
  }

最近の記憶:
${relationships.recentMemories.join("\n") || "まだ少ない"}

この役割の交流:
${playbook.socialBias}
あなたの視点（コメント・返信で必ず使う）: ${playbook.commentLens}
優先しやすい行動: ${playbook.preferredSocial.join(", ")}

あなたが今見ることのできる投稿候補:
${candidateLines}

ルール:
- 今は交流の番です。新規POSTはしない。
- フォロー中の住民や、興味が近い相手を優先する。初対面の人間ユーザーへ散発LIKEしない。
- 実在する投稿ID / コメントID / 投稿者IDだけを使う。
- DISCOVER_PRODUCTは product_hunter かつ投稿に実在する商品URLがあるときだけ。
- 商品リンクがないつぶやきにも LIKE / COMMENT / REPLY してよい。
- critic は値しないものに LIKE しなくてよい。IGNORE も自然。
- 嫌がらせや人格攻撃は禁止。
- 投稿本文をコピーしたコメントは禁止。見たものへの自分の反応だけ。
- 「すごい」「面白い」「私も好き」だけのコメントは禁止。
- COMMENTするなら、自分の視点（上記）を使って新しい情報・別解釈・質問・比較・${exploration.city}の現地知識のどれかを入れる。同じ専門分野の他の住民とは違う角度になるはず。
- 発見・調査・異議・続報・確認のいずれかとして反応する。馴れ合いだけのコメントは禁止。
- 候補のコメント欄に他の住民の発言が既にある場合は、それを読んでから書く。同意するなら何に・なぜ同意するかを具体的に書き、違う見解があるなら率直に指摘してよい。ただの追従（「私もそう思う」「いいね」だけ）は禁止。
- 全員が同じ投稿に反応する必要はない。自分の視点から言うことが本当にないなら IGNORE が自然。専門外の投稿に無理に反応しない。
- 自分がまだコメントしていない投稿には COMMENT してよい。
- すでに自分がコメントした投稿には COMMENT せず、必要なら REPLY する。
- REPLYは実在するコメントIDだけ。投稿内容と関係ない返信は禁止。
- IGNOREは候補が空のとき、専門外のとき、または critic/curator が本当に何もしないとき。
`;

  let socialAction: AIAction;
  try {
    socialAction = await decideAIAction(socialContext);
  } catch (error) {
    console.error("social decision failed", persona.persona_name, error);
    socialAction = { type: "IGNORE" };
  }
  if (
    socialAction.type === "DISCOVER_PRODUCT" &&
    playbook.role !== "product_hunter"
  ) {
    socialAction =
      "postId" in socialAction
        ? { type: "SAVE", postId: socialAction.postId }
        : { type: "IGNORE" };
  }
  if (socialAction.type === "IGNORE" && candidates.length > 0) {
    if (!playbook.allowSocialIgnore) {
      socialAction = fallbackSocialAction(
        persona,
        candidates,
        followingIds,
        playbook,
        exploration.city,
        intent.stance === "interact" ||
          intent.stance === "follow_up" ||
          intent.stance === "investigate",
      );
    }
  }
  const socialText =
    socialAction.type === "COMMENT" || socialAction.type === "REPLY"
      ? socialAction.text
      : "";
  if (
    socialText &&
    (captionLooksCopied(socialText, feedCaptions) ||
      isLowValueComment(socialText) ||
      !commentHasInformationValue(socialText)) &&
    candidates.length > 0
  ) {
    socialAction = fallbackSocialAction(
      persona,
      candidates,
      followingIds,
      playbook,
      exploration.city,
      true,
    );
  }
  const fallbackText =
    socialAction.type === "COMMENT" || socialAction.type === "REPLY"
      ? socialAction.text
      : "";
  if (
    fallbackText &&
    (isLowValueComment(fallbackText) || !commentHasInformationValue(fallbackText))
  ) {
    // Keep a conversational fallback when possible instead of silencing the timeline
    const recovered = fallbackSocialAction(
      persona,
      candidates,
      followingIds,
      playbook,
      exploration.city,
      true,
    );
    if (
      (recovered.type === "COMMENT" || recovered.type === "REPLY") &&
      commentHasInformationValue(recovered.text)
    ) {
      socialAction = recovered;
    } else {
      socialAction = { type: "IGNORE" };
    }
  }

  const socialMemory = roleSocialMemory(playbook, socialAction);
  if (!memoryCandidate) memoryCandidate = socialMemory.content;

  let socialResult: unknown;
  let socialSucceeded = false;
  if (dryRun) {
    socialResult = { dryRun: true, action: socialAction.type };
    socialSucceeded = socialAction.type !== "IGNORE";
  } else {
    try {
      socialResult = await executeAIAction(socialAction, persona.profile_id);
      socialSucceeded =
        socialAction.type !== "IGNORE" &&
        Boolean(
          socialResult &&
            typeof socialResult === "object" &&
            (!("error" in (socialResult as { error?: unknown })) &&
              (!("executed" in (socialResult as { executed?: unknown })) ||
                (socialResult as { executed?: boolean }).executed !== false)),
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("social action execution failed", persona.persona_name, error);
      socialResult = {
        executed: false,
        error: message,
        action: socialAction.type,
      };
    }
  }

  if (!dryRun && socialSucceeded) {
    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: playbook.role,
      action: "reacted",
      detail: socialAction.type,
      relatedRunId: options?.runId ?? null,
    });
  }

  if (!dryRun && socialSucceeded) {
    const subjectId =
      "postId" in socialAction
        ? socialAction.postId
        : "profileId" in socialAction
          ? socialAction.profileId
          : null;
    await remember(
      persona.id,
      socialMemory.memoryType,
      socialAction.type.toLowerCase(),
      subjectId,
      socialMemory.content,
    );
  }

  const socialTargetId =
    "profileId" in socialAction
      ? socialAction.profileId
      : "postId" in socialAction
        ? candidates.find((item) => item.id === socialAction.postId)?.authorId
        : null;
  if (socialTargetId) {
    selfState = {
      ...selfState,
      relationships: {
        ...selfState.relationships,
        [socialTargetId]: relateFromSocial({
          existing: selfState.relationships[socialTargetId],
          action: socialAction.type,
          sameInterest: followingIds.has(socialTargetId),
        }),
      },
    };
  }

  const lastAction = [
    hunter ? "HUNT" : null,
    `WORK:${workType}`,
    `SOCIAL:${socialAction.type}`,
  ]
    .filter(Boolean)
    .join("+");

  const top = hunter?.decisions?.[0];
  const worldTop = correspondent?.accepted[0];
  if (top) {
    selfState = {
      ...selfState,
      lastDecision: {
        decision: top.decision as Experience["judgment"],
        reasonSummary: top.reason,
        confidence: selfState.confidence,
        evidenceIds: [],
        alternativeCount: 4,
        uncertainty: Math.max(10, 100 - selfState.confidence),
        known: top.reason,
        unknown: "",
      },
    };
  }
  const experience: Experience = {
    seen:
      worldTop?.title ||
      top?.product ||
      (workDecision.type === "POST" ? workDecision.caption.slice(0, 80) : workType),
    judgment:
      worldTop?.decision === "POST"
        ? "POST"
        : top?.decision === "DISCOVER" || top?.decision === "SAVE"
        ? (top.decision as Experience["judgment"])
        : workType === "POST"
          ? "POST"
          : socialAction.type === "IGNORE"
            ? "WAIT"
            : "OBSERVE",
    reason:
      worldTop?.reason ||
      top?.reason ||
      (workDecision.type === "SKIP_POST" ? workDecision.reason || "skipped" : lastAction),
    outcome:
      worldTop
        ? `${worldTop.dispatchKind} ${worldTop.infoKind} score=${worldTop.scores.total}`
        : hunter?.funnelSummary || (workType === "POST" ? "posted" : socialAction.type),
    next: nextExplorationHint(exploration, {
      newCount:
        (hunter?.newResultCount ?? 0) +
        (correspondent?.newResultCount ?? 0),
      posted: workType === "POST",
      brands: hunter?.candidates.map((item) => item.brand) ?? [],
      sources: correspondent?.accepted.map((item) => item.domain) ?? [],
    }),
    entityKey: worldTop?.url || top?.product,
    at: new Date().toISOString(),
  };
  const reflected = reflectWithoutLlm({
    state: selfState,
    experiences: [experience, ...snapshot.experiences],
    lastDecision: selfState.lastDecision,
    outcome: experience.outcome,
  });
  selfState = freezeCanonicalIdentity(
    applyReflection(applyExperience(selfState, experience), reflected),
    personaLens,
  );

  if (!dryRun) {
    await remember(
      persona.id,
      "observation",
      "exploration",
      exploration.axis,
      serializeExploration(exploration),
    );
    await logAiActivity({
      personaId: persona.id,
      actorName: persona.display_name || persona.persona_name,
      actorRole: playbook.role,
      action: "search",
      detail: `${exploration.axis} ${exploration.city}: ${exploration.queries[0] || exploration.goal}`,
      relatedRunId: options?.runId ?? null,
      metadata: {
        exploration: true,
        date: exploration.date,
        axis: exploration.axis,
        region: exploration.region,
        city: exploration.city,
        beat: exploration.beat,
        goal: exploration.goal,
        queries: exploration.queries,
        sources: exploration.sources,
        searchPasses:
          (hunter?.searchPasses ?? 0) + (correspondent?.searchPasses ?? 0),
        newCandidates:
          (hunter?.newResultCount ?? 0) + (correspondent?.newResultCount ?? 0),
        rejected: correspondent?.dropped.length ?? 0,
        posted: workType === "POST",
        commented: socialAction.type === "COMMENT" || socialAction.type === "REPLY",
      },
    });
    await persistPersonaState(
      persona,
      lastAction,
      workDecision.type === "POST"
        ? `Posted: ${workDecision.caption.slice(0, 120)}`
        : `Social: ${socialAction.type} | intent ${selfState.currentIntent.stance}:${selfState.currentFocus}`,
      {
        discoveryDelta: hunter?.savedProductIds.length ?? 0,
        interactionDelta: socialSucceeded ? 1 : 0,
        humanLine,
        selfState,
        experience,
        reflection: reflected.summary,
        decision: experience.judgment,
      },
    );
  }

  return {
    persona: persona.persona_name,
    profileId: persona.profile_id,
    residentRole: persona.resident_role,
    action: {
      type: "LIFE_CYCLE",
      work: {
        type: hunter && workType !== "POST" ? "PRODUCT_HUNT" : workType,
        posted: workType === "POST",
        skipReason:
          workDecision.type === "SKIP_POST" ? workDecision.reason : undefined,
        caption:
          workDecision.type === "POST" ? workDecision.caption : undefined,
        subjectCount: subjects.length,
      },
      social: socialAction,
    },
    result: {
      work: workResult,
      social: socialResult,
    },
    productHunter: hunter,
    correspondent,
    worldScout: null,
    observation: {
      sources: playbook.sources,
      query: correspondent?.query ?? hunter?.searchQuery ?? null,
      subjectKinds: subjects.map((subject) => subject.kind),
      followingCount: relationships.following.length,
      feedCount: candidates.length,
      newsCount: playbook.sources.includes("world_news") ? worldNews.length : 0,
      trendCount: playbook.sources.includes("google_trends")
        ? googleTrends.length
        : 0,
      newsHeadlines: playbook.sources.includes("world_news")
        ? worldNews.slice(0, 5).map((item) => item.title)
        : [],
      trendTitles: playbook.sources.includes("google_trends")
        ? googleTrends.slice(0, 8).map((item) => item.title)
        : [],
      feedCaptions: feedCaptions.map((item) => item.slice(0, 120)),
      followingNames: relationships.following.map((row) => row.name),
      subjects: subjects.map((subject) => ({
        id: subject.id,
        kind: subject.kind,
        label: subject.label.slice(0, 80),
      })),
      hunterOrigins: hunter
        ? hunter.candidates.map((item) => item.origin)
        : [],
      reason: [
        playbook.work,
        hunter
          ? `hunt query=${hunter.searchQuery}`
          : `observed ${playbook.sources.join(",")}`,
        workDecision.type === "POST"
          ? `work POST as ${playbook.role}`
          : `work SKIP (${workDecision.reason || "no post"})`,
        `social ${socialAction.type} (${playbook.preferredSocial.join("/")})`,
        `intent ${intent.stance}:${intent.focus} → ${selfState.currentIntent.stance}:${selfState.currentFocus}`,
        correspondent
          ? `world ${correspondent.beat.primary} scanned=${correspondent.scanned} accepted=${correspondent.accepted.length}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    },
    memoryCandidate,
    exploration,
    mind: {
      intent: intent.stance,
      focus: intent.focus,
      why: intent.why,
      decision: experience.judgment,
      outcome: experience.outcome,
      reflection: reflected.summary,
      nextIntent: selfState.currentIntent.focus,
      confidence: selfState.confidence,
    },
    social: {
      persona: persona.persona_name,
      profileId: persona.profile_id,
      residentRole: persona.resident_role,
      targetPostId: "postId" in socialAction ? socialAction.postId : null,
      action: socialAction,
      result: socialResult,
    },
  };
}
