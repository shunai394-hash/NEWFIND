"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { OAuthReturnListener } from "@/components/oauth-return-listener";
import { getStore, storeMode } from "@/lib/store";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Profile, Session } from "@/lib/types";

type AppContextValue = {
  ready: boolean;
  session: Session | null;
  me: Profile | null;
  mode: "local" | "supabase";
  refresh: () => Promise<void>;
  requireAuth: () => boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Profile | null>(null);

  const refresh = useCallback(async () => {
    const store = getStore();
    const next = await store.getSession();

    if (!next) {
      setSession(null);
      setMe(null);
      return;
    }

    setSession(next);
    try {
      const profile = await store.ensureMyProfile(next);
      setMe(profile);
    } catch (err) {
      console.error("[auth] ensureMyProfile", err);
      console.error("[Supabase] ensureMyProfile failed", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    // Never block the shell on auth — Capacitor WebView can hang on getSession.
    setReady(true);

    void refresh().catch((err) => {
      console.error("[auth] boot refresh failed", err);
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
            return;
          }

          if (!authSession?.user) return;

          const next: Session = {
            userId: authSession.user.id,
            email: authSession.user.email ?? "",
          };
          setSession(next);
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
      session,
      me,
      mode: storeMode(),
      refresh,
      requireAuth,
    }),
    [ready, session, me, refresh, requireAuth],
  );

  return (
    <AppContext.Provider value={value}>
      <OAuthReturnListener />
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

