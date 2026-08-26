type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getCapacitor(): CapacitorBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
}

/** True inside a Capacitor native WebView (any platform). */
export function isCapacitorNative(): boolean {
  try {
    if (getCapacitor()?.isNativePlatform?.()) return true;
  } catch {
    // ignore
  }
  return /;\s*wv\)/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent || "" : "",
  );
}

export function capacitorPlatform(): "ios" | "android" | "web" {
  try {
    const platform = getCapacitor()?.getPlatform?.();
    if (platform === "ios" || platform === "android") return platform;
  } catch {
    // ignore
  }
  return "web";
}

/** Android Capacitor only — used for OAuth deep-link return. */
export function isAndroidCapacitor(): boolean {
  try {
    const cap = getCapacitor();
    if (cap?.isNativePlatform?.() && cap.getPlatform?.() === "android") {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function isIosCapacitor(): boolean {
  try {
    const cap = getCapacitor();
    if (cap?.isNativePlatform?.() && cap.getPlatform?.() === "ios") {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Custom URL scheme for Android OAuth return.
 * Must match AndroidManifest intent-filter and Supabase Redirect URLs.
 */
export const ANDROID_OAUTH_CALLBACK =
  "app.newfind.social://auth/callback";