import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth/request-user";
import { loadControlTowerSnapshot } from "@/lib/ai/control-tower/snapshot";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import { latestFailedRun, setEnginePaused } from "@/lib/ai/control-tower/runs";
import { executeAiEngine, type AiEngineMode } from "@/lib/ai/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const snapshot = await loadControlTowerSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

const ACTIONS = [
  "run_ai",
  "run_scout",
  "run_hunter",
  "retry_failed",
  "pause",
  "resume",
] as const;

type ControlAction = (typeof ACTIONS)[number];

function modeForAction(action: ControlAction): AiEngineMode {
  if (action === "run_scout") return "world_scout";
  if (action === "run_hunter") return "product_hunter";
  return "ai_engine";
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
    };
    const action = body.action as ControlAction | undefined;
    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    if (action === "pause") {
      await setEnginePaused(true, "Paused from Control Tower");
      await logAiActivity({
        actorName: "ADMIN",
        actorRole: "control_tower",
        action: "paused",
        detail: "Pause AI",
      });
      return NextResponse.json({ ok: true, paused: true });
    }

    if (action === "resume") {
      await setEnginePaused(false);
      await logAiActivity({
        actorName: "ADMIN",
        actorRole: "control_tower",
        action: "resumed",
        detail: "Resume AI",
      });
      return NextResponse.json({ ok: true, paused: false });
    }

    let mode: AiEngineMode = modeForAction(action);
    let triggeredBy: "admin" | "retry" = "admin";
    if (action === "retry_failed") {
      const failed = await latestFailedRun();
      const runType = (failed?.run_type as AiEngineMode | undefined) ?? "ai_engine";
      mode =
        runType === "world_scout" || runType === "product_hunter"
          ? runType
          : "ai_engine";
      triggeredBy = "retry";
    }

    const executed = await executeAiEngine({
      mode,
      triggeredBy,
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

    return NextResponse.json({ ok: true, ...executed.body });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
