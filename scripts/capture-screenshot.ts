import { chromium } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })

await page.goto('http://127.0.0.1:5173/app/?demo=1')
await page.getByRole('heading', { name: 'Confirm Column Mapping' }).waitFor()
await page.getByRole('button', { name: /Scan 15 contacts/ }).click()
await page.getByRole('heading', { name: 'Scan Complete' }).waitFor()
await page.getByRole('button', { name: 'Merge these' }).first().click()
await page.getByText('Approved merges (1)').waitFor()
await page.screenshot({ path: resolve(here, '../docs/product-screenshot.png'), fullPage: true })
await page.screenshot({
  path: resolve(here, '../public/product-preview.png'),
  clip: { x: 120, y: 0, width: 1200, height: 630 },
})
await browser.close()
