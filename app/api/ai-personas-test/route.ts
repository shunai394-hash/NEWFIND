import { NextResponse } from "next/server";
import { supabaseStore } from "@/lib/store/supabase";

export async function GET() {
  try {
    const posts = await supabaseStore.getAIPosts(0, 1);

    return NextResponse.json({
      ok: true,
      aiPosts: posts.length,
      persona: posts[0]
        ? {
            personaId: posts[0].personaId,
            personaName: posts[0].personaName,
            profileId: posts[0].author.id,
          }
        : null,
    });
  } catch (error) {
    console.error("AI persona test error:", error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
