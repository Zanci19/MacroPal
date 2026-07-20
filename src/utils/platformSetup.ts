import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

/**
 * Status-bar background per theme. Matches --mp-bg in theme.css exactly so the
 * native bar blends into the app header directly below it (previously #121212 /
 * #FFFFFF, neither of which matched the app surface).
 */
const STATUS_BAR_BG = {
  dark: '#0b0e13',
  light: '#eef1f6',
} as const;

/**
 * Re-theme the native status bar to match the current app theme.
 *
 * This must run on every theme change, not just at boot. The status bar is a
 * native surface the WebView cannot restyle with CSS, so toggling the `dark`
 * class alone leaves it stuck at whatever it was when the app launched — which
 * is the bug where a dark app showed a white status bar with invisible icons.
 * applyTheme() calls this after each switch so the bar always follows.
 *
 * Style is intentionally inverted relative to the theme: Style.Light means
 * light (white) icons, which belong on a dark background, and vice versa.
 * Both the colour and the icon style are set from the same `isDark` value so
 * they can never drift out of sync the way the old split logic could.
 */
export function syncStatusBar(isDark: boolean) {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android' && platform !== 'ios') return;

  StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark }).catch(() => {});

  if (platform === 'android') {
    StatusBar.setBackgroundColor({
      color: isDark ? STATUS_BAR_BG.dark : STATUS_BAR_BG.light,
    }).catch(() => {});
  }
}

export function setupPlatform() {
  // Keep the status bar out of the WebView so content doesn't sit under it.
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});

  // Boot-time sync. applyTheme() also calls syncStatusBar once the stored theme
  // is applied, but syncing here too avoids a flash before that runs.
  syncStatusBar(document.body.classList.contains('dark'));

  SplashScreen.hide().catch(() => {});
}
