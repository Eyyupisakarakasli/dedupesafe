import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, sep } from 'node:path'
import { withCheckerCsp } from './scripts/checker-csp.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'checker-csp',
      apply: 'build',
      transformIndexHtml: {
        order: 'post' as const,
        handler: (html: string, context: { filename: string }) =>
          withCheckerCsp(html, context.filename.split(sep).join('/')),
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
      },
    },
  },
})
