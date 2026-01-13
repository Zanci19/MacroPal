import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zanci19.macropal',
  appName: 'MacroPal',
  webDir: 'dist',
  // Android-specific optimizations
  android: {
    // Use WKWebView for better performance
    webContentsDebuggingEnabled: false,
    // Enable hardware acceleration
    allowMixedContent: false,
  },
  // Server configuration for better loading
  server: {
    // Allow cleartext for local development only
    androidScheme: 'https',
    // Enable hostname for better routing
    hostname: 'macropal.app',
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
