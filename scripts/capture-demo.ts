/**
 * Records the demo run as a video, then turns it into docs/demo.gif.
 *
 * The pauses are deliberate: a reader has to follow what changed between two
 * frames without a narrator. Requires a dev server on port 5173 and ffmpeg on
 * PATH.
 */
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const size = { width: 1200, height: 760 }
const videoDir = mkdtempSync(resolve(tmpdir(), 'dedupesafe-demo-'))

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: size,
  recordVideo: { dir: videoDir, size },
})
const page = await context.newPage()
const beat = (ms = 1_200) => page.waitForTimeout(ms)

await page.goto('http://127.0.0.1:5173/app/')
await page.getByRole('button', { name: /Try with demo CSV/ }).waitFor()
await beat(1_800)

await page.getByRole('button', { name: /Try with demo CSV/ }).click()
await page.getByRole('heading', { name: 'Confirm Column Mapping' }).waitFor()
await beat(2_200)

await page.getByRole('button', { name: /Scan 15 contacts/ }).click()
await page.getByRole('heading', { name: 'Scan Complete' }).waitFor()
await beat(2_000)

await page.getByRole('button', { name: 'Merge these' }).first().click()
await page.getByText('Approved merges (1)').waitFor()
await beat(1_400)

await page.getByRole('button', { name: 'Keep both' }).first().click()
await beat(1_400)

await page.getByRole('button', { name: 'Review export' }).click()
await page.getByRole('heading', { name: 'Final export check' }).waitFor()
await beat(2_000)

await page.getByLabel(/I reviewed every approved merge/).check()
await beat(1_400)

const download = page.waitForEvent('download')
await page.getByRole('button', { name: 'Download reviewed CSV' }).click()
await download
await beat(1_800)

await context.close()
await browser.close()

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

rmSync(videoDir, { recursive: true, force: true })
console.log(`wrote ${gif}`)
