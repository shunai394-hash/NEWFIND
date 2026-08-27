import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import { deletePostWithMedia } from "@/lib/posts/delete";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser(request);
    const { id } = await params;
    const result = await deletePostWithMedia(id, auth.userId!, auth.admin);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, warning: result.warning ?? null });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
