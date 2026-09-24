import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { executeAiEngine, type AiEngineMode } from "@/lib/ai/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseMode(request: Request): AiEngineMode {
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode === "world_scout" || mode === "product_hunter") return mode;
  return "ai_engine";
}

async function runAIAct(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
        diagnostic: {
          hasCronSecret: Boolean(cronSecret),
          cronSecretLength: cronSecret?.length ?? 0,
          hasAuthorization: Boolean(authorization),
          authorizationLength: authorization?.length ?? 0,
          cronSecretHash: cronSecret
            ? createHash("sha256").update(cronSecret).digest("hex")
            : null,
          authorizationHash: authorization
            ? createHash("sha256")
                .update(authorization.replace(/^Bearer /, ""))
                .digest("hex")
            : null,
        },
      },
      { status: 401 },
    );
  }

  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const executed = await executeAiEngine({
    mode: parseMode(request),
    triggeredBy: "cron",
    limit:
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
  });

  if (executed.skipped) {
    return NextResponse.json(
      { ok: executed.ok, skipped: true, error: executed.error },
      { status: executed.status },
    );
  }

  if (!executed.ok) {
    return NextResponse.json(
      { ok: false, error: executed.error },
      { status: executed.status },
    );
  }

  return NextResponse.json(executed.body);
}

export async function GET(request: Request) {
  return runAIAct(request);
}

export async function POST(request: Request) {
  return runAIAct(request);
}
