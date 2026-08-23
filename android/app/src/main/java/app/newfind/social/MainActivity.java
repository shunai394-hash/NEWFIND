package app.newfind.social;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    WebView.setWebContentsDebuggingEnabled(true);
    super.onCreate(savedInstanceState);
    try {
      if (this.bridge != null && this.bridge.getWebView() != null) {
        this.bridge.getWebView().getSettings().setDomStorageEnabled(true);
        this.bridge.getWebView().getSettings().setJavaScriptEnabled(true);
        this.bridge.getWebView().clearCache(true);
      }
    } catch (Exception ignored) {
      // Bridge may not be ready yet; Capacitor still loads the remote URL.
    }
  }
}
