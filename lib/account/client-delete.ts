/**
 * Client side of account deletion. When the server cannot revoke Sign in with
 * Apple from a stored token, the iOS app re-authorizes with Apple and sends the
 * fresh authorization code. If re-authorization is unavailable or fails, the
 * deletion is stopped rather than bypassing Apple's revocation requirement.
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
    if (deps.canReauthorizeWithApple) {
      let code: string | null = null;
      try {
        code = await deps.reauthorizeWithApple();
      } catch (error) {
        if (deps.isCancellation(error)) {
          throw new Error("Appleでの確認がキャンセルされたため、アカウントは削除されていません。");
        }
      }
      if (!code) {
        throw new Error("Appleでの確認が完了しなかったため、アカウントは削除されていません。もう一度お試しください。");
      }
      response = await deps.send({ appleAuthorizationCode: code });
    } else {
      throw new Error("Appleとの連携を安全に解除するため、iOSアプリでAppleの確認を行ってからアカウントを削除してください。");
    }
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorMessage(response));
  }
  return { warning: typeof response.body.warning === "string" ? response.body.warning : null };
}
