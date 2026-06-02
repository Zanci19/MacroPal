import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zanci19.macropal',
  appName: 'MacroPal',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: false, // Works on Android 14 and below
    },
    SystemBars: {
      insetsHandling: 'disable', // Handled by android-edge-to-edge-support
    },
    Keyboard: {
      resizeOnFullScreen: false,
    },
  },
};

export default config;
