/**
 * Regression tests for account deletion with Sign in with Apple revocation
 * (Guideline 5.1.1(v)) and for the cron / integration secret checks.
 *
 * Run: npx tsx --test scripts/test-account-security.ts
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  AccountDeletionError,
  deleteAccount,
  MANUAL_APPLE_REVOCATION_MESSAGE,
  type DeleteAccountDeps,
} from "../lib/account/delete-account-core";
import { requestAccountDeletion, type DeleteResponse } from "../lib/account/client-delete";
import { revokeAppleToken, type AppleRevokeDeps } from "../lib/apple/revoke";
import { decryptAppleToken, encryptAppleToken } from "../lib/apple/token-store";
import { createAiActHandler } from "../lib/ai/ai-act-handler";
import { constantTimeEqual, hasBearerSecret } from "../lib/auth/cron-auth";

// ---------------------------------------------------------------- deletion

type Calls = string[];

function deletionDeps(overrides: Partial<DeleteAccountDeps> = {}, calls: Calls = []): DeleteAccountDeps {
  return {
    linkedAppleUserIds: async () => ["apple-sub-1"],
    loadAppleTokens: async () => [
      { appleUserId: "apple-sub-1", clientId: "app.newfind.social", refreshToken: "rt-stored" },
    ],
    exchangeAppleCode: async () => {
      calls.push("exchange");
      return { appleUserId: "apple-sub-1", clientId: "app.newfind.social", refreshToken: "rt-fresh", accessToken: "at" };
    },
    revokeAppleToken: async (input) => {
      calls.push(`revoke:${input.token}:${input.tokenTypeHint}`);
      return { ok: true };
    },
    collectMediaPaths: async () => {
      calls.push("collect");
      return ["a.jpg"];
    },
    removeMedia: async () => void calls.push("media"),
    deleteAuthUser: async () => {
      calls.push("deleteUser");
      return "deleted";
    },
    ...overrides,
  };
}

async function expectDeletionError(promise: Promise<unknown>, code: string, status: number) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AccountDeletionError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test("account without Apple: deleted, no Apple call", async () => {
  const calls: Calls = [];
  const result = await deleteAccount("u1", {}, deletionDeps({ linkedAppleUserIds: async () => [] }, calls));
  assert.deepEqual(result, { ok: true, appleRevocation: "not_linked" });
  assert.deepEqual(calls, ["collect", "media", "deleteUser"]);
});

test("stored Apple token is revoked before anything is deleted", async () => {
  const calls: Calls = [];
  const result = await deleteAccount("u1", {}, deletionDeps({}, calls));
  assert.equal(result.appleRevocation, "revoked");
  assert.equal(result.warning, undefined);
  assert.deepEqual(calls, ["revoke:rt-stored:refresh_token", "collect", "media", "deleteUser"]);
});

test("Apple outage: nothing is deleted and the user is told to retry", async () => {
  const calls: Calls = [];
  const deps = deletionDeps(
    { revokeAppleToken: async () => ({ ok: false, kind: "transient", code: "network" }) },
    calls,
  );
  await expectDeletionError(deleteAccount("u1", {}, deps), "apple_revocation_unavailable", 503);
  assert.ok(!calls.includes("deleteUser"));
  assert.ok(!calls.includes("media"));
});

test("no stored token: native re-authorization is required first", async () => {
  const calls: Calls = [];
  const deps = deletionDeps({ loadAppleTokens: async () => [] }, calls);
  await expectDeletionError(deleteAccount("u1", {}, deps), "apple_reauth_required", 409);
  assert.deepEqual(calls, []);
});

test("re-authorization code: exchanged server-side, revoked, then deleted", async () => {
  const calls: Calls = [];
  const deps = deletionDeps({ loadAppleTokens: async () => [] }, calls);
  const result = await deleteAccount("u1", { appleAuthorizationCode: "code-1" }, deps);
  assert.equal(result.appleRevocation, "revoked");
  assert.deepEqual(calls, ["exchange", "revoke:rt-fresh:refresh_token", "collect", "media", "deleteUser"]);
});

test("re-authorization with someone else's Apple ID is refused", async () => {
  const calls: Calls = [];
  const deps = deletionDeps(
    {
      loadAppleTokens: async () => [],
      exchangeAppleCode: async () => ({
        appleUserId: "attacker-sub",
        clientId: "app.newfind.social",
        refreshToken: "rt-x",
        accessToken: null,
      }),
    },
    calls,
  );
  await expectDeletionError(deleteAccount("u1", { appleAuthorizationCode: "c" }, deps), "apple_identity_mismatch", 403);
  assert.deepEqual(calls, []);
});

test("an invalid re-authorization code reports an error and deletes nothing", async () => {
  const calls: Calls = [];
  const deps = deletionDeps(
    {
      loadAppleTokens: async () => [],
      exchangeAppleCode: async () => {
        throw new Error("invalid_grant");
      },
    },
    calls,
  );
  await expectDeletionError(deleteAccount("u1", { appleAuthorizationCode: "bad" }, deps), "apple_reauth_failed", 400);
  assert.deepEqual(calls, []);
});

test("stored token already invalid: re-authorization is still required", async () => {
  const deps = deletionDeps({
    revokeAppleToken: async () => ({ ok: false, kind: "invalid_token", code: "invalid_grant" }),
  });
  await expectDeletionError(deleteAccount("u1", {}, deps), "apple_reauth_required", 409);
});

test("when revocation is impossible, the account is still deleted with manual instructions (TN3194)", async () => {
  const calls: Calls = [];
  const deps = deletionDeps(
    { revokeAppleToken: async () => ({ ok: false, kind: "config", code: "invalid_client" }) },
    calls,
  );
  const result = await deleteAccount("u1", { allowWithoutAppleRevocation: true }, deps);
  assert.equal(result.appleRevocation, "manual_required");
  assert.match(result.warning ?? "", /Appleでサインイン/);
  assert.equal(result.warning, MANUAL_APPLE_REVOCATION_MESSAGE);
  assert.ok(calls.includes("deleteUser"));
});

test("already deleted user: reported as success, not as an error", async () => {
  const deps = deletionDeps({ linkedAppleUserIds: async () => [], deleteAuthUser: async () => "not_found" });
  const result = await deleteAccount("u1", {}, deps);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyDeleted, true);
});

test("double execution: both requests end in a consistent success", async () => {
  let deleted = false;
  const deps = deletionDeps({
    deleteAuthUser: async () => {
      if (deleted) return "not_found";
      deleted = true;
      return "deleted";
    },
  });
  const [a, b] = await Promise.all([deleteAccount("u1", {}, deps), deleteAccount("u1", {}, deps)]);
  assert.equal(a.ok && b.ok, true);
  assert.equal([a, b].filter((r) => r.alreadyDeleted).length, 1);
});

test("auth delete failure is never reported as success", async () => {
  const deps = deletionDeps({
    deleteAuthUser: async () => {
      throw new Error("db down");
    },
  });
  await expectDeletionError(deleteAccount("u1", {}, deps), "delete_failed", 500);
});

test("media cleanup failure still deletes the account, with a warning", async () => {
  const deps = deletionDeps({
    removeMedia: async () => {
      throw new Error("storage down");
    },
  });
  const result = await deleteAccount("u1", {}, deps);
  assert.match(result.warning ?? "", /画像ファイル/);
});

// ---------------------------------------------------------------- Apple revoke

function revokeDeps(responses: Array<Response | Error>, seen: RequestInit[] = []): AppleRevokeDeps {
  return {
    fetch: (async (_url: string, init: RequestInit) => {
      seen.push(init);
      const next = responses.shift();
      if (!next) throw new Error("no response");
      if (next instanceof Error) throw next;
      return next;
    }) as unknown as typeof fetch,
    createClientSecret: async (clientId) => `secret-for-${clientId}`,
    sleep: async () => {},
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("revoke posts the documented form fields", async () => {
  const seen: RequestInit[] = [];
  const result = await revokeAppleToken(
    { clientId: "app.newfind.social", token: "rt", tokenTypeHint: "refresh_token" },
    revokeDeps([new Response(null, { status: 200 })], seen),
  );
  assert.deepEqual(result, { ok: true });
  const body = new URLSearchParams(String(seen[0].body));
  assert.equal(body.get("client_id"), "app.newfind.social");
  assert.equal(body.get("client_secret"), "secret-for-app.newfind.social");
  assert.equal(body.get("token"), "rt");
  assert.equal(body.get("token_type_hint"), "refresh_token");
  assert.equal((seen[0].headers as Record<string, string>)["Content-Type"], "application/x-www-form-urlencoded");
});

test("revoke retries transient failures", async () => {
  const result = await revokeAppleToken(
    { clientId: "c", token: "t", tokenTypeHint: "refresh_token" },
    revokeDeps([json(503, {}), new Error("ECONNRESET"), new Response(null, { status: 200 })]),
  );
  assert.deepEqual(result, { ok: true });
});

test("revoke gives up after repeated network failures", async () => {
  const result = await revokeAppleToken(
    { clientId: "c", token: "t", tokenTypeHint: "refresh_token" },
    revokeDeps([new Error("offline"), new Error("offline"), new Error("offline")]),
  );
  assert.deepEqual(result, { ok: false, kind: "transient", code: "network" });
});

test("revoke classifies invalid_grant and invalid_client without retrying", async () => {
  const seen: RequestInit[] = [];
  assert.deepEqual(
    await revokeAppleToken({ clientId: "c", token: "t", tokenTypeHint: "refresh_token" }, revokeDeps([json(400, { error: "invalid_grant" })], seen)),
    { ok: false, kind: "invalid_token", code: "invalid_grant" },
  );
  assert.deepEqual(
    await revokeAppleToken({ clientId: "c", token: "t", tokenTypeHint: "refresh_token" }, revokeDeps([json(400, { error: "invalid_client" })], seen)),
    { ok: false, kind: "config", code: "invalid_client" },
  );
  assert.equal(seen.length, 2);
});

test("missing Apple signing key is a config error", async () => {
  const deps = revokeDeps([]);
  deps.createClientSecret = async () => {
    throw new Error("no key");
  };
  assert.deepEqual(
    await revokeAppleToken({ clientId: "c", token: "t", tokenTypeHint: "refresh_token" }, deps),
    { ok: false, kind: "config", code: "client_secret_unavailable" },
  );
});

// ---------------------------------------------------------------- token storage

test("refresh tokens are encrypted at rest and tamper-evident", () => {
  const key = randomBytes(32);
  const sealed = encryptAppleToken("r.secret-refresh-token", key);
  assert.ok(!sealed.includes("secret-refresh-token"));
  assert.notEqual(encryptAppleToken("r.secret-refresh-token", key), sealed);
  assert.equal(decryptAppleToken(sealed, key), "r.secret-refresh-token");
  const parts = sealed.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptAppleToken(parts.join("."), key));
  assert.throws(() => decryptAppleToken(sealed, randomBytes(32)));
  assert.throws(() => encryptAppleToken("x", null));
});

// ---------------------------------------------------------------- client flow

function client(responses: DeleteResponse[], opts: { ios: boolean; reauth?: () => Promise<string> }) {
  const sent: Array<Record<string, unknown>> = [];
  const deps = {
    send: async (body: Record<string, unknown>) => {
      sent.push(body);
      const next = responses.shift();
      if (!next) throw new Error("unexpected request");
      return next;
    },
    canReauthorizeWithApple: opts.ios,
    reauthorizeWithApple: opts.reauth ?? (async () => "fresh-code"),
    isCancellation: (error: unknown) => (error as { code?: string })?.code === "CANCELED",
  };
  return { sent, run: () => requestAccountDeletion(deps) };
}

const REAUTH = { status: 409, body: { code: "apple_reauth_required", error: "x" } };
const OK = { status: 200, body: { ok: true } };

test("client: iOS re-authorizes with Apple and sends the code", async () => {
  const c = client([REAUTH, OK], { ios: true });
  assert.deepEqual(await c.run(), { warning: null });
  assert.deepEqual(c.sent, [{}, { appleAuthorizationCode: "fresh-code" }]);
});

test("client: cancelling Apple re-authorization deletes nothing", async () => {
  const c = client([REAUTH], {
    ios: true,
    reauth: async () => {
      throw Object.assign(new Error("canceled"), { code: "CANCELED" });
    },
  });
  await assert.rejects(c.run(), /削除されていません/);
  assert.equal(c.sent.length, 1);
});

test("client: web deletes and shows manual Apple instructions", async () => {
  const c = client([REAUTH, { status: 200, body: { ok: true, warning: MANUAL_APPLE_REVOCATION_MESSAGE } }], { ios: false });
  assert.deepEqual(await c.run(), { warning: MANUAL_APPLE_REVOCATION_MESSAGE });
  assert.deepEqual(c.sent[1], { allowWithoutAppleRevocation: true });
});

test("client: a failed re-authorization falls back to deletion with instructions", async () => {
  const c = client([REAUTH, { status: 400, body: { code: "apple_reauth_failed" } }, OK], { ios: true });
  await c.run();
  assert.deepEqual(c.sent[2], { allowWithoutAppleRevocation: true });
});

test("client: server errors surface and are not reported as success", async () => {
  const c = client([{ status: 503, body: { code: "apple_revocation_unavailable", error: "まだ削除されていません" } }], { ios: true });
  await assert.rejects(c.run(), /まだ削除されていません/);
});

// ---------------------------------------------------------------- cron secret

const SECRET = "cron-secret-value-0123456789";

function aiAct(secret: string | undefined) {
  const executed: unknown[] = [];
  const handle = createAiActHandler({
    cronSecret: () => secret,
    execute: (async (input: unknown) => {
      executed.push(input);
      return { ok: true, skipped: false, status: 200, body: { ok: true, actedCount: 0 } };
    }) as never,
  });
  return { handle, executed };
}

const req = (headers: Record<string, string> = {}, query = "") =>
  new Request(`https://newfind.example/api/ai-act${query}`, { headers });

test("ai-act: unauthenticated and wrong-secret requests get one fixed 401 body", async () => {
  const { handle, executed } = aiAct(SECRET);
  const bodies = new Set<string>();
  for (const headers of [{}, { authorization: "Bearer wrong" }, { authorization: SECRET }, { authorization: `Bearer ${SECRET}x` }]) {
    const res = await handle(req(headers));
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const text = await res.text();
    bodies.add(text);
    assert.deepEqual(JSON.parse(text), { ok: false, error: "Unauthorized" });
    assert.doesNotMatch(text, /diagnostic|hash|length|secret/i);
  }
  assert.equal(bodies.size, 1);
  assert.equal(executed.length, 0);
});

test("ai-act: an unset CRON_SECRET never authorizes", async () => {
  for (const secret of [undefined, "", "   "]) {
    const { handle, executed } = aiAct(secret);
    for (const authorization of ["Bearer ", "Bearer undefined", "Bearer"]) {
      assert.equal((await handle(req({ authorization }))).status, 401);
    }
    assert.equal(executed.length, 0);
  }
});

test("ai-act: the cron secret runs the engine with a bounded limit", async () => {
  const { handle, executed } = aiAct(SECRET);
  const res = await handle(req({ authorization: `Bearer ${SECRET}` }, "?mode=product_hunter&limit=9999"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, actedCount: 0 });
  assert.deepEqual(executed, [{ mode: "product_hunter", triggeredBy: "cron", limit: 50 }]);
});

test("shared-secret checks: constant-time and multi-secret", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false);
  const r = (authorization: string) => new Request("https://x", { headers: { authorization } });
  assert.equal(hasBearerSecret(r("Bearer two"), ["one", "two"]), true);
  assert.equal(hasBearerSecret(r("bearer two"), ["one", "two"]), true);
  assert.equal(hasBearerSecret(r("Bearer three"), ["one", "two"]), false);
  assert.equal(hasBearerSecret(r("Bearer "), ["", undefined]), false);
});
