import type { CapacitorConfig } from "@capacitor/cli";

/**
 * NEWFIND keeps Next.js as the web runtime (auth callback, middleware, App Router).
 * Capacitor WebViews load that hosted app via CAPACITOR_SERVER_URL so we do not
 * force `output: "export"` (which would break OAuth callback + dynamic routes).
 *
 * Examples:
 *   CAPACITOR_SERVER_URL=http://localhost:3000 npx cap sync
 *   CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npx cap sync   # Android emulator
 *   CAPACITOR_SERVER_URL=https://your-domain.example npx cap sync
 */
const configuredServerUrl = process.env.CAPACITOR_SERVER_URL?.trim() || "";
const isReleaseBuild = process.env.CAPACITOR_RELEASE === "1";

// A release must never silently package the development localhost URL. That
// would make the shipped WebView and its OAuth/API requests unusable on review
// devices if a release pipeline forgot to set CAPACITOR_SERVER_URL.
if (isReleaseBuild && !/^https:\/\//i.test(configuredServerUrl)) {
  throw new Error(
    "CAPACITOR_RELEASE=1 requires CAPACITOR_SERVER_URL to be an explicit HTTPS URL",
  );
}

const serverUrl = configuredServerUrl || "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "app.newfind.social",
  appName: "NEWFIND",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    allowNavigation: [
      "localhost",
      "127.0.0.1",
      "10.0.2.2",
      "*.supabase.co",
      "*.supabase.in",
      "images.unsplash.com",
      "*.unsplash.com",
      "images.pexels.com",
      "*.pexels.com",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
      "*.vercel.app",
      "newfind-self.vercel.app",
      "newfind.social",
      "*.newfind.social",
      "appleid.apple.com",
      "account.apple.com",
    ],
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: !isReleaseBuild,
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#111111",
    },
  },
};

export default config;
