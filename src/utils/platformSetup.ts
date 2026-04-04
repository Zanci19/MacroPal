import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export function setupPlatform() {
  // Prevent status bar from overlaying the webview to avoid navigation bar overlap
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});

  const isDarkMode = document.body.classList.contains("dark");
  const statusBarColor = isDarkMode ? "#36393E" : "#FFFFFF";

  if (Capacitor.getPlatform() === "android") {
    // Use explicit hex colors on Android so dark mode system bars match app theme.
    StatusBar.setBackgroundColor({ color: statusBarColor }).catch(() => {});
  }

  StatusBar.setStyle({ style: isDarkMode ? Style.Light : Style.Dark }).catch(() => {});
  SplashScreen.hide().catch(() => {});
}
