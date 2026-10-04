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
  AppleCodeExchangeError,
  deleteAccountAsAdmin,
  deleteOwnAccount,
  MANUAL_APPLE_REVOCATION_MESSAGE,
  type DeleteAccountDeps,
} from "../lib/account/delete-account-core";
import { createAdminDeleteHandler, createSelfDeleteHandler } from "../lib/account/delete-handlers";
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

const noStoredToken = { loadAppleTokens: async () => [] };

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
  const result = await deleteOwnAccount("u1", {}, deletionDeps({ linkedAppleUserIds: async () => [] }, calls));
  assert.deepEqual(result, { ok: true, appleRevocation: "not_linked" });
  assert.deepEqual(calls, ["collect", "media", "deleteUser"]);
});

test("stored Apple token is revoked before anything is deleted", async () => {
  const calls: Calls = [];
  const result = await deleteOwnAccount("u1", {}, deletionDeps({}, calls));
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
  await expectDeletionError(deleteOwnAccount("u1", {}, deps), "apple_revocation_unavailable", 503);
  assert.ok(!calls.includes("deleteUser"));
  assert.ok(!calls.includes("media"));
});

test("one successful Apple revocation does not hide another token's transient failure", async () => {
  const calls: Calls = [];
  const deps = deletionDeps({
    linkedAppleUserIds: async () => ["apple-sub-1", "apple-sub-2"],
    loadAppleTokens: async () => [
      { appleUserId: "apple-sub-1", clientId: "app.newfind.social", refreshToken: "rt-one" },
      { appleUserId: "apple-sub-2", clientId: "com.newfind.web", refreshToken: "rt-two" },
    ],
    revokeAppleToken: async ({ token }) => {
      calls.push(`revoke:${token}`);
      return token === "rt-one"
        ? { ok: true }
        : { ok: false, kind: "transient", code: "network" };
    },
  }, calls);
  await expectDeletionError(deleteOwnAccount("u1", {}, deps), "apple_revocation_unavailable", 503);
  assert.deepEqual(calls, ["revoke:rt-one", "revoke:rt-two"]);
  assert.ok(!calls.includes("deleteUser"));
});

test("partial Apple revocation caused by server config is never reported as fully revoked", async () => {
  const deps = deletionDeps({
    linkedAppleUserIds: async () => ["apple-sub-1", "apple-sub-2"],
    loadAppleTokens: async () => [
      { appleUserId: "apple-sub-1", clientId: "app.newfind.social", refreshToken: "rt-one" },
      { appleUserId: "apple-sub-2", clientId: "com.newfind.web", refreshToken: "rt-two" },
    ],
    revokeAppleToken: async ({ token }) => token === "rt-one"
      ? { ok: true }
      : { ok: false, kind: "config", code: "invalid_client" },
  });
  const result = await deleteOwnAccount("u1", {}, deps);
  assert.equal(result.appleRevocation, "manual_required");
  assert.match(result.warning ?? "", /Appleでサインイン/);
});

test("no stored token: deletion is fulfilled with explicit manual-revocation warning", async () => {
  const calls: Calls = [];
  const result = await deleteOwnAccount("u1", {}, deletionDeps(noStoredToken, calls));
  assert.equal(result.ok, true);
  assert.equal(result.appleRevocation, "manual_required");
  assert.match(result.warning ?? "", /Appleでサインイン/);
  assert.deepEqual(calls, ["collect", "media", "deleteUser"]);
});

test("stored token Apple cannot revoke: deletion succeeds with manual warning, never reports revoked", async () => {
  const deps = deletionDeps({
    revokeAppleToken: async () => ({ ok: false, kind: "invalid_token", code: "invalid_grant" }),
  });
  const result = await deleteOwnAccount("u1", {}, deps);
  assert.equal(result.ok, true);
  assert.equal(result.appleRevocation, "manual_required");
  assert.match(result.warning ?? "", /Appleでサインイン/);
});

test("re-authorization code: exchanged server-side, revoked, then deleted", async () => {
  const calls: Calls = [];
  const result = await deleteOwnAccount("u1", { appleAuthorizationCode: "code-1" }, deletionDeps(noStoredToken, calls));
  assert.equal(result.appleRevocation, "revoked");
  assert.deepEqual(calls, ["exchange", "revoke:rt-fresh:refresh_token", "collect", "media", "deleteUser"]);
});

test("a re-authorization code for another Apple ID is never revoked; deletion gives manual instructions", async () => {
  const calls: Calls = [];
  const deps = deletionDeps(
    {
      ...noStoredToken,
      exchangeAppleCode: async () => {
        calls.push("exchange");
        return {
          appleUserId: "attacker-sub",
          clientId: "app.newfind.social",
          refreshToken: "rt-x",
          accessToken: null,
        };
      },
    },
    calls,
  );
  const result = await deleteOwnAccount("u1", { appleAuthorizationCode: "c" }, deps);
  assert.equal(result.appleRevocation, "manual_required");
  assert.match(result.warning ?? "", /Appleでサインイン/);
  assert.deepEqual(calls, ["collect", "media", "deleteUser"]);
});

test("an invalid re-authorization code does not block deletion and is never reported as revoked", async () => {
  const calls: Calls = [];
  const deps = deletionDeps(
    {
      ...noStoredToken,
      exchangeAppleCode: async () => {
        calls.push("exchange");
        throw new AppleCodeExchangeError("invalid_code");
      },
    },
    calls,
  );
  const result = await deleteOwnAccount("u1", { appleAuthorizationCode: "bad" }, deps);
  assert.equal(result.appleRevocation, "manual_required");
  assert.match(result.warning ?? "", /Appleでサインイン/);
  assert.deepEqual(calls, ["exchange", "collect", "media", "deleteUser"]);
});

test("Apple outage during re-authorization deletes nothing", async () => {
  const deps = deletionDeps({
    ...noStoredToken,
    exchangeAppleCode: async () => {
      throw new AppleCodeExchangeError("transient");
    },
  });
  await expectDeletionError(deleteOwnAccount("u1", { appleAuthorizationCode: "c" }, deps), "apple_revocation_unavailable", 503);
});

test("server cannot revoke (its own Apple config): deleted, reported as manual — never as revoked", async () => {
  for (const deps of [
    deletionDeps({ revokeAppleToken: async () => ({ ok: false, kind: "config", code: "invalid_client" }) }),
    deletionDeps({
      ...noStoredToken,
      exchangeAppleCode: async () => {
        throw new AppleCodeExchangeError("config");
      },
    }),
  ]) {
    const result = await deleteOwnAccount("u1", { appleAuthorizationCode: "c" }, deps);
    assert.equal(result.appleRevocation, "manual_required");
    assert.equal(result.warning, MANUAL_APPLE_REVOCATION_MESSAGE);
  }
});

test("admin deletion revokes what it can, then deletes with manual instructions", async () => {
  const calls: Calls = [];
  const result = await deleteAccountAsAdmin("u1", deletionDeps(noStoredToken, calls));
  assert.equal(result.appleRevocation, "manual_required");
  assert.match(result.warning ?? "", /Appleでサインイン/);
  assert.deepEqual(calls, ["collect", "media", "deleteUser"]);
  const revokedCalls: Calls = [];
  assert.equal((await deleteAccountAsAdmin("u2", deletionDeps({}, revokedCalls))).appleRevocation, "revoked");
  assert.equal(revokedCalls[0], "revoke:rt-stored:refresh_token");
});

test("already deleted user: reported as success, not as an error", async () => {
  const deps = deletionDeps({ linkedAppleUserIds: async () => [], deleteAuthUser: async () => "not_found" });
  const result = await deleteOwnAccount("u1", {}, deps);
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
  const [a, b] = await Promise.all([deleteOwnAccount("u1", {}, deps), deleteOwnAccount("u1", {}, deps)]);
  assert.equal(a.ok && b.ok, true);
  assert.equal([a, b].filter((r) => r.alreadyDeleted).length, 1);
});

test("auth delete failure is never reported as success", async () => {
  const deps = deletionDeps({
    deleteAuthUser: async () => {
      throw new Error("db down");
    },
  });
  await expectDeletionError(deleteOwnAccount("u1", {}, deps), "delete_failed", 500);
});

test("media cleanup failure still deletes the account, with a warning", async () => {
  const deps = deletionDeps({
    removeMedia: async () => {
      throw new Error("storage down");
    },
  });
  const result = await deleteOwnAccount("u1", {}, deps);
  assert.match(result.warning ?? "", /画像ファイル/);
});

// ---------------------------------------------------------------- deletion HTTP handlers

const deleteRequest = (body?: unknown) =>
  new Request("https://newfind.example/api/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function selfHandler(deps: DeleteAccountDeps, auth: () => Promise<{ userId: string | null }>) {
  const received: unknown[] = [];
  const handle = createSelfDeleteHandler({
    requireUser: auth,
    deleteOwnAccount: (userId, options) => {
      received.push({ userId, options });
      return deleteOwnAccount(userId, options, deps);
    },
  });
  return { handle, received };
}

const signedIn = async () => ({ userId: "u1" });

test("self-delete: client flags never claim Apple was revoked or select another user", async () => {
  for (const body of [
    { allowWithoutAppleRevocation: true },
    { allowWithoutAppleRevocation: "true", adminOverride: true, userId: "victim" },
    { allowWithoutAppleRevocation: false },
    {},
    undefined,
  ]) {
    const calls: Calls = [];
    const { handle, received } = selfHandler(deletionDeps(noStoredToken, calls), signedIn);
    const res = await handle(deleteRequest(body));
    assert.equal(res.status, 200, JSON.stringify(body));
    const result = (await res.json()) as { appleRevocation: string; warning?: string };
    assert.equal(result.appleRevocation, "manual_required");
    assert.match(result.warning ?? "", /Appleでサインイン/);
    assert.deepEqual(received, [{ userId: "u1", options: { appleAuthorizationCode: null } }]);
    assert.deepEqual(calls, ["collect", "media", "deleteUser"]);
  }
});

test("self-delete: only a verified re-authorization code is taken from the body", async () => {
  const calls: Calls = [];
  const { handle, received } = selfHandler(deletionDeps(noStoredToken, calls), signedIn);
  const res = await handle(deleteRequest({ appleAuthorizationCode: "code-1", allowWithoutAppleRevocation: true }));
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { appleRevocation: string }).appleRevocation, "revoked");
  assert.deepEqual(received, [{ userId: "u1", options: { appleAuthorizationCode: "code-1" } }]);
});

test("self-delete: unauthenticated requests delete nothing", async () => {
  const { handle, received } = selfHandler(deletionDeps(), async () => {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  });
  assert.equal((await handle(deleteRequest({}))).status, 401);
  const anonymous = selfHandler(deletionDeps(), async () => ({ userId: null }));
  assert.equal((await anonymous.handle(deleteRequest({}))).status, 401);
  assert.equal(received.length + anonymous.received.length, 0);
});

function adminHandler(auth: () => Promise<{ userId: string | null }>) {
  const deleted: string[] = [];
  const handle = createAdminDeleteHandler({
    requireAdmin: auth,
    deleteAccountAsAdmin: async (userId) => {
      deleted.push(userId);
      return { ok: true, appleRevocation: "manual_required", warning: MANUAL_APPLE_REVOCATION_MESSAGE };
    },
  });
  return { handle, deleted };
}

test("admin delete: non-admins and anonymous callers are refused", async () => {
  const forbidden = adminHandler(async () => {
    throw Object.assign(new Error("forbidden"), { status: 403 });
  });
  assert.equal((await forbidden.handle(deleteRequest(), "victim")).status, 403);
  const anonymous = adminHandler(async () => {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  });
  assert.equal((await anonymous.handle(deleteRequest(), "victim")).status, 401);
  assert.equal(forbidden.deleted.length + anonymous.deleted.length, 0);
});

test("admin delete: an admin deletes another user, not themselves", async () => {
  const admin = adminHandler(async () => ({ userId: "admin-1" }));
  const res = await admin.handle(deleteRequest(), "user-9");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, appleRevocation: "manual_required", warning: MANUAL_APPLE_REVOCATION_MESSAGE });
  assert.equal((await admin.handle(deleteRequest(), "admin-1")).status, 400);
  assert.deepEqual(admin.deleted, ["user-9"]);
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

test("client: the web never sends a revocation bypass; it asks the user to re-sign in", async () => {
  const c = client([REAUTH], { ios: false });
  await assert.rejects(c.run(), /iOSアプリでAppleの確認/);
  assert.deepEqual(c.sent, [{}]);
});

test("client: a failed Apple re-authorization deletes nothing and sends no bypass", async () => {
  const c = client([REAUTH], {
    ios: true,
    reauth: async () => {
      throw new Error("AuthorizationError error 1000");
    },
  });
  await assert.rejects(c.run(), /削除されていません/);
  assert.deepEqual(c.sent, [{}]);
});

test("client: no request body ever carries allowWithoutAppleRevocation", async () => {
  const c = client([REAUTH, { status: 400, body: { code: "apple_reauth_failed", error: "失敗" } }], { ios: true });
  await assert.rejects(c.run(), /失敗/);
  assert.ok(c.sent.every((body) => !("allowWithoutAppleRevocation" in body)));
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
