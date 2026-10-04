import type { AppleRevokeResult } from "@/lib/apple/revoke";

/**
 * Account deletion, in an order that never reports success for work that did
 * not happen:
 *   1. Revoke the Sign in with Apple authorization (Guideline 5.1.1(v), TN3194).
 *      A transient Apple failure stops here: nothing has been deleted yet.
 *   2. Remove the user's media from storage (failures become a warning).
 *   3. Delete the auth user; profiles, tokens and other rows cascade.
 *
 * Whether deletion may proceed without an automatic revocation is decided
 * only from conditions the server verified itself, never from the request:
 *   - self-delete: only when the server cannot revoke because of its own
 *     configuration (no Apple signing key, client rejected by Apple). The
 *     result then reports `manual_required`, never `revoked`.
 *   - admin delete (separate, admin-authorized entry point): the admin cannot
 *     re-authorize as the user, so it revokes what it can and reports the rest.
 * Otherwise a self-delete without a usable token requires re-authorization.
 */

export type AppleRevocationStatus = "not_linked" | "revoked" | "manual_required";

export type SelfDeleteOptions = {
  /** Fresh authorization code from a native Sign in with Apple re-authorization. */
  appleAuthorizationCode?: string | null;
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

/** Why an authorization code could not be exchanged with Apple. */
export class AppleCodeExchangeError extends Error {
  readonly kind: "invalid_code" | "transient" | "config";
  constructor(kind: "invalid_code" | "transient" | "config") {
    super(`apple code exchange failed: ${kind}`);
    this.name = "AppleCodeExchangeError";
    this.kind = kind;
  }
}

export type AppleTokenGrant = { appleUserId: string; clientId: string; refreshToken: string };

export type DeleteAccountDeps = {
  linkedAppleUserIds: (userId: string) => Promise<string[]>;
  loadAppleTokens: (userId: string) => Promise<AppleTokenGrant[]>;
  /**
   * Exchange a re-authorization code server-to-server; the Apple identity is
   * taken from Apple's verified response. Throws AppleCodeExchangeError.
   */
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

type Mode = { adminOverride: boolean; appleAuthorizationCode: string | null };

async function revokeAppleAuthorization(
  userId: string,
  mode: Mode,
  deps: DeleteAccountDeps,
): Promise<AppleRevocationStatus> {
  const appleIds = await deps.linkedAppleUserIds(userId);
  if (appleIds.length === 0) return "not_linked";

  let revoked = false;
  let transient = false;
  // Set only by server-side facts: our Apple client cannot revoke at all.
  let serverCannotRevoke = false;

  const recordFailure = (result: Exclude<AppleRevokeResult, { ok: true }>) => {
    if (result.kind === "transient") transient = true;
    // Apple requires account deletion to be fulfilled when no usable token is available.
    if (result.kind === "config" || result.kind === "invalid_token") serverCannotRevoke = true;
  };

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
    else recordFailure(result);
  }

  // TN3194: lack of a usable token/code must not prevent account deletion.
  if (stored.length === 0 && !mode.appleAuthorizationCode) serverCannotRevoke = true;

  if (!revoked && mode.appleAuthorizationCode) {
    let grant: Awaited<ReturnType<DeleteAccountDeps["exchangeAppleCode"]>> | null = null;
    try {
      grant = await deps.exchangeAppleCode(mode.appleAuthorizationCode);
    } catch (error) {
      const kind = error instanceof AppleCodeExchangeError ? error.kind : "invalid_code";
      if (kind === "transient") transient = true;
      else {
        // An unusable authorization code does not block deletion. Do not claim
        // revocation; return manual instructions as required by Apple's TN3194.
        serverCannotRevoke = true;
      }
    }
    if (grant) {
      // The code must belong to this account's Apple ID, not someone else's.
      if (!appleIds.includes(grant.appleUserId)) {
        // Never revoke using another Apple ID's token. The authenticated user
        // may still delete their own account, with manual revocation instructions.
        serverCannotRevoke = true;
      } else {
        const token = grant.refreshToken ?? grant.accessToken;
        if (token) {
          const result = await deps.revokeAppleToken({
            clientId: grant.clientId,
            token,
            tokenTypeHint: grant.refreshToken ? "refresh_token" : "access_token",
          });
          if (result.ok) revoked = true;
          else if (result.kind === "transient") transient = true;
          else serverCannotRevoke = true;
        } else {
          serverCannotRevoke = true;
        }
      }
    }
  }

  // One successful token must not hide a transient failure revoking another
  // token/client. Do not delete until every attempted revocation has a stable result.
  if (transient) {
    throw new AccountDeletionError(
      "apple_revocation_unavailable",
      503,
      "Appleとの連携解除に一時的に失敗したため、アカウントはまだ削除されていません。時間をおいてもう一度お試しください。",
    );
  }
  // If any token could not be revoked because of our own client configuration,
  // do not report the whole Apple authorization as revoked, even if another
  // token was revoked successfully.
  if (serverCannotRevoke) return "manual_required";
  if (revoked) return "revoked";
  if (mode.adminOverride) return "manual_required";
  // No token, an unusable token, or an unavailable re-authorization code:
  // fulfil deletion and never represent the authorization as revoked.
  return "manual_required";
}

async function performDeletion(
  userId: string,
  mode: Mode,
  deps: DeleteAccountDeps,
): Promise<DeleteAccountResult> {
  const id = userId.trim();
  if (!id) throw new AccountDeletionError("delete_failed", 400, "invalid user");

  const appleRevocation = await revokeAppleAuthorization(id, mode, deps);

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

/** A signed-in user deleting their own account. Takes no client-controlled policy flags. */
export function deleteOwnAccount(
  userId: string,
  options: SelfDeleteOptions,
  deps: DeleteAccountDeps,
): Promise<DeleteAccountResult> {
  return performDeletion(
    userId,
    { adminOverride: false, appleAuthorizationCode: options.appleAuthorizationCode ?? null },
    deps,
  );
}

/** Admin-only deletion of another account. Callers must have verified admin rights. */
export function deleteAccountAsAdmin(
  userId: string,
  deps: DeleteAccountDeps,
): Promise<DeleteAccountResult> {
  return performDeletion(userId, { adminOverride: true, appleAuthorizationCode: null }, deps);
}
