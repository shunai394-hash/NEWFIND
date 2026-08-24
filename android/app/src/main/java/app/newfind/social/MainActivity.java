package app.newfind.social;

import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Let the soft keyboard resize the window so HTML inputs can stay visible.
    getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

    try {
      if (this.bridge != null && this.bridge.getWebView() != null) {
        WebView webView = this.bridge.getWebView();
        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptEnabled(true);

        // Ensure the WebView can take focus and attach to the IME.
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);

        // Re-request focus on tap so InputConnection is created for <input>.
        webView.setOnTouchListener(
            (v, event) -> {
              switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                case MotionEvent.ACTION_UP:
                  if (!v.hasFocus()) {
                    v.requestFocus();
                  }
                  break;
              }
              return false;
            });
      }
    } catch (Exception ignored) {
      // Bridge may not be ready yet; Capacitor still loads the remote URL.
    }
  }
}
