import { APPLE_REVOKE_URL } from "@/lib/apple/config";

/**
 * Sign in with Apple token revocation (POST https://appleid.apple.com/auth/revoke).
 * Apple returns 200 when the token is revoked *or was already invalid*.
 */

export type AppleRevokeResult =
  | { ok: true }
  | {
      ok: false;
      /** transient: retry later. invalid_token: nothing left to revoke. config: our client setup is wrong. */
      kind: "transient" | "invalid_token" | "config";
      code: string;
    };

export type AppleRevokeDeps = {
  fetch: typeof fetch;
  createClientSecret: (clientId: string) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
};

const RETRY_DELAYS_MS = [300, 900];
const REQUEST_TIMEOUT_MS = 8_000;

export async function revokeAppleToken(
  input: { clientId: string; token: string; tokenTypeHint: "refresh_token" | "access_token" },
  deps: AppleRevokeDeps,
): Promise<AppleRevokeResult> {
  let last: AppleRevokeResult = { ok: false, kind: "transient", code: "not_attempted" };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await deps.sleep(RETRY_DELAYS_MS[attempt - 1]);

    let clientSecret: string;
    try {
      clientSecret = await deps.createClientSecret(input.clientId);
    } catch {
      return { ok: false, kind: "config", code: "client_secret_unavailable" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let status: number;
    let errorCode = "";
    try {
      const response = await deps.fetch(APPLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: input.clientId,
          client_secret: clientSecret,
          token: input.token,
          token_type_hint: input.tokenTypeHint,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      status = response.status;
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: unknown };
        errorCode = typeof body.error === "string" ? body.error : `http_${status}`;
      }
    } catch {
      last = { ok: false, kind: "transient", code: "network" };
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (status >= 200 && status < 300) return { ok: true };
    if (errorCode === "invalid_grant") return { ok: false, kind: "invalid_token", code: errorCode };
    if (status === 429 || status >= 500) {
      last = { ok: false, kind: "transient", code: errorCode };
      continue;
    }
    // invalid_client, unauthorized_client, invalid_request …: retrying will not help.
    return { ok: false, kind: "config", code: errorCode };
  }

  return last;
}
