import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import { listNotifications, markNotificationRead } from "@/lib/discovery/alerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const notifications = await listNotifications(auth.userId);
    return NextResponse.json({ notifications });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const notification = await markNotificationRead(auth.userId, body.id);
    if (!notification) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ notification });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
