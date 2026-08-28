import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import { REPORT_REASONS, submitReport, type ReportReasonId } from "@/lib/moderation/reports";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      reason?: ReportReasonId;
      postId?: string;
      targetUserId?: string;
      detail?: string;
    };
    const allowed = REPORT_REASONS.some((item) => item.id === body.reason);
    if (!allowed || !body.reason) {
      return NextResponse.json({ error: "reason required" }, { status: 400 });
    }
    const result = await submitReport({
      reporterId: auth.userId,
      reason: body.reason,
      postId: body.postId ?? null,
      targetUserId: body.targetUserId ?? null,
      detail: body.detail,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
