import { NextResponse } from "next/server";
import { AccountDeletionError, deleteOwnedAccount } from "@/lib/account/delete-user";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";

export const dynamic = "force-dynamic";

type DeleteBody = {
  appleAuthorizationCode?: unknown;
};

export async function DELETE(request: Request) {
  let auth;
  try {
    auth = await requireUser(request);
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
  if (!auth.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The account to delete always comes from the verified session, never the body.
  const body = ((await request.json().catch(() => null)) ?? {}) as DeleteBody;
  const appleAuthorizationCode =
    typeof body.appleAuthorizationCode === "string" && body.appleAuthorizationCode.length <= 2048
      ? body.appleAuthorizationCode
      : null;

  try {
    const result = await deleteOwnedAccount(auth.userId, {
      appleAuthorizationCode,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[account] delete failed", error instanceof Error ? error.name : "error");
    return NextResponse.json(
      { error: "アカウントを削除できませんでした。時間をおいてもう一度お試しください。", code: "delete_failed" },
      { status: 500 },
    );
  }
}
