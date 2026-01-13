import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zanci19.macropal',
  appName: 'MacroPal',
  webDir: 'dist',
  // Android-specific optimizations
  android: {
    // Disable WebView debugging in production for better performance
    webContentsDebuggingEnabled: false,
    // Prevent mixed content (keep default secure behavior)
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false, // Works on Android 14 and below
    },
    SystemBars: {
      insetsHandling: 'css', // Injects CSS variables for Android 15+
    },
    // Splash screen optimization
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
