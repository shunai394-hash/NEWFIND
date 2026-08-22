"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
    const profile = await store.ensureMyProfile(next);
    setMe(profile);
  }, []);

  useEffect(() => {
    let mounted = true;

    refresh()
      .catch(() => {
        // 初期化失敗でも ready は立てる。session は消さない。
      })
      .finally(() => {
        if (mounted) setReady(true);
      });

    if (storeMode() !== "supabase") {
      return () => {
        mounted = false;
      };
    }

    const supabase = createSupabaseClient();
    const {
      data: { subscription },
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
        });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

