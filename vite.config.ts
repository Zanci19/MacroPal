/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      format: {
        comments: false,
      },
      compress: {
        drop_console: true,
        drop_debugger: true,
      }
    } as any,
    rollupOptions: {
      output: {
        manualChunks: {
          'ionic-core': ['@ionic/react', '@ionic/react-router'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'recharts': ['recharts'],
          'swiper': ['swiper'],
          'react-router': ['react-router', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
