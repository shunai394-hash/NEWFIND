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

    void startNativeOAuthReturnListener().then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      stop = cleanup;
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return null;
}
