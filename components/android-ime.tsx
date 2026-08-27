"use client";

import { useEffect } from "react";
import { isAndroidCapacitor } from "@/lib/capacitor/platform";

function isEditable(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/**
 * Android System WebView often fails to open IME unless the WebView has native
 * focus AND the HTML field reports a real inputType. Prompt the Keyboard plugin
 * after focus so Gboard actually attaches.
 */
export function AndroidImeSupport() {
  useEffect(() => {
    if (!isAndroidCapacitor()) return;

    document.documentElement.classList.add("android-cap");

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditable(event.target)) return;
      const el = event.target;
      if (el.readOnly || el.disabled) return;
      void import("@capacitor/keyboard")
        .then(({ Keyboard }) => Keyboard.show())
        .catch(() => undefined);
    };

    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.documentElement.classList.remove("android-cap");
    };
  }, []);

  return null;
}
