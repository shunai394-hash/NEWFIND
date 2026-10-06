/**
 * Regression tests for native OAuth return handling, login error messages and
 * Apple account linking. No device or network needed.
 *
 * Run: npx tsx scripts/test-auth-flow.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAppUrlListener,
  createOAuthReturnHandler,
  isNativeOAuthCallbackUrl,
  rememberNativeOAuthNext,
  type KeyValueStorage,
  type OAuthReturnDeps,
} from "../lib/capacitor/oauth-return-core";
import {
  friendlyLoginError,
  isLoginCancellation,
  loginErrorFromParams,
} from "../lib/auth/login-errors";
import { lookupAuthUserByEmail, trustedAppleEmail } from "../lib/apple/session";

const ORIGIN = "https://newfind-self.vercel.app";
const CALLBACK = "app.newfind.social://auth/callback";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

type Harness = {
  deps: OAuthReturnDeps;
  navigations: string[];
  exchanges: string[];
  verifies: string[];
  closes: number;
};

function harness(overrides: Partial<OAuthReturnDeps> = {}, shared?: Partial<Harness["deps"]>): Harness {
  const h: Harness = {
    navigations: [],
    exchanges: [],
    verifies: [],
    closes: 0,
    deps: undefined as unknown as OAuthReturnDeps,
  };
  h.deps = {
    appOrigin: ORIGIN,
    sessionStore: memoryStorage(),
    persistentStore: memoryStorage(),
    closeBrowser: async () => {
      h.closes += 1;
    },
    exchangeCodeForSession: async (code) => {
      h.exchanges.push(code);
      return { error: null };
    },
    verifyMagicLink: async (tokenHash) => {
      h.verifies.push(tokenHash);
      return { error: null };
    },
    hasSession: async () => false,
    destinationAfterSession: async (next) => next,
    signupConsentPath: (next) => `/signup/consent?next=${encodeURIComponent(next)}`,
    navigate: (path) => void h.navigations.push(path),
    ...shared,
    ...overrides,
  };
  return h;
}

test("callback URL matching accepts only our scheme and our https origin", () => {
  const ok = (raw: string) => isNativeOAuthCallbackUrl(new URL(raw), ORIGIN);
  assert.equal(ok(`${CALLBACK}?code=abc`), true);
  assert.equal(ok("app.newfind.social://auth/callback/?code=abc"), true);
  assert.equal(ok(`${ORIGIN}/auth/callback?code=abc`), true);
  assert.equal(ok("https://evil.example/auth/callback?code=abc"), false);
  assert.equal(ok("other.app://auth/callback?code=abc"), false);
  assert.equal(ok("app.newfind.social://auth/callback-evil?code=abc"), false);
  assert.equal(ok("app.newfind.social://p/123"), false);
});

test("Google/PKCE: a code is exchanged once and lands on the stored destination", async () => {
  const h = harness();
  rememberNativeOAuthNext(h.deps.persistentStore, "/saved", Date.now());
  const handle = createOAuthReturnHandler(h.deps);
  assert.equal(await handle(`${CALLBACK}?code=code-1`), true);
  assert.deepEqual(h.exchanges, ["code-1"]);
  assert.deepEqual(h.navigations, ["/saved"]);
  assert.equal(h.closes, 1);
});

test("duplicate delivery (appUrlOpen + launch URL) does not exchange twice", async () => {
  const h = harness();
  const handle = createOAuthReturnHandler(h.deps);
  await Promise.all([handle(`${CALLBACK}?code=dup`), handle(`${CALLBACK}?code=dup`)]);
  await handle(`${CALLBACK}?code=dup`);
  assert.deepEqual(h.exchanges, ["dup"]);
  assert.equal(h.navigations.length, 1);
});

test("a WebView reload replaying the launch URL does not re-use the code", async () => {
  const sessionStore = memoryStorage();
  const first = harness({ sessionStore });
  await createOAuthReturnHandler(first.deps)(`${CALLBACK}?code=launch`);
  const afterReload = harness({ sessionStore });
  assert.equal(await createOAuthReturnHandler(afterReload.deps)(`${CALLBACK}?code=launch`), true);
  assert.deepEqual(afterReload.exchanges, []);
  assert.deepEqual(afterReload.navigations, []);
  // The raw code is never written to storage.
  assert.ok(![...sessionStore.data.values()].some((value) => value.includes("launch")));
});

test("cancel on the provider page returns to login without an error loop", async () => {
  const h = harness();
  await createOAuthReturnHandler(h.deps)(`${CALLBACK}?error=access_denied&error_description=user+cancelled`);
  assert.equal(h.exchanges.length, 0);
  assert.match(h.navigations[0], /^\/login\?error=cancelled/);
  assert.equal(loginErrorFromParams(new URL(`https://x${h.navigations[0]}`).searchParams), "");
});

test("an exchange failure without a session shows a login error", async () => {
  const h = harness({
    exchangeCodeForSession: async () => ({ error: { message: "invalid flow state, no valid flow state found" } }),
  });
  await createOAuthReturnHandler(h.deps)(`${CALLBACK}?code=stale`);
  assert.match(h.navigations[0], /^\/login\?error=oauth&detail=/);
  const shown = loginErrorFromParams(new URL(`https://x${h.navigations[0]}`).searchParams);
  assert.match(shown, /有効期限が切れました/);
});

test("an exchange failure while already signed in continues instead of erroring", async () => {
  const h = harness({
    exchangeCodeForSession: async () => ({ error: { message: "code already used" } }),
    hasSession: async () => true,
  });
  rememberNativeOAuthNext(h.deps.persistentStore, "/feed", Date.now());
  await createOAuthReturnHandler(h.deps)(`${CALLBACK}?code=used`);
  assert.deepEqual(h.navigations, ["/feed"]);
});

test("a thrown exchange error is persisted so the one-time code is not replayed after reload", async () => {
  const sessionStore = memoryStorage();
  let attempts = 0;
  const h = harness({
    sessionStore,
    exchangeCodeForSession: async () => {
      attempts += 1;
      throw new Error("Load failed");
    },
  });
  await createOAuthReturnHandler(h.deps)(`${CALLBACK}?code=boom`);
  assert.match(h.navigations[0], /^\/login\?error=oauth/);

  const afterReload = harness({ sessionStore });
  await createOAuthReturnHandler(afterReload.deps)(`${CALLBACK}?code=boom`);
  assert.equal(attempts, 1);
  assert.deepEqual(afterReload.exchanges, []);
  assert.deepEqual(afterReload.navigations, []);
});

test("a callback without a code shows an error", async () => {
  const h = harness();
  await createOAuthReturnHandler(h.deps)(CALLBACK);
  assert.match(h.navigations[0], /^\/login\?error=oauth/);
});

test("Apple web fallback: token_hash signs in; a new account goes to terms consent", async () => {
  const h = harness();
  await createOAuthReturnHandler(h.deps)(`${CALLBACK}?token_hash=th-1&type=magiclink&next=%2Fsaved&created=1`);
  assert.deepEqual(h.verifies, ["th-1"]);
  assert.deepEqual(h.navigations, ["/signup/consent?next=%2Fsaved"]);
});

test("unsafe or expired destinations fall back to /", async () => {
  const unsafe = harness();
  await createOAuthReturnHandler(unsafe.deps)(`${CALLBACK}?code=c1&next=%2F%2Fevil.example`);
  assert.deepEqual(unsafe.navigations, ["/"]);

  const expired = harness();
  rememberNativeOAuthNext(expired.deps.persistentStore, "/old", Date.now() - 60 * 60 * 1000);
  await createOAuthReturnHandler(expired.deps)(`${CALLBACK}?code=c2`);
  assert.deepEqual(expired.navigations, ["/"]);
});

test("non-callback deep links are ignored", async () => {
  const h = harness();
  const handle = createOAuthReturnHandler(h.deps);
  assert.equal(await handle("app.newfind.social://p/123"), false);
  assert.equal(await handle(undefined), false);
  assert.equal(await handle("not a url"), false);
  assert.equal(h.closes, 0);
  assert.equal(h.navigations.length, 0);
});

test("browser close failure does not block the sign-in", async () => {
  const h = harness({
    closeBrowser: async () => {
      throw new Error("no browser");
    },
  });
  await createOAuthReturnHandler(h.deps)(`${CALLBACK}?code=c3`);
  assert.deepEqual(h.exchanges, ["c3"]);
});

test("listener registers before reading the launch URL and only once", async () => {
  const order: string[] = [];
  const seen: Array<string | undefined> = [];
  let adds = 0;
  const listener = createAppUrlListener(
    {
      addUrlListener: async () => {
        adds += 1;
        order.push("add");
        return { remove: () => void order.push("remove") };
      },
      getLaunchUrl: async () => {
        order.push("launch");
        return `${CALLBACK}?code=cold`;
      },
    },
    (url) => seen.push(url),
  );
  await Promise.all([listener.start(), listener.start(), listener.start()]);
  await listener.start();
  assert.equal(adds, 1);
  assert.deepEqual(order, ["add", "launch"]);
  assert.deepEqual(seen, [`${CALLBACK}?code=cold`]);
  await listener.stop();
  assert.deepEqual(order, ["add", "launch", "remove"]);
});

test("a failed listener registration can be retried", async () => {
  let attempts = 0;
  const listener = createAppUrlListener(
    {
      addUrlListener: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("bridge not ready");
        return { remove: () => {} };
      },
      getLaunchUrl: async () => undefined,
    },
    () => {},
  );
  await assert.rejects(listener.start());
  await listener.start();
  assert.equal(attempts, 2);
});

test("login error messages", () => {
  assert.equal(isLoginCancellation("CANCELED", "anything"), true);
  assert.equal(
    friendlyLoginError(
      "apple",
      "The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)",
    ),
    null,
  );
  assert.equal(
    friendlyLoginError("apple", "操作を完了できませんでした。(com.apple.AuthenticationServices.AuthorizationError エラー1001)"),
    null,
  );
  assert.match(
    friendlyLoginError("apple", "(com.apple.AuthenticationServices.AuthorizationError error 1000.)") ?? "",
    /Apple アカウント/,
  );
  assert.match(friendlyLoginError("google", "TypeError: Load failed") ?? "", /インターネット接続/);
  assert.match(friendlyLoginError("google", "Unsupported provider: provider is not enabled") ?? "", /Google/);
  assert.match(friendlyLoginError("email", "Invalid login credentials") ?? "", /パスワード/);
  const unknown = friendlyLoginError("google", "weird internal 500 stack") ?? "";
  assert.match(unknown, /Googleでログインできませんでした/);
  assert.doesNotMatch(unknown, /stack/);
  assert.equal(loginErrorFromParams(new URLSearchParams("")), "");
  assert.match(
    loginErrorFromParams(new URLSearchParams("error=apple_not_configured")),
    /Appleでログインは現在ご利用いただけません/,
  );
});

test("Apple email linking only trusts the verified email claim", () => {
  assert.equal(
    trustedAppleEmail({ appleUserId: "apple-sub-123", email: "person@example.com", emailVerified: true }),
    "person@example.com",
  );
  assert.equal(
    trustedAppleEmail({ appleUserId: "apple-sub-123", email: "victim@example.com", emailVerified: false }),
    "apple.applesub123@privaterelay.appleid.com",
  );
  assert.equal(
    trustedAppleEmail({ appleUserId: "apple-sub-123", email: null, emailVerified: true }),
    "apple.applesub123@privaterelay.appleid.com",
  );
});

test("Apple linking only matches an exact email, never another search result", async () => {
  const originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ users: [{ id: "victim", email: "ba@example.com" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;
    assert.equal(await lookupAuthUserByEmail("a@example.com"), null);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ users: [{ id: "unverified", email: "a@example.com", email_confirmed_at: null }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;
    assert.equal(await lookupAuthUserByEmail("a@example.com"), null);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          users: [
            { id: "other", email: "xa@example.com", email_confirmed_at: "2025-01-01T00:00:00Z" },
            { id: "me", email: "A@Example.com", email_confirmed_at: "2025-01-01T00:00:00Z" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;
    assert.equal((await lookupAuthUserByEmail("a@example.com"))?.id, "me");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
