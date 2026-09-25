import type { AiPersona } from "@/lib/ai-post-engine";
import { searchWorld, type WorldSearchResult } from "@/lib/ai/world-search";
import { generateAIText } from "@/lib/ai/groq";
import { parseAIJson } from "@/lib/ai/brain";
import { executeAIAction, publishAIProductPost } from "@/lib/ai/action-executor";
import { evaluateProductCandidates, type ProductHunterCandidate } from "@/lib/ai/product-hunter";
import { classifyProductMatch } from "@/lib/ai/product-identity";
import { listDiscoveryProductsFromDb, saveDiscoveryProductToDb } from "@/lib/discovery/db";
import { prepareDiscoveryProduct } from "@/lib/discovery/rules";
import type { DiscoveryProductInput } from "@/lib/discovery/types";
import { isUsableProductImage } from "@/lib/discovery/media";
import {
  loadPendingCommentInvestigations,
  upsertInvestigation,
  type InvestigationRecord,
} from "@/lib/ai/investigations";

type ResolveResult = {
  resolved: boolean;
  status?: string;
  postId?: string;
  reason?: string;
  newDiscovery?: {
    discoveryProductId: string;
    postId: string;
  };
};

function stripQuestionPrefix(title: string): string {
  return title.replace(/^Q:\s*/, "").trim();
}

function formatSearchResults(results: WorldSearchResult[]): string {
  const usable = results
    .filter((item) => item.origin !== "catalog")
    .slice(0, 5);
  if (!usable.length) return "有用な検索結果は見つかりませんでした。";
  return usable
    .map(
      (item, index) =>
        `[${index + 1}] ${item.title}\n${item.snippet.slice(0, 220)}\n出典: ${item.url}`,
    )
    .join("\n\n");
}

type GroundedAnswer = {
  text: string;
  found: boolean;
  confidence: number;
};

async function composeGroundedReply(input: {
  persona: AiPersona;
  question: string;
  postCaption: string | null;
  resultsBlock: string;
}): Promise<GroundedAnswer> {
  const prompt = [
    `あなたはNEWFIND世界の住民 ${input.persona.persona_name} です。`,
    "以前、以下のコメントに「確認してみる」と答えました。今回、実際に調べた検索結果をもとに、正直に返信してください。",
    "",
    `元の投稿: ${input.postCaption || "(内容不明)"}`,
    `質問・確認したい内容: ${input.question}`,
    "",
    "検索結果:",
    input.resultsBlock,
    "",
    "ルール:",
    "- 検索結果にある事実だけを使う。検索結果に書かれていないことは書かない。",
    "- 検索結果から十分に答えられるなら、はっきり答える。",
    "- 検索結果が不十分・矛盾している場合は、正直に「まだ確認できていない」「情報源によって違う」などと書く。分かったふりをしない。",
    "- 「実際に使った」「店で見た」などの体験を作らない。",
    "- captionは1〜3文。その住民のスマホでの口調で。",
    "",
    "必ずJSONだけを返してください。",
    '{"text":"返信文","found":true,"confidence":0}',
    "foundは、検索結果から質問に実質的に答えられたときだけtrue。confidenceは0〜100の整数。",
  ].join("\n");

  const raw = await generateAIText(prompt, { temperature: 0.4, maxTokens: 500 });
  const parsed = parseAIJson<{ text?: string; found?: boolean; confidence?: number }>(
    raw,
  );
  const text = (parsed?.text || "").trim();
  if (!text) {
    return {
      text: "まだ確認できていない。もう少し調べてみる。",
      found: false,
      confidence: 0,
    };
  }
  return {
    text,
    found: Boolean(parsed?.found),
    confidence: Math.max(0, Math.min(100, Math.round(Number(parsed?.confidence) || 0))),
  };
}

const CONTINUITY_LEADS = [
  "さっきの話がきっかけで気になって調べてみたら、",
  "あのコメントの続きで掘ってみたら、",
  "さっきの質問から派生して探してみたら、",
  "会話の流れで確認しがてら見てみたら、",
];

function pickContinuityLead(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CONTINUITY_LEADS[hash % CONTINUITY_LEADS.length];
}

function candidateToConversationDiscoveryInput(
  candidate: ProductHunterCandidate,
  persona: AiPersona,
  provenance: { commentId: string; postId: string; investigationEntityKey: string | null; question: string },
): DiscoveryProductInput {
  const now = new Date().toISOString();
  const productImageUrl = isUsableProductImage(candidate.productImageUrl)
    ? candidate.productImageUrl
    : null;
  return {
    id: crypto.randomUUID(),
    brand: candidate.brand,
    productName: candidate.productName,
    category: candidate.category,
    subcategory: candidate.subcategory,
    country: candidate.country,
    description: candidate.description,
    productImageUrl,
    productUrl: candidate.productUrl,
    officialUrl: candidate.officialUrl,
    price: candidate.price,
    currency: candidate.currency,
    sku: candidate.sku,
    gtin: candidate.gtin,
    modelNumber: candidate.modelNumber,
    launchDate: candidate.launchDate,
    canonicalUrl: candidate.report.canonicalUrl,
    // Conversation-derived discoveries reuse the existing discoveryReport
    // jsonb field for provenance instead of a new migration/table: the
    // originating comment/post/investigation stay traceable without ever
    // being shown to the user (captions never reference raw ids).
    discoveryReport: {
      ...candidate.report,
      sourceKind: "conversation",
      sourceCommentId: provenance.commentId,
      sourcePostId: provenance.postId,
      sourceInvestigationEntityKey: provenance.investigationEntityKey,
      sourceQuestion: provenance.question,
    },
    trendScore: candidate.trendScore,
    confidenceScore: candidate.confidenceScore,
    discoverySource: "ai_conversation",
    discoveredByResidentId: persona.id,
    discoveredAt: now,
    attentionReason: candidate.attentionReason,
    status: "pending",
    trendTags: candidate.trendTags,
    sources: [
      {
        id: crypto.randomUUID(),
        sourceType: candidate.officialUrl ? "brand_official" : "other",
        sourceUrl: candidate.productUrl,
        sourceTitle: `${candidate.brand} - ${candidate.productName}`,
        sourceDomain: new URL(candidate.productUrl).hostname,
        publishedAt: candidate.launchDate,
        sourceExcerpt: candidate.description,
        verificationStatus: "unverified",
        sourceTier: candidate.officialUrl ? 1 : 4,
        createdAt: now,
      },
    ],
    people: [],
    sales: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Turns a resolved comment-investigation into a real Discovery + POST, but
 * ONLY when the search that grounded the reply also turned up a genuinely
 * new, verifiable product (a real product page evaluateProductCandidates
 * could fetch and score -- not a paraphrase of the question). This is the
 * "would this exist without this conversation?" gate: most Q&A never
 * clears it, and that is expected -- it should end as a plain REPLY.
 *
 * Every step below reuses the exact pipeline World Scout discoveries use
 * (evaluateProductCandidates -> classifyProductMatch dedup ->
 * prepareDiscoveryProduct -> saveDiscoveryProductToDb -> publishAIProductPost),
 * so conversation-derived discoveries land in the same feed/pipeline and
 * meet the same quality bar, with zero schema changes.
 */
async function tryCreateConversationDiscovery(input: {
  persona: AiPersona;
  pending: InvestigationRecord;
  question: string;
  commentId: string;
  results: WorldSearchResult[];
}): Promise<{ discoveryProductId: string; postId: string } | null> {
  if (!input.results.length) return null;

  const candidates = await evaluateProductCandidates({
    residentId: input.persona.id,
    residentName: input.persona.persona_name,
    personality: input.persona.personality,
    interests: input.persona.interests ?? [],
    preferredCategories: input.persona.preferred_categories ?? [],
    goals: input.persona.goals ?? [],
    expertise: input.persona.expertise ?? [],
    values: input.persona.values ?? [],
    region: input.persona.region,
    languages: input.persona.languages ?? [],
    culture: input.persona.culture,
    huntingSpecialty: (input.persona.expertise ?? []).slice(0, 3).join(" / ") || undefined,
    hunterUsername: input.persona.username ?? undefined,
    results: input.results,
  }).catch((error) => {
    console.warn("conversation discovery candidate evaluation failed", error);
    return [] as ProductHunterCandidate[];
  });

  const candidate = candidates.find((item) => item.origin !== "catalog");
  if (!candidate) return null;

  let existingProducts: Awaited<ReturnType<typeof listDiscoveryProductsFromDb>> = [];
  try {
    existingProducts = await listDiscoveryProductsFromDb({ admin: true, status: "all" });
  } catch (error) {
    console.warn("conversation discovery: existing products unavailable", error);
    return null;
  }

  const match = classifyProductMatch(
    {
      brand: candidate.brand,
      productName: candidate.productName,
      sku: candidate.sku,
      gtin: candidate.gtin,
      modelNumber: candidate.modelNumber,
      productUrl: candidate.productUrl,
      officialUrl: candidate.officialUrl,
      attentionReason: candidate.attentionReason,
      trendTags: candidate.trendTags,
      price: candidate.price,
    },
    existingProducts,
  );

  // Paraphrase / already-known material must NOT spawn a new Discovery --
  // duplicate and rediscovery both end here, as a normal REPLY only.
  if (match.kind !== "new") return null;

  const preparedInput = candidateToConversationDiscoveryInput(candidate, input.persona, {
    commentId: input.commentId,
    postId: input.pending.postId ?? "",
    investigationEntityKey: input.pending.entityKey ?? null,
    question: input.question,
  });
  const prepared = prepareDiscoveryProduct(preparedInput);
  const saved = await saveDiscoveryProductToDb(prepared);

  if (!isUsableProductImage(saved.productImageUrl)) {
    // publishAIProductPost requires a real product image; the Discovery
    // itself is still saved (an editor/other resident can post it later),
    // but auto-posting here would violate the existing image requirement.
    return { discoveryProductId: saved.id, postId: "" };
  }

  const lead = pickContinuityLead(input.commentId);
  const caption = `${lead}${candidate.productName}${
    candidate.brand ? `（${candidate.brand}）` : ""
  }を見つけた。${candidate.attentionReason}`.trim();

  const posted = await publishAIProductPost(input.persona.profile_id, {
    discoveryProductId: saved.id,
    brand: candidate.brand,
    productName: candidate.productName,
    category: candidate.category,
    productUrl: candidate.productUrl,
    productImageUrl: saved.productImageUrl,
    description: candidate.description,
    residentName: input.persona.persona_name,
    attentionReason: candidate.attentionReason,
    caption,
  }).catch((error) => {
    console.warn("conversation discovery: publishAIProductPost failed", error);
    return null;
  });

  if (!posted || !posted.executed || !("postId" in posted) || !posted.postId) {
    return { discoveryProductId: saved.id, postId: "" };
  }

  return { discoveryProductId: saved.id, postId: posted.postId };
}

/**
 * Resolves ONE pending comment-triggered investigation for a persona:
 * a real search pass grounded in the original question, then a REPLY
 * (never fabricated) nested under the persona's own previous reply,
 * advancing the DISCOVERY/INVESTIGATING/VERIFIED state via the same
 * nextInvestigationStatus machine world-scout/correspondent-watch use.
 * Returns { resolved: false } when there is nothing pending, so callers
 * can fall through to the normal social decision unchanged.
 */
export async function resolveOnePendingCommentInvestigation(
  persona: AiPersona,
): Promise<ResolveResult> {
  const pendingList = await loadPendingCommentInvestigations(persona.id).catch(
    () => [] as InvestigationRecord[],
  );
  const pending = pendingList[0];
  if (!pending || !pending.postId || !pending.commentId) {
    return { resolved: false };
  }

  // Runaway guard: a question that still hasn't resolved after several real
  // search passes is closed out instead of being retried forever (bounded
  // on top of the existing 7-day stale-investigation expiry). No extra
  // reply is sent here -- the persona already acknowledged the question and
  // gave its best answer on earlier passes.
  const MAX_FOLLOW_UP_PASSES = 4;
  if (pending.evidenceCount >= MAX_FOLLOW_UP_PASSES) {
    await upsertInvestigation({
      personaId: persona.id,
      profileId: persona.profile_id,
      actorName: persona.persona_name,
      actorRole: persona.resident_role || "resident",
      title: pending.title,
      summary: pending.summary,
      entityKey: pending.entityKey ?? `comment:${pending.commentId}`,
      postId: pending.postId,
      commentId: pending.commentId,
      decision: "IGNORE",
      qualityOk: true,
      qualityReason: "MAX_FOLLOW_UP_REACHED",
    }).catch(() => undefined);
    return { resolved: false, reason: "max follow-up passes reached" };
  }

  const question = stripQuestionPrefix(pending.title);
  const results = await searchWorld({
    residentId: persona.id,
    residentName: persona.persona_name,
    interests: persona.interests?.length ? persona.interests : ["product"],
    preferredCategories: persona.preferred_categories?.length
      ? persona.preferred_categories
      : ["other"],
    goals: persona.goals ?? [],
    query: [question, pending.summary].filter(Boolean).join(" "),
    country: persona.country_code,
    language: (persona.languages ?? [])[0],
    expertise: persona.expertise,
    region: persona.region,
  }).catch((error) => {
    console.warn("comment investigation search failed", error);
    return [] as WorldSearchResult[];
  });

  const answer = await composeGroundedReply({
    persona,
    question,
    postCaption: pending.summary,
    resultsBlock: formatSearchResults(results),
  }).catch(() => ({
    text: "まだ確認できていない。もう少し調べてみる。",
    found: false,
    confidence: 0,
  }));

  const replyResult = await executeAIAction(
    {
      type: "REPLY",
      postId: pending.postId,
      parentCommentId: pending.commentId,
      text: answer.text,
    },
    persona.profile_id,
  );

  const executed =
    replyResult &&
    typeof replyResult === "object" &&
    !("error" in (replyResult as { error?: unknown })) &&
    (replyResult as { executed?: boolean }).executed !== false;

  if (!executed) {
    // Nothing new posted (e.g. a stray duplicate) -- still record that we
    // tried, so the cooldown prevents hammering the same dead end.
    await upsertInvestigation({
      personaId: persona.id,
      profileId: persona.profile_id,
      actorName: persona.persona_name,
      actorRole: persona.resident_role || "resident",
      title: pending.title,
      summary: pending.summary,
      entityKey: pending.entityKey ?? `comment:${pending.commentId}`,
      postId: pending.postId,
      commentId: pending.commentId,
      decision: "WAIT",
      qualityOk: true,
    }).catch(() => undefined);
    return { resolved: false, reason: "reply not executed" };
  }

  const newCommentId =
    replyResult &&
    typeof replyResult === "object" &&
    "result" in replyResult &&
    replyResult.result &&
    typeof replyResult.result === "object" &&
    "comment" in (replyResult.result as Record<string, unknown>)
      ? String(
          ((replyResult.result as { comment?: { id?: string } }).comment?.id) ?? "",
        ) || pending.commentId
      : pending.commentId;

  const advanced = await upsertInvestigation({
    personaId: persona.id,
    profileId: persona.profile_id,
    actorName: persona.persona_name,
    actorRole: persona.resident_role || "resident",
    title: pending.title,
    summary: pending.summary,
    entityKey: pending.entityKey ?? `comment:${pending.commentId}`,
    postId: pending.postId,
    commentId: newCommentId,
    confidence: answer.confidence,
    decision: answer.found && answer.confidence >= 55 ? "POST" : "INVESTIGATE_MORE",
    qualityOk: true,
    qualityReason: answer.found ? undefined : "LOW_EVIDENCE",
  });

  // Only a confidently grounded, found answer is even worth checking for a
  // new Discovery -- everything else (unfound / low-confidence) stays a
  // plain REPLY, matching the "not every reply spawns a post" guard.
  let newDiscovery: ResolveResult["newDiscovery"];
  if (answer.found && answer.confidence >= 55 && pending.postId) {
    const created = await tryCreateConversationDiscovery({
      persona,
      pending,
      question,
      commentId: newCommentId,
      results,
    }).catch((error) => {
      console.warn("conversation-derived discovery failed", error);
      return null;
    });
    if (created && created.postId) {
      newDiscovery = { discoveryProductId: created.discoveryProductId, postId: created.postId };
    }
  }

  return { resolved: true, status: advanced.status, postId: pending.postId, newDiscovery };
}
