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
import {
  executeAIAction,
  publishAIProductPost,
} from "@/lib/ai/action-executor";
import {
  runResidentProductHunter,
  type ResidentProductHunterResult,
} from "@/lib/ai/resident-product-hunter";


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
  if (!subjects.length) {
    return { type: "SKIP_POST", reason: "no live subject" };
  }
  if (!encourage) {
    return { type: "SKIP_POST", reason: "recently posted" };
  }
  const subject = subjects[hashSeed(persona.id + (persona.last_action || "")) % subjects.length];
  if (!subject) {
    return { type: "SKIP_POST", reason: "missing subject" };
  }
  const name = [subject.brand, subject.productName || subject.label]
    .filter(Boolean)
    .join(" ")
    .trim();
  const role = persona.resident_role || "general_user";
  const ja = usesJapanese(persona);
  const lines: Record<string, string> = {
    product_hunter: ja
      ? `今日見つけたこれ、ちょっと気になる。${name}`
      : `Found this today: ${name}.`,
    critic: ja
      ? `この商品、話題になってるけど私はここが気になる。${name}`
      : `${name} is getting noise. I'm not convinced yet.`,
    curator: ja
      ? `${name}、残しておきたい感じ。`
      : `${name} is staying in my list.`,
    fan: ja ? `${name}、好き。` : `Still here for ${name}.`,
    media: ja
      ? `${name}、今これ見てる人多そう。`
      : `${name} is what people are circling today.`,
    reviewer: ja
      ? `${name}、使う前から気になる点がある。`
      : `${name}: I want to test it before the praise.`,
    influencer: ja ? `${name}、手元で見たい。` : `I want ${name} in front of me.`,
    trend_hunter: ja
      ? `${name}、流れ的に今だと思う。`
      : `${name} feels like the current turn.`,
    general_user: ja
      ? `${name}、ちょっと気になった。`
      : `${name} caught my eye.`,
  };
  return {
    type: "POST",
    subjectId: subject.id,
    caption: lines[role] || lines.general_user,
  };
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

function personaVoiceBlock(persona: AiPersona): string {
  return [
    `名前: ${persona.persona_name}`,
    `仕事: ${persona.resident_role ?? "general_user"}`,
    `目標: ${(persona.goals ?? []).join(", ") || "特になし"}`,
    `人格: ${persona.personality}`,
    `興味: ${(persona.interests ?? []).join(", ") || "特になし"}`,
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
  } catch (error) {
    console.error("loadRelationships follows failed", error);
  }

  let recentMemories: string[] = [];
  try {
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
  extras?: { discoveryDelta?: number; interactionDelta?: number },
) {
  const admin = createAdminClient();
  const memoryBits = [
    persona.memory_summary,
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
  worldNews: WorldSearchResult[],
  hunter: ResidentProductHunterResult | null,
): Promise<PostSubject[]> {
  const subjects: PostSubject[] = [];
  let n = 1;

  if (hunter) {
    hunter.candidates.forEach((candidate, index) => {
      if (!isHttpUrl(candidate.productUrl)) return;
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
        discoveryProductId: hunter.savedProductIds[index] ?? null,
        hunterIndex: index,
      });
    });
  }

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
  ).slice(0, 4);

  if (catalogMatches.length === 0) {
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
    ).slice(0, 3);

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

  for (const article of worldNews.slice(0, 3)) {
    if (!isHttpUrl(article.url)) continue;
    subjects.push({
      id: String(n++),
      kind: "news",
      label: article.title,
      sourceUrl: article.url,
      mediaUrl: isHttpUrl(article.imageUrl) ? article.imageUrl : null,
      category: "lifestyle",
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

async function loadFeedCandidates(
  persona: AiPersona,
  followingIds: Set<string>,
): Promise<FeedCandidate[]> {
  const feedResult = await supabaseStore.getFeed(
    "foryou",
    persona.profile_id,
    0,
    24,
  );

  const others = feedResult.posts.filter(
    (post) => post.author.id !== persona.profile_id,
  );
  const followed = others.filter((post) => followingIds.has(post.author.id));
  const rest = seededShuffle(
    others.filter((post) => !followingIds.has(post.author.id)),
    `${persona.id}:feed:${Date.now().toString().slice(0, 8)}`,
  );

  const ranked = [...followed, ...rest].slice(0, 6);

  return Promise.all(
    ranked.map(async (post) => ({
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
): AIAction {
  if (candidates.length === 0) return { type: "IGNORE" };

  const followedPost = candidates.find((post) => followingIds.has(post.authorId));
  const interestPost = candidates.find((post) =>
    matchesPersona(persona, `${post.caption} ${post.category}`),
  );
  const target = followedPost || interestPost || candidates[0];
  if (!target) return { type: "IGNORE" };

  const reply = target.comments[0];
  const roll = hashSeed(`${persona.id}:${target.id}:${persona.last_action || ""}`) % 10;

  if (reply && roll < 2) {
    return {
      type: "REPLY",
      postId: target.id,
      parentCommentId: reply.id,
      text:
        (persona.languages ?? []).includes("ja") ||
        (persona.languages ?? []).includes("Japanese")
          ? "これ、気になる視点。"
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
    const discoveryProductId = hunter.savedProductIds[subject.hunterIndex];
    if (candidate && discoveryProductId) {
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
): Promise<ResidentLifeCycleResult> {
  const relationships = await loadRelationships(persona);
  const followingIds = new Set(relationships.following.map((row) => row.id));

  let hunter: ResidentProductHunterResult | null = null;
  if (persona.resident_role === "product_hunter") {
    try {
      hunter = await runResidentProductHunter(persona, worldNews);
    } catch (error) {
      console.error("product hunter failed", persona.persona_name, error);
    }
  }

  const subjects = await gatherPostSubjects(persona, worldNews, hunter);
  const encouragePost = shouldEncouragePost(persona) && subjects.length > 0;

  const trendLines = googleTrends.length
    ? googleTrends
        .slice(0, 8)
        .map(
          (trend) =>
            `- ${trend.title}${trend.traffic ? ` / ${trend.traffic}` : ""}`,
        )
        .join("\n")
    : "現在取得できるGoogle Trendsはありません";

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
    : "今使える実在の題材はありません。SKIP_POSTしてください。";

  const workContext = `
${personaVoiceBlock(persona)}

関係:
フォロー中: ${
    relationships.following.map((row) => row.name).join(", ") || "まだ少ない"
  }
最近の記憶:
${relationships.recentMemories.join("\n") || "まだ少ない"}

現在のGoogle Trends:
${trendLines}

今使える実在の題材:
${subjectLines}

ルール:
- あなたはNEWFINDで生活している住民です。コンテンツ生成ボットではありません。
- 仕事は傾向であり、行動を禁止しません。
- 題材リストにある実在情報だけを使ってください。
- 存在しない商品・URL・画像を作ってはいけません。
- 投稿文は ${persona.posting_style || "短く自然な一人称"} で。
- ${encouragePost ? "今日は発信する番です。題材があるならPOSTしてください。" : "最近投稿したばかりならSKIP_POSTしても構いません。"}
- IGNOREという行動はありません。POSTかSKIP_POSTだけです。
`;

  let workDecision: ResidentLifeDecision;
  try {
    workDecision = await decideResidentLifePost(workContext);
  } catch (error) {
    console.error("life post decision failed", persona.persona_name, error);
    workDecision = fallbackLifePost(persona, subjects, encouragePost);
  }
  if (workDecision.type === "POST") {
    const subjectId = workDecision.subjectId;
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) {
      workDecision = {
        type: "SKIP_POST",
        reason: "subject not in list",
      };
    }
  }

  if (workDecision.type === "SKIP_POST" && encouragePost && subjects.length > 0) {
    try {
      const retry = await decideResidentLifePost(
        workContext + "\n\n追加: あなたはNEWFINDで生活しています。今日は何かしら発信してください。SKIP_POSTは使わないでください。題材IDを1つ選び、自分の口調でPOSTしてください。",
      );
      if (retry.type === "POST") {
        const subject = subjects.find((item) => item.id === retry.subjectId);
        if (subject) workDecision = retry;
      } else {
        workDecision = fallbackLifePost(persona, subjects, true);
      }
    } catch (error) {
      console.error("life post retry failed", persona.persona_name, error);
      workDecision = fallbackLifePost(persona, subjects, true);
    }
  }

  let workResult: unknown = { skipped: true };
  let workType: "POST" | "SKIP_POST" | "PRODUCT_HUNT" =
    workDecision.type === "POST" ? "POST" : "SKIP_POST";

  if (workDecision.type === "POST") {
    const posted = workDecision;
    const subject = subjects.find((item) => item.id === posted.subjectId);
    if (subject) {
      workResult = await executeWorkPost(
        persona,
        subject,
        posted.caption,
        hunter,
      );
      workType = "POST";
      await remember(
        persona.id,
        "post",
        "subject",
        subject.id,
        `Posted about ${subject.label}`,
      );
    }
  } else {
    workResult = { skipped: true, reason: workDecision.reason };
  }

  const candidates = await loadFeedCandidates(persona, followingIds);
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
${personaVoiceBlock(persona)}

あなたがフォローしている住民:
${
    relationships.following
      .map((row) => `${row.name} (${row.id})`)
      .join("\n") || "まだ少ない"
  }

最近の記憶:
${relationships.recentMemories.join("\n") || "まだ少ない"}

あなたが今見ることのできる投稿候補:
${candidateLines}

ルール:
- 今は交流の番です。新規POSTはしない。
- 仕事は交流を禁止しません。
- フォロー中の住民や、よく話す相手を優先してよい。
- 実在する投稿ID / コメントID / 投稿者IDだけを使う。
- DISCOVER_PRODUCTは投稿に実在する商品URLがあるときだけ。
- IGNOREは候補が空のときだけ。
`;

  let socialAction: AIAction;
  try {
    socialAction = await decideAIAction(socialContext);
  } catch (error) {
    console.error("social decision failed", persona.persona_name, error);
    socialAction = { type: "IGNORE" };
  }
  if (socialAction.type === "IGNORE" && candidates.length > 0) {
    socialAction = fallbackSocialAction(persona, candidates, followingIds);
  }

  const socialResult = await executeAIAction(socialAction, persona.profile_id);

  if (socialAction.type !== "IGNORE") {
    const subjectId =
      "postId" in socialAction
        ? socialAction.postId
        : "profileId" in socialAction
          ? socialAction.profileId
          : null;
    await remember(
      persona.id,
      "social",
      socialAction.type.toLowerCase(),
      subjectId,
      `${socialAction.type} in NEWFIND`,
    );
  }

  const lastAction = [
    hunter ? "HUNT" : null,
    `WORK:${workType}`,
    `SOCIAL:${socialAction.type}`,
  ]
    .filter(Boolean)
    .join("+");

  await persistPersonaState(
    persona,
    lastAction,
    workDecision.type === "POST"
      ? `Posted: ${workDecision.caption.slice(0, 120)}`
      : `Social: ${socialAction.type}`,
    {
      discoveryDelta: hunter?.savedProductIds.length ?? 0,
      interactionDelta: socialAction.type === "IGNORE" ? 0 : 1,
    },
  );

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
