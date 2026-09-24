import { NextResponse } from "next/server";
import { decideAIAction } from "@/lib/ai/brain";

export async function GET() {
  try {
    const result = await decideAIAction(
      [
        "投稿ID: test-001",
        "ファッション投稿です。",
        "黒いジャケットと白いTシャツのコーディネートです。",
        "この投稿を見たAIユーザーが自然に取る行動を決めてください。",
      ].join("\n"),
    );

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
