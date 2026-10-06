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

/**
 * Calls `callback` once when the in-app browser sheet closes — because the
 * person tapped "Done" (cancelled) or because the OAuth return closed it.
 * Returns a disposer that removes the listener without calling `callback`.
 */
export async function onNativeBrowserClosed(callback: () => void): Promise<() => void> {
  let done = false;
  const handle = await Browser.addListener("browserFinished", () => {
    if (done) return;
    done = true;
    void handle.remove();
    callback();
  });
  return () => {
    if (done) return;
    done = true;
    void handle.remove();
  };
}
