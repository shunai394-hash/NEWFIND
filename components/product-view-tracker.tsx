"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/lib/app-context";
import { authHeaders } from "@/lib/auth/client-headers";

/**
 * Fires a real viewed event once per mount when the user is signed in.
 * Does not invent anonymous views.
 */
export function ProductViewTracker({ productId }: { productId: string }) {
  const { session, sessionResolved } = useApp();
  const sent = useRef(false);

  useEffect(() => {
    if (!sessionResolved || !session || sent.current) return;
    sent.current = true;
    void (async () => {
      try {
        await fetch("/api/integrations/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({ eventType: "viewed", productId }),
        });
      } catch {
        // non-blocking
      }
    })();
  }, [session, sessionResolved, productId]);

  return null;
}
