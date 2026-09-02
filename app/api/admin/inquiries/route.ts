import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth/request-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("inquiries")
      .select(
        "id, email, category, subject, message, status, created_at, resolved_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    return NextResponse.json({ inquiries: data ?? [] });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
