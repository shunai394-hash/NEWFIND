import { Browser } from "@capacitor/browser";

/**
 * Open an OAuth URL inside Capacitor Browser (SFSafariViewController on iOS,
 * Chrome Custom Tabs on Android). Never send the user to the default browser.
 */
export async function openNativeOAuthUrl(url: string) {
  await Browser.open({
    url,
    presentationStyle: "fullscreen",
    toolbarColor: "#111111",
  });
}
