/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
      },
      mangle: {
        safari10: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'ionic-core': ['@ionic/react', '@ionic/react-router'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'recharts': ['recharts'],
          'swiper': ['swiper'],
          'react-vendor': ['react', 'react-dom', 'react-router', 'react-router-dom'],
        },
        // Optimize chunk sizes for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize assets
    assetsInlineLimit: 4096,
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      '@ionic/react',
      '@ionic/react-router',
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
    ],
    exclude: ['@capacitor/core', '@capacitor/android'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})