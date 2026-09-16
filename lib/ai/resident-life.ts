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
import {
  getRolePlaybook,
  type RolePlaybook,
} from "@/lib/ai/resident-roles";
import {
  shouldAttemptFallbackTweet,
  tweetCategory,
} from "@/lib/posts/text-post";


export type ResidentLifeCycleOptions = {
  dryRun?: boolean;
};

export type ResidentLifeCycleResult = {
  persona: string;
  profileId: string;
  residentRole: string | null | undefined;
  action: {
    type: "LIFE_CYCLE";
    work: {
      type: "POST" | "SKIP_POST" | "PRODUCT_HUNT";
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

function isProductLikeSubject(subject: PostSubject | undefined): boolean {
  if (!subject) return false;
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
  return [
    `名前: ${persona.persona_name}`,
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
    `専門: ${(persona.expertise ?? []).join(", ") || "特になし"}`,
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
  extras?: { discoveryDelta?: number; interactionDelta?: number; humanLine?: string },
) {
  const admin = createAdminClient();
  const memoryBits = [
    persona.memory_summary,
    extras?.humanLine,
    lastThought,
  ]
    .filter(Boolean)
    .join(" / ")
    .slice(-480);

  await admin
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
}

async function gatherPostSubjects(
  persona: AiPersona,
  hunter: ResidentProductHunterResult | null,
  feed: FeedCandidate[],
  playbook: RolePlaybook,
): Promise<PostSubject[]> {
  const subjects: PostSubject[] = [];
  let n = 1;
  const allow = new Set(playbook.subjectKinds);

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

  if (playbook.role === "critic") {
    if (roll < 4) return { type: "IGNORE" };
    return {
      type: "COMMENT",
      postId: target.id,
      text: ja
        ? "流行りだけで見るのは少し早い。作りと値段が追いついているか見たい。"
        : "The noise is ahead of the object. I'm not convinced yet.",
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
        ? "使う前から気になる点が一つある。実際の持ちを見てから判断したい。"
        : "There's one thing I'd test before the praise.",
    };
  }

  if (playbook.role === "media") {
    if (reply && roll < 5) {
      return {
        type: "REPLY",
        postId: target.id,
        parentCommentId: reply.id,
        text: ja
          ? "今まわりで見られている話として、これ気になる。"
          : "This is the thing people are circling today.",
      };
    }
    return {
      type: "COMMENT",
      postId: target.id,
      text: ja
        ? "今の流れの中で、これが話題になってる。"
        : "This is what's in the air right now.",
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
        ? "これ、気になる視点ですね。"
        : "This is an interesting take.",
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
  const relationships = await loadRelationships(persona);
  const followingIds = new Set(relationships.following.map((row) => row.id));

  const candidates = await loadFeedCandidates(persona, followingIds, playbook);

  let hunter: ResidentProductHunterResult | null = null;
  if (playbook.role === "product_hunter") {
    try {
      hunter = await runResidentProductHunter(persona, worldNews, {
        dryRun,
      });
    } catch (error) {
      console.error("product hunter failed", persona.persona_name, error);
    }
  }

  const subjects = await gatherPostSubjects(persona, hunter, candidates, playbook);
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
  const encouragePost = cadenceReady && (subjects.length > 0 || mayTweet);

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

  const subjectLines = subjects.length
    ? subjects
        .map((subject) =>
          [
            `【題材 ${subject.id}】`,
            `種類: ${subject.kind}`,
            `名前: ${subject.label}`,
            subject.brand ? `ブランド: ${subject.brand}` : "",
            subject.productUrl ? `商品URL: ${subject.productUrl}` : "商品URL: なし",
            subject.sourceUrl ? `情報源: ${subject.sourceUrl}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")
    : mayTweet
      ? "今使える実在の題材はありません。商品を作らず、日常の短いつぶやきならPOSTしてよい。毎回投稿する必要はない。"
      : "今使える実在の題材はありません。SKIP_POSTしてください。";

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

${
    hunter
      ? `今回の探索クエリ: ${hunter.searchQuery}\n今回見つけたWeb商品候補: ${hunter.candidates
          .filter((item) => item.origin !== "catalog")
          .map((item) => `${item.brand} ${item.productName}`)
          .join(" / ") || "なし"}`
      : ""
  }

今使える実在の題材:
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
- 商品がない日は、人格に沿った短いつぶやきでもよい。その場合は subjectId を付けない。
- つぶやきに架空の商品リンクを付けない。
- 投稿文は ${persona.posting_style || "短く自然な一人称"} で。
- 視点: ${roleCaptionLens(persona.resident_role)}
- ${cadenceReady ? (mayTweet || subjects.length > 0 ? "今日は発信してもよい番です。商品投稿・つぶやき・SKIP_POSTのどれでも自然です。" : "今日は交流が中心でもよい。無理に投稿しなくていい。") : "最近投稿したばかりならSKIP_POSTしてください。"}
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
      const subject = matched ?? (cadenceReady ? subjects[0] : undefined);
      if (!subject) {
        workDecision = {
          type: "SKIP_POST",
          reason: "subject not in list",
        };
      } else {
        const copied = captionCopiesSubject(
          workDecision.caption,
          subject,
          feedCaptions,
        );
        const needsRewrite = !matched || copied;
        const rewritten = needsRewrite
          ? fallbackLifePost(persona, [subject], true)
          : null;
        workDecision = {
          type: "POST",
          caption:
            rewritten && rewritten.type === "POST"
              ? rewritten.caption
              : workDecision.caption,
          subjectId: subject.id,
        };
      }
    } else if (!mayTweet || !cadenceReady) {
      workDecision = {
        type: "SKIP_POST",
        reason: "tweet not in cadence",
      };
    }
  }

  if (
    workDecision.type === "SKIP_POST" &&
    playbook.forcePostRetry &&
    cadenceReady &&
    subjects.length > 0
  ) {
    try {
      const retry = await decideResidentLifePost(
        workContext +
          "\n\n追加: 今日は自分の役割として発信してよい番です。題材IDを1つ選び、自分の口調でPOSTしてください。catalogをWeb発見とは書かないでください。",
      );
      if (retry.type === "POST") {
        if (retry.subjectId) {
          const subject =
            resolvePostSubject(subjects, retry.subjectId) ?? subjects[0];
          if (subject) {
            const rewritten = captionCopiesSubject(
              retry.caption,
              subject,
              feedCaptions,
            )
              ? fallbackLifePost(persona, [subject], true)
              : null;
            workDecision = {
              type: "POST",
              caption:
                rewritten && rewritten.type === "POST"
                  ? rewritten.caption
                  : retry.caption,
              subjectId: subject.id,
            };
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
        workResult = await executeWorkPost(
          persona,
          subject,
          posted.caption,
          hunter,
        );
        const skipped =
          workResult != null &&
          typeof workResult === "object" &&
          "skipped" in workResult &&
          Boolean((workResult as { skipped?: boolean }).skipped);
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
- IGNOREは候補が空のとき、または critic/curator が本当に何もしないとき。
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
      );
    }
  }
  const socialText =
    socialAction.type === "COMMENT" || socialAction.type === "REPLY"
      ? socialAction.text
      : "";
  if (
    socialText &&
    captionLooksCopied(socialText, feedCaptions) &&
    candidates.length > 0
  ) {
    socialAction = fallbackSocialAction(
      persona,
      candidates,
      followingIds,
      playbook,
    );
  }

  const socialMemory = roleSocialMemory(playbook, socialAction);
  if (!memoryCandidate) memoryCandidate = socialMemory.content;

  const socialResult = dryRun
    ? { dryRun: true, action: socialAction.type }
    : await executeAIAction(socialAction, persona.profile_id);

  if (!dryRun && socialAction.type !== "IGNORE") {
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

  const lastAction = [
    hunter ? "HUNT" : null,
    `WORK:${workType}`,
    `SOCIAL:${socialAction.type}`,
  ]
    .filter(Boolean)
    .join("+");

  if (!dryRun) {
    await persistPersonaState(
      persona,
      lastAction,
      workDecision.type === "POST"
        ? `Posted: ${workDecision.caption.slice(0, 120)}`
        : `Social: ${socialAction.type}`,
      {
        discoveryDelta: hunter?.savedProductIds.length ?? 0,
        interactionDelta: socialAction.type === "IGNORE" ? 0 : 1,
        humanLine,
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
    observation: {
      sources: playbook.sources,
      query: hunter?.searchQuery ?? null,
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
      ].join(" | "),
    },
    memoryCandidate,
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
