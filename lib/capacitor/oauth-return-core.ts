import { safeNextPath } from "@/lib/config";

/**
 * Platform-independent core of the native OAuth return flow.
 * Capacitor, Supabase and navigation are injected so the flow can be tested
 * without a device (see scripts/test-oauth-return.ts).
 */

export const NATIVE_OAUTH_SCHEME = "app.newfind.social:";

const PROCESSED_KEY = "nf:oauth:processed";
const NEXT_KEY = "nf:oauth:next";
const NEXT_TTL_MS = 15 * 60 * 1000;
const PROCESSED_LIMIT = 20;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type OAuthReturnDeps = {
  /** Origin of the hosted web app inside the WebView (https universal links). */
  appOrigin: string;
  /** Survives a WebView reload (sessionStorage). */
  sessionStore: KeyValueStorage | null;
  /** Survives the trip through the external browser (localStorage). */
  persistentStore: KeyValueStorage | null;
  closeBrowser: () => Promise<void>;
  exchangeCodeForSession: (code: string) => Promise<{ error: { message: string } | null }>;
  verifyMagicLink: (tokenHash: string) => Promise<{ error: { message: string } | null }>;
  hasSession: () => Promise<boolean>;
  destinationAfterSession: (next: string) => Promise<string>;
  signupConsentPath: (next: string) => string;
  navigate: (path: string) => void;
  now?: () => number;
};

export type AppUrlListenerApi = {
  addUrlListener: (onUrl: (url: string | undefined) => void) => Promise<{ remove: () => Promise<void> | void }>;
  getLaunchUrl: () => Promise<string | undefined>;
};

function fingerprint(value: string): string {
  // FNV-1a: lets us remember which one-time codes were used without storing them.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${value.length}:${hash.toString(36)}`;
}

function safeRead(store: KeyValueStorage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeWrite(store: KeyValueStorage | null, key: string, value: string | null) {
  try {
    if (!store) return;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory guard still applies.
  }
}

export function isNativeOAuthCallbackUrl(url: URL, appOrigin: string): boolean {
  if (url.protocol === NATIVE_OAUTH_SCHEME) {
    const combined = `${url.hostname}${url.pathname}`.replace(/\/+/g, "/").replace(/\/$/, "");
    return combined === "auth/callback";
  }
  try {
    const origin = new URL(appOrigin);
    return (
      url.protocol === "https:" &&
      url.host === origin.host &&
      url.pathname.replace(/\/$/, "") === "/auth/callback"
    );
  } catch {
    return false;
  }
}

/** Remember where to land after OAuth, without putting it in the redirect URL. */
export function rememberNativeOAuthNext(
  store: KeyValueStorage | null,
  next: string,
  now: number = Date.now(),
) {
  safeWrite(store, NEXT_KEY, JSON.stringify({ next: safeNextPath(next), at: now }));
}

function takeNativeOAuthNext(store: KeyValueStorage | null, now: number): string | null {
  const raw = safeRead(store, NEXT_KEY);
  safeWrite(store, NEXT_KEY, null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { next?: unknown; at?: unknown };
    if (typeof parsed.next !== "string" || typeof parsed.at !== "number") return null;
    if (now - parsed.at > NEXT_TTL_MS) return null;
    return safeNextPath(parsed.next);
  } catch {
    return null;
  }
}

export function loginErrorPath(reason: string, detail?: string | null): string {
  const params = new URLSearchParams({ error: reason });
  if (detail) params.set("detail", detail.slice(0, 300));
  return `/login?${params.toString()}`;
}

export function createOAuthReturnHandler(deps: OAuthReturnDeps) {
  const now = deps.now ?? (() => Date.now());
  const memoryProcessed = new Set<string>();
  const inFlight = new Set<string>();

  function processedList(): string[] {
    const raw = safeRead(deps.sessionStore, PROCESSED_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  function wasProcessed(id: string) {
    return memoryProcessed.has(id) || processedList().includes(id);
  }

  function markProcessed(id: string) {
    memoryProcessed.add(id);
    const list = processedList().filter((item) => item !== id);
    list.push(id);
    safeWrite(deps.sessionStore, PROCESSED_KEY, JSON.stringify(list.slice(-PROCESSED_LIMIT)));
  }

  function resolveNext(url: URL): string {
    const stored = takeNativeOAuthNext(deps.persistentStore, now());
    const fromUrl = url.searchParams.get("next");
    return fromUrl ? safeNextPath(fromUrl) : stored ?? "/";
  }

  /**
   * Handle an OAuth return URL. Returns true when the URL was an OAuth callback
   * (handled, duplicate, or failed with a visible error), false otherwise.
   */
  return async function handleOAuthReturnUrl(rawUrl: string | undefined): Promise<boolean> {
    if (!rawUrl) return false;

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }
    if (!isNativeOAuthCallbackUrl(url, deps.appOrigin)) return false;

    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const credential = tokenHash ?? code;
    const id = credential ? fingerprint(`${tokenHash ? "t" : "c"}:${credential}`) : null;

    // The same callback can arrive twice (appUrlOpen + launch URL, or a
    // WebView reload replaying the launch URL). Only the first one counts.
    if (id && (inFlight.has(id) || wasProcessed(id))) return true;
    // Claim it before the first await so a concurrent delivery sees it in flight.
    if (id) inFlight.add(id);

    try {
      await deps.closeBrowser().catch(() => {});

      const oauthError = url.searchParams.get("error");
      if (oauthError) {
        takeNativeOAuthNext(deps.persistentStore, now());
        const reason = oauthError === "access_denied" ? "cancelled" : "oauth";
        deps.navigate(loginErrorPath(reason, url.searchParams.get("error_description")));
        return true;
      }

      if (!id || !credential) {
        deps.navigate(loginErrorPath("oauth", "missing_code"));
        return true;
      }

      const next = resolveNext(url);
      // Persist the one-time code claim before awaiting the network. If the
      // exchange throws after Apple/Supabase consumed the code, a WebView reload
      // must not submit that same credential a second time.
      markProcessed(id);
      const { error } = tokenHash
        ? await deps.verifyMagicLink(tokenHash)
        : await deps.exchangeCodeForSession(credential);

      if (error) {
        // A replayed or already-exchanged code fails, but the user may already
        // be signed in by the first delivery. Only report a real failure.
        if (await deps.hasSession().catch(() => false)) {
          deps.navigate(await deps.destinationAfterSession(next));
          return true;
        }
        deps.navigate(loginErrorPath(tokenHash ? "apple" : "oauth", error.message));
        return true;
      }

      if (tokenHash && url.searchParams.get("created") === "1") {
        deps.navigate(deps.signupConsentPath(next));
        return true;
      }
      deps.navigate(await deps.destinationAfterSession(next));
      return true;
    } catch (error) {
      deps.navigate(
        loginErrorPath("oauth", error instanceof Error ? error.message : "unexpected_error"),
      );
      return true;
    } finally {
      if (id) inFlight.delete(id);
    }
  };
}

/**
 * Register the deep-link listener before reading the launch URL, so a callback
 * that arrives while the launch URL is being read is never lost. Calling this
 * repeatedly returns the same registration.
 */
export function createAppUrlListener(api: AppUrlListenerApi, onUrl: (url: string | undefined) => void) {
  let started: Promise<void> | null = null;
  let handle: { remove: () => Promise<void> | void } | null = null;

  return {
    start(): Promise<void> {
      if (started) return started;
      started = (async () => {
        handle = await api.addUrlListener(onUrl);
        onUrl(await api.getLaunchUrl().catch(() => undefined));
      })().catch((error) => {
        started = null;
        throw error;
      });
      return started;
    },
    async stop() {
      const current = handle;
      handle = null;
      started = null;
      await current?.remove();
    },
  };
}
