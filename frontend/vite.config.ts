import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// Preview proxy target is overridable so E2E can point at an isolated backend
// (PREVIEW_API_TARGET=http://localhost:3101) instead of the dev backend (:3001).
const previewApiTarget = process.env.PREVIEW_API_TARGET ?? 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Dev and preview are same-origin with API: /api proxied to backend (spec 4).
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    proxy: {
      '/api': previewApiTarget,
    },
  },
})
