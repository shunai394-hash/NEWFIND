"use client";

import { isCapacitorNative } from "@/lib/capacitor/platform";

/** Native WebViews are more reliable with a full navigation than client routing. */
export function navigateApp(router: { push: (href: string) => void }, href: string) {
  if (isCapacitorNative()) {
    window.location.assign(href);
    return;
  }
  router.push(href);
}
