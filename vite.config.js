import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase':     ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
    // Warn if any chunk > 600kB
    chunkSizeWarningLimit: 600,
  },

  // Ensure env vars with VITE_ prefix are exposed to client
  envPrefix: 'VITE_',
})
