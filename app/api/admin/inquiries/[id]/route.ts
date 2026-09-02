import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth/request-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await context.params;
    const body = await request.json();

    const status = body?.status;

    if (status !== "open" && status !== "resolved") {
      return NextResponse.json(
        { error: "不正なステータスです。" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("inquiries")
      .update({
        status,
        resolved_at:
          status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select(
        "id, email, category, subject, message, status, created_at, resolved_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ inquiry: data });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
