/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 900,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('@tensorflow-models')) return 'tensorflow-models';
          if (id.includes('@tensorflow/tfjs-backend-webgl')) return 'tfjs-webgl';
          if (id.includes('@tensorflow/tfjs-backend-cpu')) return 'tfjs-cpu';
          if (id.includes('@tensorflow/tfjs-converter')) return 'tfjs-converter';
          if (id.includes('@tensorflow/tfjs-layers')) return 'tfjs-layers';
          if (id.includes('@tensorflow/tfjs-core')) return 'tfjs-core';
          if (id.includes('@tensorflow/tfjs')) return 'tfjs-runtime';
          if (id.includes('firebase/')) return 'firebase';
          if (id.includes('recharts') || id.includes('d3-')) return 'recharts';
          if (id.includes('@zxing/')) return 'zxing';
          if (id.includes('@ionic/core/components')) return 'ionic-components';
          if (id.includes('@ionic/react-router') || id.includes('@ionic/react')) return 'ionic-react';
          if (id.includes('@ionic/')) return 'ionic-core';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // tests/ holds the Firestore rules suite, which runs against the emulator
    // via `npm run test.rules` rather than in jsdom.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
  }
})
