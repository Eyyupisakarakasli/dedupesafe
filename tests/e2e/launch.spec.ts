import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const demoCsv = fileURLToPath(new URL('../../src/data/demo-hubspot-contacts.csv', import.meta.url))

test('landing, upload, worker scan, decisions, audit and confirmed export', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/DedupeSafe/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Review duplicate contacts')
  await expect(page.getByRole('link', { name: 'Open the checker' })).toBeVisible()

  await page.goto('/app/')
  await page.locator('#csv-input').setInputFiles(demoCsv)
  await expect(page.getByRole('heading', { name: 'Confirm Column Mapping' })).toBeVisible()
  await expect(page.getByText('15 rows detected')).toBeVisible()

  await page.getByRole('button', { name: /Scan 15 contacts/ }).click()
  await expect(page.getByRole('heading', { name: 'Scan Complete' })).toBeVisible()
  await expect(page.getByText('7 candidate groups')).toBeVisible()
  await expect(page.getByText('nothing removed')).toBeVisible()

  await page.getByRole('button', { name: 'Merge these' }).first().click()
  await expect(page.getByText('Approved merges (1)')).toBeVisible()
  await expect(page.getByText(/removes 1 approved duplicate row/)).toBeVisible()

  const auditDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download audit report' }).click()
  const audit = await auditDownload
  await expect(audit.suggestedFilename()).toBe('dedupesafe-audit-report.csv')
  const auditPath = await audit.path()
  expect(auditPath).not.toBeNull()
  const auditText = readFileSync(auditPath!, 'utf8')
  expect(auditText).toContain(',merge,')
  expect(auditText).toContain(',unreviewed,')

  await page.getByRole('button', { name: 'Review export' }).click()
  await expect(page.getByRole('heading', { name: 'Final export check' })).toBeVisible()
  const finalDownloadButton = page.getByRole('button', { name: 'Download reviewed CSV' })
  await expect(finalDownloadButton).toBeDisabled()
  await page.getByLabel(/I reviewed every approved merge/).check()

  const csvDownload = page.waitForEvent('download')
  await finalDownloadButton.click()
  const reviewedCsv = await csvDownload
  await expect(reviewedCsv.suggestedFilename()).toBe('dedupesafe-reviewed-contacts.csv')
  const reviewedPath = await reviewedCsv.path()
  expect(reviewedPath).not.toBeNull()
  const reviewedText = readFileSync(reviewedPath!, 'utf8')
  expect(reviewedText.replace(/^\uFEFF/, '').trim().split(/\r?\n/)).toHaveLength(15)
})

test('demo link records a page request and opens the mapping step', async ({ page }) => {
  await page.goto('/app/?demo=1')
  await expect(page.getByRole('heading', { name: 'Confirm Column Mapping' })).toBeVisible()
  await expect(page.getByText('15 rows detected')).toBeVisible()
})
