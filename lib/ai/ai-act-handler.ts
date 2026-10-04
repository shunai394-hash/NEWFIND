import { NextResponse } from "next/server";
import { hasBearerSecret, UNAUTHORIZED_BODY } from "@/lib/auth/cron-auth";
import type { AiEngineMode, executeAiEngine } from "@/lib/ai/engine";

type ExecuteAiEngine = typeof executeAiEngine;

const MAX_LIMIT = 50;
const NO_STORE = { "Cache-Control": "no-store" };

function parseMode(url: URL): AiEngineMode {
  const mode = url.searchParams.get("mode");
  if (mode === "world_scout" || mode === "product_hunter") return mode;
  return "ai_engine";
}

/**
 * /api/ai-act: run the AI engine for Vercel Cron (Authorization: Bearer CRON_SECRET).
 * A failed check returns one fixed 401 body: nothing about the configured
 * secret or the presented header (presence, length, hash) is disclosed.
 */
export function createAiActHandler(deps: {
  cronSecret: () => string | undefined;
  execute: (input: Parameters<ExecuteAiEngine>[0]) => ReturnType<ExecuteAiEngine>;
}) {
  return async function handle(request: Request) {
    if (!hasBearerSecret(request, [deps.cronSecret()])) {
      return NextResponse.json(UNAUTHORIZED_BODY, { status: 401, headers: NO_STORE });
    }

    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit"));
    const executed = await deps.execute({
      mode: parseMode(url),
      triggeredBy: "cron",
      limit:
        Number.isFinite(limitParam) && limitParam > 0
          ? Math.min(Math.floor(limitParam), MAX_LIMIT)
          : undefined,
    });

    if (executed.skipped) {
      return NextResponse.json(
        { ok: executed.ok, skipped: true, error: executed.error },
        { status: executed.status, headers: NO_STORE },
      );
    }

    if (!executed.ok) {
      return NextResponse.json(
        { ok: false, error: executed.error },
        { status: executed.status, headers: NO_STORE },
      );
    }

    return NextResponse.json(executed.body, { headers: NO_STORE });
  };
}
