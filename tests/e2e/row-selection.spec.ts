import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'

test('selected row controls the CSV and audit; changing it revokes approval on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/')
  await page.locator('#csv-input').setInputFiles({ name: 'selection.csv', mimeType: 'text/csv', buffer: Buffer.from(
    'Email,First Name,Last Name,Phone,Record ID,Private note\nsame@example.com,Alex,Lee,1234567890,100,\nsame@example.com,Alex,Lee,,200,"A unique note\nwith a second line"',
  ) })
  await page.getByRole('button', { name: /Scan 2 contacts/ }).click()
  const selectedFirst = page.getByRole('radio', { name: 'Keep CSV row 2', exact: true })
  const selectedSecond = page.getByRole('radio', { name: 'Keep CSV row 3', exact: true })
  await expect(selectedFirst).toBeChecked()
  const privateField = page.locator('.source-field').filter({ has: page.getByRole('heading', { name: 'Private note', exact: true }) })
  await expect(privateField).toContainText('A unique note')
  await expect(privateField).toContainText('Not carried over')
  await selectedSecond.check()
  await expect(selectedSecond).toBeChecked()
  await expect(privateField).not.toContainText('Not carried over')
  await page.getByRole('button', { name: 'Keep selected row', exact: true }).click()
  await expect(page.getByText('Approved groups (1)')).toBeVisible()
  const auditPending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download audit report' }).click()
  const audit = Papa.parse<Record<string, string>>(readFileSync((await (await auditPending).path())!, 'utf8'), { header: true }).data
  expect(audit.every(row => row['Audit schema version'] === '3' && row.Decision === 'keep-one-row')).toBe(true)
  expect(audit.find(row => row['Selected row'] === 'yes')?.['Source 5: Record ID']).toBe('200')
  await page.getByRole('button', { name: 'Review export', exact: true }).click()
  await page.getByLabel(/I reviewed every approved group/).check()
  const output = page.getByRole('button', { name: 'Download reviewed CSV' })
  const csvPending = page.waitForEvent('download')
  await output.click()
  const csv = Papa.parse<Record<string, string>>(readFileSync((await (await csvPending).path())!, 'utf8'), { header: true }).data
  expect(csv).toHaveLength(1)
  expect(csv[0]['Record ID']).toBe('200')
  expect(csv[0]['Private note']).toBe('A unique note\nwith a second line')
  expect(csv[0].Phone).toBe('') // Values from the discarded row are not silently merged.
  await selectedFirst.check()
  await expect(page.getByText('Approved groups (1)')).not.toBeVisible()
  await page.getByRole('button', { name: 'Keep selected row', exact: true }).click()
  await page.getByRole('button', { name: 'Review export', exact: true }).click()
  await expect(page.getByLabel(/I reviewed every approved group/)).not.toBeChecked()
  await page.getByLabel(/I reviewed every approved group/).check()
  await expect(output).toBeDisabled() // New selection requires a fresh audit as well.
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})
