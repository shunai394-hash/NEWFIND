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
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || "http://localhost:3000";
const isReleaseBuild = process.env.CAPACITOR_RELEASE === "1";

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
      backgroundColor: "#e5e5e5",
    },
  },
};

export default config;
