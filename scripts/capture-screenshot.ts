import { chromium } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(30_000)
try {
  await page.goto(new URL('/app/?demo=1', baseURL).href)
  await page.getByRole('heading', { name: 'Confirm Column Mapping' }).waitFor()
  await page.screenshot({ path: resolve(here, '../docs/marketing-2026-09-23/assets/01-mapping.png'), fullPage: true })
  await page.getByRole('button', { name: /Scan 15 contacts/ }).click()
  await page.getByRole('heading', { name: 'Scan Complete' }).waitFor()
  await page.getByRole('searchbox', { name: 'Search contacts' }).fill('charlie')
  await page.screenshot({ path: resolve(here, '../docs/marketing-2026-09-23/assets/02-review.png'), fullPage: true })
  await page.getByRole('button', { name: 'Keep selected row', exact: true }).click()
  await page.getByText('Approved groups (1)').waitFor()
  await page.screenshot({ path: resolve(here, '../docs/product-screenshot.png'), fullPage: true })
  await page.screenshot({
    path: resolve(here, '../public/product-preview.png'),
    clip: { x: 120, y: 340, width: 1200, height: 630 },
  })
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('dark')
  await page.screenshot({ path: resolve(here, '../docs/marketing-2026-09-23/assets/04-dark-review.png'), fullPage: true })
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('light')
  await page.getByRole('button', { name: 'Review export' }).click()
  await page.getByRole('heading', { name: 'Final export check' }).waitFor()
  await page.screenshot({ path: resolve(here, '../docs/marketing-2026-09-23/assets/03-export.png'), fullPage: true })
} finally {
  await browser.close()
}
