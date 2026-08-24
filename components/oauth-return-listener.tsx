"use client";

import { useEffect } from "react";
import { startAndroidOAuthReturnListener } from "@/lib/capacitor/oauth-return";

/**
 * Android Capacitor only: listen for OAuth deep-link returns (Google / Apple).
 * No UI; mounts once under AppProvider.
 */
export function OAuthReturnListener() {
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;

    void startAndroidOAuthReturnListener().then((cleanup) => {
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