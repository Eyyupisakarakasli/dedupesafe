import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
      },
    },
  },
})
