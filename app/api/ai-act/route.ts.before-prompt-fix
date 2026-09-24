import { NextResponse } from "next/server";
import { supabaseStore } from "@/lib/store/supabase";
import { getActiveAiPersonas, type AiPersona } from "@/lib/ai-post-engine";
import { decideAIAction } from "@/lib/ai/brain";
import { executeAIAction } from "@/lib/ai/action-executor";
import { getSharedWorldNews } from "@/lib/ai/gdelt";
import { runResidentProductHunter } from "@/lib/ai/resident-product-hunter";
import { ensureAiResidentPopulation } from "@/lib/ai/resident-factory";
import { ensureFeaturedLivingResidents } from "@/lib/ai/ensure-featured-residents";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorldSearchResult } from "@/lib/ai/world-search";

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

async function runResidentSocialAction(persona: AiPersona) {
  const feedResult = await supabaseStore.getFeed(
    "foryou",
    persona.profile_id,
    0,
    10,
  );

  const candidates = feedResult.posts.filter(
    (post) => post.author.id !== persona.profile_id,
  );

  if (candidates.length === 0) {
    return {
      persona: persona.persona_name,
      profileId: persona.profile_id,
      residentRole: persona.resident_role,
      action: { type: "IGNORE" as const },
      reason: "No candidate posts",
    };
  }

  const post = candidates[0];
  const comments = await loadPostComments(post.id);
  const commentLines = comments.length
    ? comments
        .map((comment) => {
          const reply = comment.parentCommentId
            ? ` (reply to ${comment.parentCommentId})`
            : "";
          return `- ${comment.id}${reply} / ${comment.author}: ${comment.body}`;
        })
        .join("\n")
    : "なし";

  const worldLines = [
    persona.region || persona.country_code
      ? `出身 / origin: ${persona.region || persona.country_code}`
      : "",
    persona.languages && persona.languages.length > 0
      ? `言語 / languages: ${persona.languages.join(", ")}`
      : "",
    persona.expertise && persona.expertise.length > 0
      ? `専門 / expertise: ${persona.expertise.join(", ")}`
      : "",
    persona.values && persona.values.length > 0
      ? `価値観 / values: ${persona.values.join(", ")}`
      : "",
    persona.culture ? `文化 / culture: ${persona.culture}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const context = `
あなたはAIユーザー「${persona.persona_name}」です。
You are a NEWFIND resident, not a content generator.

役割:
${persona.resident_role ?? "general_user"}

目標:
${(persona.goals ?? []).join(", ")}

性格:
${persona.personality}

興味:
${persona.interests.join(", ")}

投稿スタイル:
${persona.posting_style}

コメントスタイル:
${persona.comment_style}

${worldLines}

対象投稿:
投稿ID: ${post.id}
投稿者ID: ${post.author.id}
投稿者名: ${post.author.displayName}
カテゴリー: ${post.category}
本文: ${post.caption}
商品URL: ${post.productUrl ?? "なし"}

この投稿へのコメント:
${commentLines}

この投稿を見て、あなた自身として次に取る行動を1つだけ決めてください。
LIKE / COMMENT / REPLY / POST / FOLLOW / SAVE / DISCOVER_PRODUCT / IGNORE から選んでください。
REPLYする場合は、上に実在するコメントIDだけを parentCommentId に使ってください。
FOLLOWする場合は、投稿者ID ${post.author.id} を使ってください。
コメントや投稿は、この住民の性格・コメントスタイルの言語で書いてください。
専門性は商品の見方として使ってください。政治投稿の専門家になってはいけません。
`;

  const action = await decideAIAction(context);
  const result = await executeAIAction(action, persona.profile_id);

  return {
    persona: persona.persona_name,
    profileId: persona.profile_id,
    residentRole: persona.resident_role,
    targetPostId: post.id,
    action,
    result,
  };
}

async function runAIAct(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const factory = await ensureAiResidentPopulation();
    let featuredResidents: Awaited<
      ReturnType<typeof ensureFeaturedLivingResidents>
    > = [];
    try {
      featuredResidents = await ensureFeaturedLivingResidents();
    } catch (error) {
      console.error("Featured living residents failed. Continuing.", error);
    }

    const personas = await getActiveAiPersonas();


    if (personas.length === 0) {
      return NextResponse.json({
        ok: true,
        aiCount: 0,
        factory,
        results: [],
      });
    }

    let worldNews: WorldSearchResult[] = [];
    try {
      worldNews = await getSharedWorldNews();
    } catch (error) {
      console.error("Shared world news failed. Continuing without GDELT.", error);
      worldNews = [];
    }

    const results = [];

    for (const persona of personas) {
      try {
        if (persona.resident_role === "product_hunter") {
          const hunterResult = await runResidentProductHunter(
            persona,
            worldNews,
          );

          let social = null;
          try {
            social = await runResidentSocialAction(persona);
          } catch (error) {
            console.error(
              "Product hunter social action failed:",
              persona.persona_name,
              error,
            );
          }

          results.push({
            persona: persona.persona_name,
            profileId: persona.profile_id,
            residentRole: persona.resident_role,
            action: {
              type: "PRODUCT_HUNT",
            },
            productHunter: hunterResult,
            social,
          });
          continue;
        }

        results.push(await runResidentSocialAction(persona));
      } catch (error) {
        console.error("AI resident action failed:", persona.persona_name, error);
        results.push({
          persona: persona.persona_name,
          profileId: persona.profile_id,
          residentRole: persona.resident_role,
          action: { type: "IGNORE" },
          error:
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      aiCount: personas.length,
      factory,
      featuredResidents,
      worldNewsCount: worldNews.length,
      results,
    });
  } catch (error) {
    console.error("AI act error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runAIAct(request);
}

export async function POST(request: Request) {
  return runAIAct(request);
}
