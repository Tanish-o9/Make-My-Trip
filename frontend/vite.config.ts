import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash]-v8.js',
        chunkFileNames: 'assets/[name]-[hash]-v8.js',
        assetFileNames: 'assets/[name]-[hash]-v8.[ext]'
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
})
