"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AndroidImeSupport } from "@/components/android-ime";
import { OAuthReturnListener } from "@/components/oauth-return-listener";
import { authHeaders } from "@/lib/auth/client-headers";
import {
  clearLocalBlocks,
  setLocalBlocks,
} from "@/lib/moderation/client";
import { getStore, storeMode } from "@/lib/store";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Profile, Session } from "@/lib/types";

type AppContextValue = {
  ready: boolean;
  sessionResolved: boolean;
  session: Session | null;
  me: Profile | null;
  blockedIds: string[];
  mode: "local" | "supabase";
  refresh: () => Promise<Session | null>;
  requireAuth: () => boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready] = useState(true);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const authGen = useRef(0);
  const resolvedRef = useRef(false);

  const syncServerBlocks = useCallback(async () => {
    if (storeMode() !== "supabase") return;

    try {
      const response = await fetch("/api/blocks", {
        method: "GET",
        cache: "no-store",
        headers: await authHeaders(),
      });

      if (!response.ok) {
        console.warn("[blocks] sync failed:", response.status);
        return;
      }

      const data = (await response.json()) as { ids?: unknown };

      if (Array.isArray(data.ids)) {
        const ids = data.ids.filter(
          (id): id is string => typeof id === "string",
        );
        setLocalBlocks(ids);
        setBlockedIds(ids);
      }
    } catch (err) {
      console.error("[blocks] sync failed", err);
    }
  }, []);

  const markResolved = useCallback(() => {
    resolvedRef.current = true;
    setSessionResolved(true);
  }, []);

  const applySignedOut = useCallback(
    (gen: number) => {
      if (gen !== authGen.current) return;
      setSession(null);
      setMe(null);
      clearLocalBlocks();
      setBlockedIds([]);
      markResolved();
    },
    [markResolved],
  );

  const applySignedIn = useCallback(
    async (next: Session, gen: number) => {
      setSession(next);
      try {
        const profile = await getStore().ensureMyProfile(next);
        if (gen !== authGen.current) return next;
        await syncServerBlocks();
        if (gen !== authGen.current) return next;
        setMe(profile);
      } catch (err) {
        console.error("[auth] ensureMyProfile", err);
      } finally {
        if (gen === authGen.current) markResolved();
      }
      return next;
    },
    [markResolved, syncServerBlocks],
  );

  const refresh = useCallback(async () => {
    const gen = ++authGen.current;
    const store = getStore();
    const next = await store.getSession();

    if (!next) {
      applySignedOut(gen);
      return null;
    }

    return applySignedIn(next, gen);
  }, [applySignedIn, applySignedOut]);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    if (storeMode() !== "supabase") {
      void refresh().catch((err) => {
        console.error("[auth] boot refresh failed", err);
        if (mounted) setSessionResolved(true);
      });
      return () => {
        mounted = false;
      };
    }

    try {
      const supabase = createSupabaseClient();
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((event, authSession) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          const gen = ++authGen.current;
          applySignedOut(gen);
          return;
        }

        if (event === "INITIAL_SESSION" && !authSession?.user) {
          const gen = ++authGen.current;
          applySignedOut(gen);
          return;
        }

        if (!authSession?.user) return;

        const next: Session = {
          userId: authSession.user.id,
          email: authSession.user.email ?? "",
        };

        if (event === "TOKEN_REFRESHED") {
          setSession(next);
          markResolved();
          return;
        }

        const gen = ++authGen.current;
        void applySignedIn(next, gen);
      });

      subscription = sub;
    } catch (err) {
      console.error("[auth] onAuthStateChange setup failed", err);
      void refresh().catch(() => {
        if (mounted) markResolved();
      });
    }

    const timeout = window.setTimeout(() => {
      if (!mounted || resolvedRef.current) return;
      void refresh().catch(() => {
        if (mounted) markResolved();
      });
    }, 2500);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, [applySignedIn, applySignedOut, markResolved, refresh]);

  const requireAuth = useCallback(() => Boolean(session), [session]);

  const value = useMemo(
    () => ({
      ready,
      sessionResolved,
      session,
      me,
      blockedIds,
      mode: storeMode(),
      refresh,
      requireAuth,
    }),
    [ready, sessionResolved, session, me, blockedIds, refresh, requireAuth],
  );

  return (
    <AppContext.Provider value={value}>
      <OAuthReturnListener />
      <AndroidImeSupport />
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within AppProvider");
  }
  return ctx;
}

export function useRedirectIfGuest(nextPath: string) {
  const router = useRouter();
  const { ready, sessionResolved, session, refresh } = useApp();

  useEffect(() => {
    if (!ready || !sessionResolved || session) return;
    let cancelled = false;
    void refresh().then((next) => {
      if (cancelled || next) return;
      const safe =
        nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : "/";
      router.replace(`/login?next=${encodeURIComponent(safe)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, sessionResolved, session, refresh, router, nextPath]);
}
