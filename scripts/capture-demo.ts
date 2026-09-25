/**
 * Records the demo run as a video, then turns it into docs/demo.gif.
 *
 * The pauses are deliberate: a reader has to follow what changed between two
 * frames without a narrator. Set E2E_BASE_URL to override the local server (default port 5173). Requires ffmpeg on
 * PATH.
 */
import { chromium, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'
const size = { width: 1200, height: 760 }
const videoDir = mkdtempSync(resolve(tmpdir(), 'dedupesafe-demo-'))

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: size,
  recordVideo: { dir: videoDir, size },
})
const page = await context.newPage()
page.setDefaultTimeout(30_000)
try {
  const beat = (ms = 1_200) => page.waitForTimeout(ms)

  await page.goto(new URL('/app/', baseURL).href)
  await page.getByRole('button', { name: /Try with demo CSV/ }).waitFor()
  await beat(1_800)

  await page.getByRole('button', { name: /Try with demo CSV/ }).click()
  await page.getByRole('heading', { name: 'Confirm Column Mapping' }).waitFor()
  await beat(2_200)

  await page.getByRole('button', { name: /Scan 15 contacts/ }).click()
  await page.getByRole('heading', { name: 'Scan Complete' }).waitFor()
  await beat(2_000)

  await page.getByRole('button', { name: 'Keep selected row', exact: true }).first().click()
  await page.getByText('Approved groups (1)').waitFor()
  await beat(1_400)

  await page.getByRole('button', { name: 'Keep both' }).first().click()
  await beat(1_400)

  await page.getByRole('button', { name: 'Review export' }).click()
  await page.getByRole('heading', { name: 'Final export check' }).waitFor()
  await beat(2_000)

  await page.getByLabel(/I reviewed every approved group/).check()
  await expect(page.getByRole('button', { name: 'Download reviewed CSV' })).toBeDisabled()
  const auditDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download audit report' }).click()
  const audit = await auditDownload
  const auditRows = Papa.parse<Record<string, string>>(readFileSync((await audit.path())!, 'utf8'), { header: true }).data
  if (auditRows.length !== 14 || auditRows.some(row => row['Audit schema version'] !== '3')) throw new Error('Unexpected audit rows/schema')
  await beat(1_400)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download reviewed CSV' }).click()
  const reviewed = await download
  const reviewedRows = Papa.parse(readFileSync((await reviewed.path())!, 'utf8'), { header: true }).data
  if (reviewedRows.length !== 14) throw new Error('Expected 14 reviewed demo rows')
  await beat(1_800)
} finally {
  await context.close()
  await browser.close()
}

const recorded = readdirSync(videoDir).find(name => name.endsWith('.webm'))
if (!recorded) throw new Error('Playwright recorded no video')

const source = resolve(videoDir, recorded)
const palette = resolve(videoDir, 'palette.png')
const gif = resolve(here, '../docs/demo.gif')
const filters = 'fps=12,scale=900:-1:flags=lanczos'
// The recording opens on a blank frame while the page paints.
const trimStart = '0.6'

execFileSync('ffmpeg', ['-y', '-ss', trimStart, '-i', source, '-vf', `${filters},palettegen=stats_mode=diff`, palette], { stdio: 'ignore' })
execFileSync('ffmpeg', [
  '-y', '-ss', trimStart, '-i', source, '-i', palette,
  '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
  gif,
], { stdio: 'ignore' })

// Keep the raw recording for inspection; no recursive deletion of temp paths.
console.log(`raw recording: ${source}`)
console.log(`wrote ${gif}`)
