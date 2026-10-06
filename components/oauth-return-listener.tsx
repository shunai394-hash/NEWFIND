"use client";

import { useEffect } from "react";
import { startNativeOAuthReturnListener } from "@/lib/capacitor/oauth-return";

/**
 * Capacitor iOS / Android: listen for OAuth deep-link returns (Google / Apple).
 * No UI; mounts once under AppProvider.
 */
export function OAuthReturnListener() {
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    let retryTimer: number | undefined;
    let retries = 0;

    const start = () => {
      void startNativeOAuthReturnListener()
        .then((cleanup) => {
          if (cancelled) {
            cleanup();
            return;
          }
          stop = cleanup;
        })
        .catch((error: unknown) => {
          console.error("[oauth-return] listener setup failed", error);
          if (cancelled || retries >= 3) return;

          const delay = 1000 * 2 ** retries;
          retries += 1;
          retryTimer = window.setTimeout(start, delay);
        });
    };

    start();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      stop?.();
    };
  }, []);

  return null;
}
