"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AndroidImeSupport } from "@/components/android-ime";
import { OAuthReturnListener } from "@/components/oauth-return-listener";
import { getStore, storeMode } from "@/lib/store";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Profile, Session } from "@/lib/types";

type AppContextValue = {
  ready: boolean;
  sessionResolved: boolean;
  session: Session | null;
  me: Profile | null;
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

  const refresh = useCallback(async () => {
    const store = getStore();
    const next = await store.getSession();

    if (!next) {
      setSession(null);
      setMe(null);
      setSessionResolved(true);
      return null;
    }

    setSession(next);
    try {
      const profile = await store.ensureMyProfile(next);
      setMe(profile);
    } catch (err) {
      console.error("[auth] ensureMyProfile", err);
    } finally {
      setSessionResolved(true);
    }
    return next;
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    queueMicrotask(() => {
      void refresh().catch((err) => {
        console.error("[auth] boot refresh failed", err);
        if (mounted) setSessionResolved(true);
      });
    });

    if (storeMode() === "supabase") {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { subscription: sub },
        } = supabase.auth.onAuthStateChange((event, authSession) => {
          if (!mounted) return;
          if (event === "INITIAL_SESSION") return;

          if (event === "SIGNED_OUT") {
            setSession(null);
            setMe(null);
            setSessionResolved(true);
            return;
          }

          if (!authSession?.user) return;

          const next: Session = {
            userId: authSession.user.id,
            email: authSession.user.email ?? "",
          };
          setSession(next);
          setSessionResolved(true);
          void getStore()
            .ensureMyProfile(next)
            .then((profile) => {
              if (mounted) setMe(profile);
            })
            .catch((err) => {
              console.error("[auth] onAuthStateChange ensureMyProfile", err);
            });
        });
        subscription = sub;
      } catch (err) {
        console.error("[auth] onAuthStateChange setup failed", err);
      }
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [refresh]);

  const requireAuth = useCallback(() => Boolean(session), [session]);

  const value = useMemo(
    () => ({
      ready,
      sessionResolved,
      session,
      me,
      mode: storeMode(),
      refresh,
      requireAuth,
    }),
    [ready, sessionResolved, session, me, refresh, requireAuth],
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
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
