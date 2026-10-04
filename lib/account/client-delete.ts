/**
 * Client side of account deletion. When the server has no usable Sign in with
 * Apple token, the iOS app re-authorizes with Apple and sends the fresh
 * authorization code, which the server verifies with Apple. The client never
 * sends a flag that changes the server's revocation policy.
 */

export type DeleteResponse = { status: number; body: Record<string, unknown> };

export type ClientDeleteDeps = {
  send: (body: Record<string, unknown>) => Promise<DeleteResponse>;
  canReauthorizeWithApple: boolean;
  /** Returns a fresh authorization code; throws with code "CANCELED" when the person cancels. */
  reauthorizeWithApple: () => Promise<string>;
  isCancellation: (error: unknown) => boolean;
};

function errorMessage(response: DeleteResponse) {
  return typeof response.body.error === "string"
    ? response.body.error
    : "アカウントを削除できませんでした。時間をおいてもう一度お試しください。";
}

export async function requestAccountDeletion(deps: ClientDeleteDeps): Promise<{ warning: string | null }> {
  let response = await deps.send({});

  if (response.status === 409 && response.body.code === "apple_reauth_required") {
    if (!deps.canReauthorizeWithApple) {
      // The web cannot run native re-authorization. Signing in with Apple again
      // stores a fresh token on the server, after which deletion can revoke it.
      throw new Error(
        "Appleとの連携を安全に解除するため、iOSアプリでAppleの確認を行ってからアカウントを削除してください（Webの場合は、いったんログアウトして「Appleでサインイン」で再度ログインしてから削除できます）。アカウントは削除されていません。",
      );
    }
    let code: string;
    try {
      code = await deps.reauthorizeWithApple();
    } catch (error) {
      throw new Error(
        deps.isCancellation(error)
          ? "Appleでの確認がキャンセルされたため、アカウントは削除されていません。"
          : "Appleでの確認に失敗したため、アカウントは削除されていません。もう一度お試しください。",
      );
    }
    response = await deps.send({ appleAuthorizationCode: code });
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorMessage(response));
  }
  return { warning: typeof response.body.warning === "string" ? response.body.warning : null };
}
