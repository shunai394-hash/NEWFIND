import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import { TERMS_VERSION } from "@/lib/terms/consent";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: row, error: readError } = await admin
      .from("profiles")
      .select("terms_accepted_at, terms_version")
      .eq("id", auth.userId)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const version = (row as { terms_version?: string | null } | null)?.terms_version;
    if (version === "legacy") {
      return NextResponse.json({ ok: true, already: true, legacy: true });
    }

    const acceptedAt = new Date().toISOString();
    const { error } = await admin
      .from("profiles")
      .update({
        terms_accepted_at: acceptedAt,
        terms_version: TERMS_VERSION,
      })
      .eq("id", auth.userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      const supabase = await createClient();
      await supabase.auth.updateUser({
        data: {
          terms_accepted: true,
          terms_version: TERMS_VERSION,
        },
      });
    } catch {
      // Profile update is the source of truth.
    }

    return NextResponse.json({ ok: true, termsAcceptedAt: acceptedAt });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message || "同意の保存に失敗しました" }, { status });
  }
}
