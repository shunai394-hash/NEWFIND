import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth/request-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("content_reports")
      .select(`
        id,
        reporter_id,
        target_user_id,
        post_id,
        reason,
        detail,
        created_at,
        reporter:profiles!content_reports_reporter_id_fkey(username, display_name),
        target_user:profiles!content_reports_target_user_id_fkey(username, display_name)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    return NextResponse.json({ reports: data ?? [] });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
