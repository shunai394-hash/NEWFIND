import { NextResponse } from "next/server";
import {
  AccountDeletionError,
  type DeleteAccountResult,
  type SelfDeleteOptions,
} from "@/lib/account/delete-account-core";

/**
 * HTTP handlers for account deletion.
 * - Self-delete reads exactly one value from the body: a Sign in with Apple
 *   re-authorization code, which the server verifies with Apple itself. No
 *   policy flag (such as skipping Apple revocation) is ever taken from the client.
 * - Admin delete is a separate entry point gated by requireAdmin.
 */

type AuthLike = { userId: string | null };

function authFailure(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : 401;
  const code = status === 403 ? 403 : 401;
  return NextResponse.json({ error: code === 403 ? "forbidden" : "unauthorized" }, { status: code });
}

function deletionFailure(error: unknown) {
  if (error instanceof AccountDeletionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[account] delete failed", error instanceof Error ? error.name : "error");
  return NextResponse.json(
    {
      error: "アカウントを削除できませんでした。時間をおいてもう一度お試しください。",
      code: "delete_failed",
    },
    { status: 500 },
  );
}

export function createSelfDeleteHandler(deps: {
  requireUser: (request: Request) => Promise<AuthLike>;
  deleteOwnAccount: (userId: string, options: SelfDeleteOptions) => Promise<DeleteAccountResult>;
}) {
  return async function handle(request: Request) {
    let auth: AuthLike;
    try {
      auth = await deps.requireUser(request);
    } catch (error) {
      return authFailure(error);
    }
    if (!auth.userId) return authFailure(null);

    const body = (await request.json().catch(() => null)) as { appleAuthorizationCode?: unknown } | null;
    const code = body?.appleAuthorizationCode;
    const appleAuthorizationCode =
      typeof code === "string" && code.length > 0 && code.length <= 2048 ? code : null;

    try {
      // The account always comes from the verified session, never the body.
      return NextResponse.json(await deps.deleteOwnAccount(auth.userId, { appleAuthorizationCode }));
    } catch (error) {
      return deletionFailure(error);
    }
  };
}

export function createAdminDeleteHandler(deps: {
  requireAdmin: (request: Request) => Promise<AuthLike>;
  deleteAccountAsAdmin: (userId: string) => Promise<DeleteAccountResult>;
}) {
  return async function handle(request: Request, targetUserId: string) {
    let auth: AuthLike;
    try {
      auth = await deps.requireAdmin(request);
    } catch (error) {
      return authFailure(error);
    }
    if (!auth.userId) return authFailure(null);
    if (targetUserId === auth.userId) {
      return NextResponse.json({ error: "cannot delete self" }, { status: 400 });
    }
    try {
      const result = await deps.deleteAccountAsAdmin(targetUserId);
      return NextResponse.json({
        ok: true,
        appleRevocation: result.appleRevocation,
        warning: result.warning ?? null,
      });
    } catch (error) {
      return deletionFailure(error);
    }
  };
}
