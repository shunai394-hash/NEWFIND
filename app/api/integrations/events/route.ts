import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import { emitUserEngagement } from "@/lib/integration/emit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Record a real product view (authenticated). Never invents views.
 * Idempotent per user+product+day via event_id.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      productId?: string;
      query?: string;
      eventType?: "viewed" | "searched";
    };

    const eventType = body.eventType === "searched" ? "searched" : "viewed";

    if (eventType === "searched") {
      const query = body.query?.trim();
      if (!query) {
        return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });
      }
      const day = new Date().toISOString().slice(0, 10);
      const result = await emitUserEngagement({
        eventType: "searched",
        query,
        userId: auth.userId,
        eventId: `nf:searched:${auth.userId}:${day}:${query.slice(0, 80)}`,
      });
      return NextResponse.json({ ok: true, result });
    }

    const productId = body.productId?.trim();
    if (!productId) {
      return NextResponse.json({ ok: false, error: "productId required" }, { status: 400 });
    }

    // Confirm product exists before queueing a view
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("discovery_products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();
    if (error || !data?.id) {
      return NextResponse.json({ ok: false, error: "product not found" }, { status: 404 });
    }

    const day = new Date().toISOString().slice(0, 10);
    const result = await emitUserEngagement({
      eventType: "viewed",
      productId,
      userId: auth.userId,
      eventId: `nf:viewed:${auth.userId}:${productId}:${day}`,
      causationId: productId,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
