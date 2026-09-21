import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { exportAuditCSV, exportCleanedCSV } from '../src/core/export'
import type { Contact, DuplicateGroup } from '../src/core/types'

const contacts: Contact[] = [
  { rowIndex: 0, email: 'same@example.com', firstName: 'A', lastName: 'One', phone: '', company: '', raw: { Email: 'same@example.com', Note: '', 'Group ID': 'original-1' } },
  { rowIndex: 1, email: 'same@example.com', firstName: 'A', lastName: 'One', phone: '', company: '', raw: { Email: 'same@example.com', Note: 'Özel, "not"\nikinci satır', 'Group ID': 'original-2', Formula: '=1+1' } },
]
const group: DuplicateGroup = { id: 'g', contacts, masterContact: contacts[0], pairs: [], riskScore: 100, riskLevel: 'certain' }

describe('full source audit', () => {
  it('preserves removed custom values, source order and metadata separately', () => {
    const csv = exportAuditCSV([group], new Set(['g']), new Set(), ['Group ID', 'Email', 'Note'])
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true })
    expect(parsed.errors).toEqual([])
    expect(parsed.data[1]['Group ID']).toBe('g')
    expect(parsed.data[1]['Source 1: Group ID']).toBe('original-2')
    expect(parsed.data[1]['Source 3: Note']).toBe(contacts[1].raw.Note)
    expect(parsed.data[1]['Source 4: Formula']).toBe("'=1+1")
    expect(parsed.data[0]['Source 4: Formula']).toBe('')
    expect(parsed.data[1]['Selected master']).toBe('no')
    expect(parsed.data[1].Decision).toBe('merge')
    expect(exportCleanedCSV([group], [], contacts)).not.toContain('ikinci satır')
  })

  it('lets keep-both override approval just like the reviewed export UI', () => {
    const csv = exportAuditCSV([group], new Set(['g']), new Set(['g']))
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true })
    expect(parsed.data.every(row => row.Decision === 'keep-both')).toBe(true)
  })
})
