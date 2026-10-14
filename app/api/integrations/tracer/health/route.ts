import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only health probe. Exposes only readiness, never schema details or credentials.
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("tracer_promotions")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, service: "newfind-tracer-inbound", promotionLedgerReady: false },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, service: "newfind-tracer-inbound", promotionLedgerReady: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "newfind-tracer-inbound", promotionLedgerReady: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
