import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import { listUserAlerts, setAlertEnabled } from "@/lib/discovery/alerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const alerts = await listUserAlerts(auth.userId);
    return NextResponse.json({ alerts });
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
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      isEnabled?: boolean;
    };
    if (!body.id || typeof body.isEnabled !== "boolean") {
      return NextResponse.json({ error: "id and isEnabled required" }, { status: 400 });
    }
    const alert = await setAlertEnabled(auth.userId, body.id, body.isEnabled);
    if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ alert });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
