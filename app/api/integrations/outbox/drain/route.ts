import { NextResponse } from "next/server";
import { drainOutbox, requeueOutboxEvent } from "@/lib/integration";
import { getIntegrationConfig } from "@/lib/integration/config";
import { isAuthorizedCronOrIntegrationRequest } from "@/lib/auth/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  const { sharedSecret } = getIntegrationConfig();
  if (!isAuthorizedCronOrIntegrationRequest(request, sharedSecret)) {
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
