package app.newfind.social;

import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Android WebView IME: CapacitorWebView only creates an InputConnection after it
 * is the focused view. If the Activity keeps focus, Gboard reports inputType=0
 * and mServedInputConnection=null so HTML inputs cannot accept text.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_UNCHANGED
                | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        );
        configureWebViewForIme();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebViewForIme();
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            WebView webView = webView();
            if (webView != null && !webView.hasFocus()) {
                webView.requestFocus();
            }
        }
        return super.dispatchTouchEvent(event);
    }

    private void configureWebViewForIme() {
        WebView webView = webView();
        if (webView == null) {
            return;
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setClickable(true);
        webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
        webView.requestFocus(View.FOCUS_DOWN);
        webView.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                view.requestFocus();
            }
            return false;
        });
    }

    private WebView webView() {
        if (getBridge() == null) {
            return null;
        }
        return getBridge().getWebView();
    }
}
