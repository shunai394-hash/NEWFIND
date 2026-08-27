import { NextResponse } from "next/server";
import { deleteOwnedAccount } from "@/lib/account/delete-user";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const result = await deleteOwnedAccount(auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json(
      { error: message || "アカウントの削除に失敗しました" },
      { status },
    );
  }
}
