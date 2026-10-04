import type { AppleRevokeResult } from "@/lib/apple/revoke";

/**
 * Account deletion, in an order that never reports success for work that did
 * not happen:
 *   1. Revoke the Sign in with Apple authorization (Guideline 5.1.1(v), TN3194).
 *      A transient Apple failure stops here: nothing has been deleted yet.
 *   2. Remove the user's media from storage (failures become a warning).
 *   3. Delete the auth user; profiles, tokens and other rows cascade.
 * When no usable Apple token exists, the native app re-authorizes first;
 * otherwise the account is still deleted (as Apple requires) and the user is
 * told to remove NEWFIND under Settings → Sign in with Apple.
 */

export type AppleRevocationStatus = "not_linked" | "revoked" | "manual_required";

export type DeleteAccountOptions = {
  /** Fresh authorization code from a native Sign in with Apple re-authorization. */
  appleAuthorizationCode?: string | null;
  /** Delete even when Apple cannot be revoked automatically (web, admin, re-auth impossible). */
  allowWithoutAppleRevocation?: boolean;
};

export type DeleteAccountResult = {
  ok: true;
  appleRevocation: AppleRevocationStatus;
  alreadyDeleted?: boolean;
  warning?: string;
};

export type DeleteAccountErrorCode =
  | "apple_reauth_required"
  | "apple_reauth_failed"
  | "apple_identity_mismatch"
  | "apple_revocation_unavailable"
  | "delete_failed";

export class AccountDeletionError extends Error {
  readonly code: DeleteAccountErrorCode;
  readonly status: number;
  constructor(code: DeleteAccountErrorCode, status: number, message: string) {
    super(message);
    this.name = "AccountDeletionError";
    this.code = code;
    this.status = status;
  }
}

export type AppleTokenGrant = { appleUserId: string; clientId: string; refreshToken: string };

export type DeleteAccountDeps = {
  linkedAppleUserIds: (userId: string) => Promise<string[]>;
  loadAppleTokens: (userId: string) => Promise<AppleTokenGrant[]>;
  /** Exchange a re-authorization code server-to-server; the identity is verified by Apple's response. */
  exchangeAppleCode: (code: string) => Promise<{
    appleUserId: string;
    clientId: string;
    refreshToken: string | null;
    accessToken: string | null;
  }>;
  revokeAppleToken: (input: {
    clientId: string;
    token: string;
    tokenTypeHint: "refresh_token" | "access_token";
  }) => Promise<AppleRevokeResult>;
  collectMediaPaths: (userId: string) => Promise<string[]>;
  removeMedia: (paths: string[]) => Promise<void>;
  /** Resolves "not_found" when the auth user is already gone. */
  deleteAuthUser: (userId: string) => Promise<"deleted" | "not_found">;
};

export const MANUAL_APPLE_REVOCATION_MESSAGE =
  "Appleとの連携は自動で解除できませんでした。iPhoneの「設定」→ 自分の名前 →「サインインとセキュリティ」→「Appleでサインイン」から NEWFIND を選び、「Appleでサインインの使用を停止」を選んでください。";

async function revokeAppleAuthorization(
  userId: string,
  options: DeleteAccountOptions,
  deps: DeleteAccountDeps,
): Promise<AppleRevocationStatus> {
  const appleIds = await deps.linkedAppleUserIds(userId);
  if (appleIds.length === 0) return "not_linked";

  let revoked = false;
  let transient = false;

  const stored = (await deps.loadAppleTokens(userId)).filter((token) =>
    appleIds.includes(token.appleUserId),
  );
  for (const token of stored) {
    const result = await deps.revokeAppleToken({
      clientId: token.clientId,
      token: token.refreshToken,
      tokenTypeHint: "refresh_token",
    });
    if (result.ok) revoked = true;
    else if (result.kind === "transient") transient = true;
  }

  if (!revoked && options.appleAuthorizationCode) {
    let grant: Awaited<ReturnType<DeleteAccountDeps["exchangeAppleCode"]>>;
    try {
      grant = await deps.exchangeAppleCode(options.appleAuthorizationCode);
    } catch {
      throw new AccountDeletionError(
        "apple_reauth_failed",
        400,
        "Appleでの確認に失敗しました。もう一度お試しください。",
      );
    }
    // The code must belong to this account's Apple ID, not someone else's.
    if (!appleIds.includes(grant.appleUserId)) {
      throw new AccountDeletionError(
        "apple_identity_mismatch",
        403,
        "このアカウントに連携しているApple IDで確認してください。",
      );
    }
    const token = grant.refreshToken ?? grant.accessToken;
    if (token) {
      const result = await deps.revokeAppleToken({
        clientId: grant.clientId,
        token,
        tokenTypeHint: grant.refreshToken ? "refresh_token" : "access_token",
      });
      if (result.ok) revoked = true;
      else if (result.kind === "transient") transient = true;
    }
  }

  if (revoked) return "revoked";
  if (transient) {
    throw new AccountDeletionError(
      "apple_revocation_unavailable",
      503,
      "Appleとの連携解除に一時的に失敗したため、アカウントはまだ削除されていません。時間をおいてもう一度お試しください。",
    );
  }
  if (!options.allowWithoutAppleRevocation && !options.appleAuthorizationCode) {
    throw new AccountDeletionError(
      "apple_reauth_required",
      409,
      "アカウントを削除する前に、Appleでの確認が必要です。",
    );
  }
  return "manual_required";
}

export async function deleteAccount(
  userId: string,
  options: DeleteAccountOptions,
  deps: DeleteAccountDeps,
): Promise<DeleteAccountResult> {
  const id = userId.trim();
  if (!id) throw new AccountDeletionError("delete_failed", 400, "invalid user");

  const appleRevocation = await revokeAppleAuthorization(id, options, deps);

  const warnings: string[] = [];
  try {
    await deps.removeMedia(await deps.collectMediaPaths(id));
  } catch {
    warnings.push("アカウントは削除しましたが、一部の画像ファイルを削除できませんでした。");
  }

  let outcome: "deleted" | "not_found";
  try {
    outcome = await deps.deleteAuthUser(id);
  } catch {
    throw new AccountDeletionError(
      "delete_failed",
      500,
      "アカウントを削除できませんでした。時間をおいてもう一度お試しください。",
    );
  }

  if (appleRevocation === "manual_required") warnings.push(MANUAL_APPLE_REVOCATION_MESSAGE);

  return {
    ok: true,
    appleRevocation,
    ...(outcome === "not_found" ? { alreadyDeleted: true } : {}),
    ...(warnings.length > 0 ? { warning: warnings.join("\n") } : {}),
  };
}
