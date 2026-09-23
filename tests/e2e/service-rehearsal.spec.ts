import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const demoPath = fileURLToPath(new URL('../../src/data/demo-hubspot-contacts.csv', import.meta.url))
const parse = (text: string) => Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })

test('service rehearsal preserves every unapproved source row and records decisions', async ({ page }, testInfo) => {
  const original = readFileSync(demoPath, 'utf8')
  const source = parse(original)
  expect(source.errors).toEqual([])
  await page.goto('/app/')
  await page.locator('#csv-input').setInputFiles(demoPath)
  for (const [field, column] of Object.entries({ email: 'Email', firstName: 'First Name', lastName: 'Last Name', phone: 'Phone Number', company: 'Company Name' })) {
    await expect(page.locator(`#map-${field}`)).toHaveValue(column)
  }
  await page.getByRole('button', { name: 'Scan 15 contacts' }).click()
  await expect(page.getByText('7 candidate groups')).toBeVisible()
  await page.getByRole('button', { name: 'Keep selected row', exact: true }).first().click()
  await page.getByRole('button', { name: 'Keep both', exact: true }).first().click()
  await page.getByRole('button', { name: 'Review export', exact: true }).click()
  const download = page.getByRole('button', { name: 'Download reviewed CSV', exact: true })
  await expect(download).toBeDisabled()
  await page.getByLabel(/I reviewed every approved group/).check()
  await expect(download).toBeDisabled()
  const auditEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download audit report', exact: true }).click()
  const auditDownload = await auditEvent
  const auditPath = testInfo.outputPath('synthetic-audit.csv')
  await auditDownload.saveAs(auditPath)
  const audit = parse(readFileSync(auditPath, 'utf8'))
  expect(audit.errors).toEqual([])
  expect(new Set(audit.data.map(row => row.Decision))).toEqual(new Set(['keep-one-row', 'keep-all-rows', 'unreviewed']))
  expect(audit.data).toHaveLength(14)
  await expect(download).toBeEnabled()
  const reviewedEvent = page.waitForEvent('download')
  await download.click()
  const reviewedDownload = await reviewedEvent
  const reviewedPath = testInfo.outputPath('synthetic-reviewed.csv')
  await reviewedDownload.saveAs(reviewedPath)
  const reviewed = parse(readFileSync(reviewedPath, 'utf8'))
  expect(reviewed.errors).toEqual([])
  expect(reviewed.data).toHaveLength(14)
  expect(reviewed.meta.fields).toEqual(source.meta.fields)
  const removedRows = audit.data.filter(row => row.Decision === 'keep-one-row' && row['Selected row'] === 'no').map(row => Number(row.Row) - 2)
  expect(removedRows).toHaveLength(1)
  expect(reviewed.data).toEqual(source.data.filter((_, index) => !removedRows.includes(index)))
  for (const row of audit.data) {
    const input = source.data[Number(row.Row) - 2]
    source.meta.fields!.forEach((header, index) => expect(row[`Source ${index + 1}: ${header}`]).toBe(input[header]))
  }
  expect(readFileSync(demoPath, 'utf8')).toBe(original)
  await testInfo.attach('reviewed CSV (synthetic)', { path: reviewedPath, contentType: 'text/csv' })
  await testInfo.attach('audit CSV (synthetic)', { path: auditPath, contentType: 'text/csv' })
})
