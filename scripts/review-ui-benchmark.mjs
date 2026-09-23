import { chromium, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const groups = 1000
const csv = 'Email,First Name,Last Name,Record ID,Note\n' + Array.from({ length: groups }, (_, i) => {
  const id = createHash('sha256').update(String(i)).digest('hex')
  return [0, 1].map(j => `${id}@example.com,${id.slice(0, 10)},${id.slice(10, 20)},${i}-${j},note ${j}`).join('\n')
}).join('\n')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(30000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function measure(action, ready) {
  const start = performance.now()
  await action()
  await ready()
  await paint()
  return Math.round(performance.now() - start)
}
try {
  await page.goto(`${base}/app/`)
  await page.locator('#csv-input').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  const scan = await measure(() => page.getByRole('button', { name: /Scan 2,000 contacts/ }).click(), () => expect(page.getByRole('heading', { name: 'Scan Complete' })).toBeVisible())
  await expect(page.locator('header')).toContainText('1000 candidate groups')
  const approval = await measure(() => page.getByRole('button', { name: 'Keep selected row', exact: true }).first().click(), () => expect(page.getByText('Approved groups (1)')).toBeVisible())
  const pagination = await measure(() => page.getByRole('button', { name: 'Next page', exact: true }).click(), () => expect(page.getByText('Page 2 of 200', { exact: true })).toBeVisible())
  const search = await measure(() => page.getByLabel('Search contacts').fill(createHash('sha256').update('999').digest('hex')), () => expect(page.locator('.group-card')).toHaveCount(1))
  await page.getByLabel('Search contacts').fill('')
  await expect(page.locator('.group-card')).toHaveCount(5)
  mkdirSync('benchmarks', { recursive: true })
  mkdirSync('test-results/review-visual', { recursive: true })
  await page.screenshot({ path: 'test-results/review-visual/desktop.png' })
  await page.setViewportSize({ width: 320, height: 900 })
  await page.screenshot({ path: 'test-results/review-visual/mobile.png' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  const result = { measuredAt: new Date().toISOString(), browser: browser.version(), rows: groups * 2, groups, mountedCards: await page.locator('.group-card').count(), measurement: 'One local Chromium run; action through assertion and two animation frames. Includes automation overhead; scan includes matching. Not an isolated render or cross-device benchmark.', milliseconds: { scan, approval, pagination, search }, mobile320Overflow: overflow, pageErrors: errors }
  writeFileSync('benchmarks/review-ui-2026-09-23.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
  if (overflow || errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
