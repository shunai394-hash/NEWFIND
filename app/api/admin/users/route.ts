import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth/request-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, account_type, is_admin, is_suspended, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (/is_suspended|is_admin|42703|schema cache/i.test(error.message)) {
        const fallback = await admin
          .from("profiles")
          .select("id, username, display_name, avatar_url, account_type, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (fallback.error) throw new Error(fallback.error.message);
        return NextResponse.json({
          users: (fallback.data ?? []).map((row) => ({
            ...row,
            is_admin: false,
            is_suspended: false,
          })),
        });
      }
      throw new Error(error.message);
    }
    return NextResponse.json({ users: data ?? [] });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
