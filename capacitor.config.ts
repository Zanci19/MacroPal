import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zanci19.macropal',
  appName: 'MacroPal',
  webDir: 'dist',
  android: {
    adjustMarginsForEdgeToEdge: 'force', // or 'force'
  },
};

export default config;
