import { NextResponse } from "next/server";
import { deleteOwnedAccount } from "@/lib/account/delete-user";
import { authErrorResponse, requireAdmin } from "@/lib/auth/request-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin(request);
    const { id } = await params;
    if (id === auth.userId) {
      return NextResponse.json({ error: "cannot modify self this way" }, { status: 400 });
    }
    const body = (await request.json()) as { is_suspended?: boolean };
    if (typeof body.is_suspended !== "boolean") {
      return NextResponse.json({ error: "is_suspended required" }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ is_suspended: body.is_suspended })
      .eq("id", id)
      .select("id, username, is_suspended")
      .maybeSingle();
    if (error) {
      if (/is_suspended|42703|schema cache/i.test(error.message)) {
        return NextResponse.json(
          { error: "Apply supabase/migrations/008_moderation.sql to enable suspend." },
          { status: 400 },
        );
      }
      throw new Error(error.message);
    }
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ user: data });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin(request);
    const { id } = await params;
    if (id === auth.userId) {
      return NextResponse.json({ error: "cannot delete self" }, { status: 400 });
    }
    const result = await deleteOwnedAccount(id);
    return NextResponse.json({ ok: true, warning: result.warning ?? null });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
