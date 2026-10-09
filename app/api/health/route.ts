import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public liveness probe. Deliberately does not expose environment or secret status. */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "newfind" },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
