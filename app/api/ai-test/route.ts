import { NextResponse } from "next/server";
import { generateAIText } from "@/lib/ai/groq";

export async function GET() {
  try {
    const text = await generateAIText(
      "NEWFINDのAIユーザーとして、ファッションについて短い自然な日本語コメントをしてください。"
    );

    return NextResponse.json({ ok: true, text });
  } catch (error) {
    console.error("Groq test error:", error);

    return NextResponse.json(
      { ok: false, error: "Groq API request failed" },
      { status: 500 }
    );
  }
}
