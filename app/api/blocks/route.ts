import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import { blockUser, listBlockedIds, unblockUser } from "@/lib/moderation/blocks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const ids = await listBlockedIds(auth.userId);
    return NextResponse.json({ ids });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      blocked?: boolean;
    };
    if (!body.userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const result =
      body.blocked === false
        ? await unblockUser(auth.userId, body.userId)
        : await blockUser(auth.userId, body.userId);
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
