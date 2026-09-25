import type { AiPersona } from "@/lib/ai-post-engine";
import { searchWorld, type WorldSearchResult } from "@/lib/ai/world-search";
import { generateAIText } from "@/lib/ai/groq";
import { parseAIJson } from "@/lib/ai/brain";
import { executeAIAction } from "@/lib/ai/action-executor";
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

  return { resolved: true, status: advanced.status, postId: pending.postId };
}
