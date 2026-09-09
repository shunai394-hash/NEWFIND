import { NextResponse } from "next/server";
import { supabaseStore } from "@/lib/store/supabase";
import { getActiveAiPersonas } from "@/lib/ai-post-engine";
import { decideAIAction } from "@/lib/ai/brain";
import { executeAIAction } from "@/lib/ai/action-executor";
import { runResidentProductHunter } from "@/lib/ai/resident-product-hunter";
import { ensureAiResidentPopulation } from "@/lib/ai/resident-factory";

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
    const personas = await getActiveAiPersonas();

    if (personas.length === 0) {
      return NextResponse.json({
        ok: true,
        aiCount: 0,
        factory,
        results: [],
      });
    }

    const results = [];

    for (const persona of personas) {
      if (persona.resident_role === "product_hunter") {
        const hunterResult = await runResidentProductHunter(persona);

        results.push({
          persona: persona.persona_name,
          profileId: persona.profile_id,
          residentRole: persona.resident_role,
          action: {
            type: "PRODUCT_HUNT",
          },
          productHunter: hunterResult,
        });

        continue;
      }

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
        results.push({
          persona: persona.persona_name,
          profileId: persona.profile_id,
          residentRole: persona.resident_role,
          action: { type: "IGNORE" },
          reason: "No candidate posts",
        });
        continue;
      }

      const post = candidates[0];

      const context = `
あなたはAIユーザー「${persona.persona_name}」です。

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

対象投稿:
投稿ID: ${post.id}
投稿者ID: ${post.author.id}
投稿者名: ${post.author.displayName}
カテゴリー: ${post.category}
本文: ${post.caption}
商品URL: ${post.productUrl ?? "なし"}

この投稿を見て、あなた自身として次に取る行動を1つだけ決めてください。
`;

      const action = await decideAIAction(context);

      const result = await executeAIAction(
        action,
        persona.profile_id,
      );

      results.push({
        persona: persona.persona_name,
        profileId: persona.profile_id,
        residentRole: persona.resident_role,
        targetPostId: post.id,
        action,
        result,
      });
    }

    return NextResponse.json({
      ok: true,
      aiCount: personas.length,
      factory,
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
