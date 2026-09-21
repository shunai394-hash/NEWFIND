import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadInvestigationsForProfile,
  loadRecentInvestigations,
} from "@/lib/ai/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(
  rows: Awaited<ReturnType<typeof loadRecentInvestigations>>,
) {
  return rows.map((item) => ({
    id: item.id,
    status: item.status,
    title: item.title,
    summary: item.summary,
    beat: item.beat,
    city: item.city,
    correspondentTitle: item.correspondentTitle,
    nextAction: item.nextAction,
    updatedAt: item.updatedAt,
    sourceUrl: item.sourceUrl,
  }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const recent = url.searchParams.get("recent") === "1";
  const profileId = url.searchParams.get("profileId")?.trim() || "";
  const username = url.searchParams.get("username")?.trim().replace(/^@/, "") || "";

  if (recent && !profileId && !username) {
    const rows = await loadRecentInvestigations(12);
    return NextResponse.json({ investigations: serialize(rows) });
  }

  let resolvedProfileId = profileId;
  if (!resolvedProfileId && username) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      resolvedProfileId = (data?.id as string | undefined) ?? "";
    } catch {
      resolvedProfileId = "";
    }
  }

  if (!resolvedProfileId) {
    return NextResponse.json({ investigations: [] });
  }

  const rows = await loadInvestigationsForProfile(resolvedProfileId, 8);
  return NextResponse.json({ investigations: serialize(rows) });
}
