import { NextResponse } from "next/server";
import { drainOutbox, requeueOutboxEvent } from "@/lib/integration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;
  const integrationSecret =
    process.env.INTEGRATION_HMAC_SECRET?.trim() ||
    process.env.NEWFIND_TRACER_SHARED_SECRET?.trim() ||
    "";
  const bearer = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (integrationSecret && bearer === integrationSecret) return true;
  return false;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requeue = url.searchParams.get("requeue");
  if (requeue) {
    const row = await requeueOutboxEvent(requeue);
    return NextResponse.json({ ok: true, requeued: Boolean(row), row });
  }

  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;
  const result = await drainOutbox(limit);
  return NextResponse.json({ ok: true, result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
