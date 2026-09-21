import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, sep } from 'node:path'
import { withCheckerCsp } from './scripts/checker-csp.ts'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { CAMPAIGNS, campaignHtml } from './scripts/campaign-pages.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'campaign-pages',
      apply: 'build',
      writeBundle(options) {
        const out = options.dir ?? resolve(import.meta.dirname, 'dist')
        const landing = readFileSync(resolve(out, 'index.html'), 'utf8')
        for (const campaign of CAMPAIGNS) {
          const directory = resolve(out, 'for', campaign)
          mkdirSync(directory, { recursive: true })
          writeFileSync(resolve(directory, 'index.html'), campaignHtml(landing, campaign))
        }
      },
    },
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
