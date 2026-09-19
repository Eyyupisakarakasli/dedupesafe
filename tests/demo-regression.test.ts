import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { detectHubSpotMapping, normalizeContacts } from '../src/core/csv'
import { exportCleanedCSV } from '../src/core/export'
import { findDuplicateGroups } from '../src/core/matcher'

const demoPath = new URL('../src/data/demo-hubspot-contacts.csv', import.meta.url)

function dataRowCount(csv: string): number {
  return csv.replace(/^\uFEFF/, '').trim().split('\r\n').length - 1
}

describe('demo CSV end-to-end regression', () => {
  it('finds six identifier groups and one review group without dropping review rows', () => {
    const source = readFileSync(demoPath, 'utf8')
    const parsed = Papa.parse<Record<string, string>>(source, { header: true, skipEmptyLines: true })
    expect(parsed.errors).toHaveLength(0)

    const headers = parsed.meta.fields ?? []
    const mapping = detectHubSpotMapping(headers)
    const contacts = normalizeContacts(parsed.data, mapping)
    const outcome = findDuplicateGroups(contacts)

    expect(contacts).toHaveLength(15)
    expect(outcome.groups).toHaveLength(6)
    expect(outcome.reviewGroups).toHaveLength(1)

    const reviewContacts = outcome.reviewGroups.flatMap(group => group.contacts)
    const safeExport = exportCleanedCSV(
      outcome.groups,
      [...outcome.uniqueContacts, ...reviewContacts],
      contacts,
      headers,
    )
    expect(dataRowCount(safeExport)).toBe(9)

    const confirmedExport = exportCleanedCSV(
      [...outcome.groups, ...outcome.reviewGroups],
      outcome.uniqueContacts,
      contacts,
      headers,
    )
    expect(dataRowCount(confirmedExport)).toBe(8)
  })
})
