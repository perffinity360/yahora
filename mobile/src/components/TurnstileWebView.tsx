import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { spacing } from '../theme';

// Cloudflare Turnstile inside a WebView (runbook Block D).
//
// Turnstile is browser technology with no native React Native component, so a
// tiny HTML page runs it and hands the token out over the one channel a WebView
// page has: window.ReactNativeWebView.postMessage. Every message in either
// direction is a JSON STRING — objects cannot cross the boundary — and every
// message carries a `type`, so the RN side never has to guess what it got.
//
// The SITE key passed in is public by design; it only names the widget. The
// SECRET key lives in the Supabase dashboard and must never exist in this repo.
// Supabase verifies the token when request-otp mints the OTP — nothing on the
// device, and nothing in our backend, ever checks it.

// (a) HOSTNAME. Turnstile checks the page's origin against the hostnames
// registered on the widget in Cloudflare, and raw HTML in a WebView has an odd
// origin (about:blank / null) that it rejects. baseUrl gives the page this
// origin instead, so it MUST be a hostname on the widget's list. Change it here
// when Yahora moves to its purchased domain — and register that domain on the
// widget BEFORE shipping the change, or every mobile login fails.
// For development, `localhost` may also need adding to the widget's hostname
// list in the Cloudflare dashboard.
const TURNSTILE_BASE_URL = 'https://yahora.netlify.app';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';

// No network or Cloudflare unreachable usually surfaces as the script tag's
// onerror, but a stalled connection can hang instead of failing. After this
// long without the script loading, the page reports an error so the login
// screen can say so rather than show a dead button forever.
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;

// Managed mode with appearance: 'interaction-only' draws nothing unless
// Cloudflare wants a tap, so the page reports its real height and the WebView
// follows it. At rest it is a 1px transparent strip — not 0, so no platform
// treats the WebView as detached and suspends it, and not a reserved 65px
// that leaves a hole in the form.
const HIDDEN_HEIGHT = 1;
const MAX_HEIGHT = 300;

export interface TurnstileHandle {
  /**
   * (b) ONE USE PER TOKEN. Remounts the WebView, which renders a fresh widget
   * and produces a fresh token. The parent calls this after EVERY request-otp,
   * successful or failed — a spent token fails the second attempt otherwise.
   * Also the retry path after a load error.
   */
  reset: () => void;
}

export interface TurnstileWebViewProps {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (message: string) => void;
  onExpire?: () => void;
}

type PageMessage =
  | { type: 'token'; token: string }
  | { type: 'error'; message: string }
  | { type: 'expired' }
  | { type: 'height'; height: number };

/** A JS string literal that cannot close the surrounding <script> tag. */
function toScriptLiteral(value: string) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildHtml(siteKey: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  body { display: flex; justify-content: center; }
  /* Cloudflare draws a fixed 300px-wide iframe and will not shrink it — the
     width is set inside the frame, where our CSS cannot reach. A card narrower
     than 300px leaves exactly one lever: scale the whole thing down. The web
     form solves it the same way (Auth.module.css .turnstile).
     What this must NOT do is fall back to size:'compact'. Compact is 150x140 —
     a tall block with "Verify you are human" wrapped onto two lines and the
     Cloudflare logo stacked underneath, which dominates the card. */
  #scaler { flex: 0 0 300px; width: 300px; transform-origin: top center; }
</style>
</head>
<body>
<div id="scaler"><div id="widget"></div></div>
<script>
(function () {
  var SITE_KEY = ${toScriptLiteral(siteKey)};
  var WIDGET_WIDTH = 300;
  var scaler = document.getElementById('scaler');
  var widget = document.getElementById('widget');
  var loaded = false;

  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  function applyScale() {
    var available = document.documentElement.clientWidth || window.innerWidth || WIDGET_WIDTH;
    var scale = Math.min(1, available / WIDGET_WIDTH);
    scaler.style.transform = scale < 1 ? 'scale(' + scale + ')' : 'none';
  }

  // getBoundingClientRect is transform-aware, so this is the height actually
  // drawn, not the 65px the widget occupies before scaling. The native View
  // therefore reserves exactly what is visible and leaves no dead strip.
  // Hit-testing follows the transform too — the checkbox stays tappable.
  function reportHeight() {
    applyScale();
    post({ type: 'height', height: Math.ceil(scaler.getBoundingClientRect().height) });
  }

  window.onTurnstileLoad = function () {
    loaded = true;
    try {
      turnstile.render('#widget', {
        sitekey: SITE_KEY,
        action: 'request-otp',
        theme: 'light',
        appearance: 'interaction-only',
        // Always the 300x65 bar; applyScale() fits it to the card. Never
        // 'compact' — see the #scaler comment above.
        size: 'normal',
        callback: function (token) {
          post({ type: 'token', token: token });
        },
        'error-callback': function (code) {
          post({ type: 'error', message: 'turnstile error ' + code });
        },
        // (c) EXPIRY. Tokens die after about five minutes; the parent must
        // drop its copy or the next send carries a dead token.
        'expired-callback': function () {
          post({ type: 'expired' });
        }
      });
    } catch (e) {
      post({ type: 'error', message: 'render failed: ' + e });
    }
  };

  window.onTurnstileScriptError = function () {
    post({ type: 'error', message: 'turnstile script failed to load' });
  };

  setTimeout(function () {
    if (!loaded) post({ type: 'error', message: 'turnstile script load timed out' });
  }, ${SCRIPT_LOAD_TIMEOUT_MS});

  if (window.ResizeObserver) new ResizeObserver(reportHeight).observe(widget);
  window.addEventListener('resize', reportHeight);
  reportHeight();
})();
</script>
<script src="${TURNSTILE_SCRIPT_URL}" async defer onerror="onTurnstileScriptError()"></script>
</body>
</html>`;
}

/** Page messages are untrusted strings; anything malformed is dropped. */
function parseMessage(raw: string): PageMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const msg = data as Record<string, unknown>;
  switch (msg.type) {
    case 'token':
      return typeof msg.token === 'string' && msg.token ? { type: 'token', token: msg.token } : null;
    case 'error':
      return {
        type: 'error',
        message: typeof msg.message === 'string' ? msg.message : 'unknown turnstile error',
      };
    case 'expired':
      return { type: 'expired' };
    case 'height':
      return typeof msg.height === 'number' && Number.isFinite(msg.height)
        ? { type: 'height', height: msg.height }
        : null;
    default:
      return null;
  }
}

export const TurnstileWebView = forwardRef<TurnstileHandle, TurnstileWebViewProps>(
  function TurnstileWebView({ siteKey, onToken, onError, onExpire }, ref) {
    // Bumping this is the reset: a new key remounts the WebView from scratch.
    const [instance, setInstance] = useState(0);
    const [height, setHeight] = useState(HIDDEN_HEIGHT);

    const html = useMemo(() => buildHtml(siteKey), [siteKey]);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          setHeight(HIDDEN_HEIGHT);
          setInstance((n) => n + 1);
        },
      }),
      [],
    );

    const handleMessage = (raw: string) => {
      const msg = parseMessage(raw);
      if (!msg) return;

      switch (msg.type) {
        case 'token':
          onToken(msg.token);
          break;
        case 'error':
          onError?.(msg.message);
          break;
        case 'expired':
          onExpire?.();
          break;
        case 'height':
          setHeight(Math.min(MAX_HEIGHT, Math.max(HIDDEN_HEIGHT, msg.height)));
          break;
      }
    };

    const visible = height > HIDDEN_HEIGHT;

    return (
      <View style={[styles.container, { height }, visible && styles.containerVisible]}>
        <WebView
          key={instance}
          source={{ html, baseUrl: TURNSTILE_BASE_URL }}
          onMessage={(event) => handleMessage(event.nativeEvent.data)}
          // (d) ANDROID. On by default on iOS but NOT on Android, and
          // Turnstile is entirely JavaScript. Never remove.
          javaScriptEnabled={true}
          domStorageEnabled={true}
          // The page, its Cloudflare iframe and any about:blank frames it
          // creates must all be allowed to load inside the WebView.
          originWhitelist={['*']}
          // Native load failures and a crashed renderer are the same thing to
          // the student as a failed script: the check cannot run.
          onError={(event) => onError?.(`webview error: ${event.nativeEvent.description}`)}
          onRenderProcessGone={() => onError?.('webview render process gone')}
          onContentProcessDidTerminate={() => onError?.('webview content process terminated')}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={styles.webview}
          containerStyle={styles.webview}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  containerVisible: {
    marginBottom: spacing.md,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
