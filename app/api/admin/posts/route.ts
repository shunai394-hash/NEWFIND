import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth/request-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("posts")
      .select("id, author_id, media_type, media_url, thumbnail_url, caption, category, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const authorIds = [...new Set((data ?? []).map((row) => row.author_id))];
    const profiles = authorIds.length
      ? await admin.from("profiles").select("id, username, display_name").in("id", authorIds)
      : { data: [], error: null };
    if (profiles.error) throw new Error(profiles.error.message);
    const byId = new Map((profiles.data ?? []).map((row) => [row.id, row]));
    return NextResponse.json({
      posts: (data ?? []).map((row) => ({
        ...row,
        author: byId.get(row.author_id) ?? null,
      })),
    });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
