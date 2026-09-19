import { defineConfig, devices } from '@playwright/test'

const externalBaseURL = process.env.E2E_BASE_URL
const trustedToken = process.env.VERCEL_OIDC_TOKEN

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    extraHTTPHeaders: trustedToken
      ? { 'x-vercel-trusted-oidc-idp-token': trustedToken }
      : undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: externalBaseURL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
