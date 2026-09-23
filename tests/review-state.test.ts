import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { activeContacts, effectiveGroup, selectGroupRow, setRowSeparate, sourceFields, valuesToReview } from '../src/core/review-state'
import { exportAuditCSV, exportCleanedCSV } from '../src/core/export'
import type { Contact, DuplicateGroup } from '../src/core/types'

const contact = (rowIndex: number, raw: Record<string, string>): Contact => ({ rowIndex, raw, email: 'same@example.com', firstName: 'Alex', lastName: 'Lee', phone: '', company: '' })
const contacts = [
  contact(0, { Email: 'same@example.com', Note: '', Phone: '111', Company: 'First', Formula: '' }),
  contact(1, { Email: 'same@example.com', Note: 'Özel, "not"\nnext line', Phone: '222', Company: 'Second', Formula: '=1+1' }),
  contact(2, { Email: 'same@example.com', Note: 'Independent', Phone: '333', Company: 'Third', Formula: '' }),
]
const group: DuplicateGroup = { id: 'g', contacts, masterContact: contacts[0], pairs: [], riskLevel: 'certain', riskScore: 100 }
const parse = (csv: string) => Papa.parse<Record<string, string>>(csv, { header: true }).data

describe('source differences and split decisions', () => {
  it('uses all raw fields, including conflicts between two nonempty values', () => {
    expect(valuesToReview(group, 1)).toContain('Phone: 222')
    expect(valuesToReview(group, 1)).toContain('Company: Second')
    expect(valuesToReview(group, 1)).toContain('Note: Özel, "not"\nnext line')
    expect(sourceFields(group).find(field => field.field === 'Email')?.differs).toBe(false)
    const audit = parse(exportAuditCSV([group], new Set(['g']), new Set()))
    expect(audit[1]['Values to review']).toBe(valuesToReview(group, 1))
    expect(audit[1]['Source 5: Formula']).toBe("'=1+1")
    expect(audit[1]['Matching score']).not.toMatch(/certain|likely|possible/)
    expect(audit[1]['Audit schema version']).toBe('3')
  })
  it('has no omissions when all source values agree, and marks none on the selected row', () => {
    const identical = { ...group, contacts: [contacts[0], { ...contacts[0], rowIndex: 1 }] }
    expect(sourceFields(identical).every(field => !field.differs)).toBe(true)
    expect(valuesToReview(identical, 1)).toBe('')
    expect(valuesToReview(group, 0)).toBe('')
  })
  it('preserves excluded rows in the CSV and documents original membership', () => {
    const split = setRowSeparate(group, 2, true)
    const rows = parse(exportCleanedCSV([split], [], contacts))
    expect(rows.map(row => row.Note)).toEqual(['', 'Independent'])
    const audit = parse(exportAuditCSV([split], new Set(['g']), new Set()))
    expect(audit.map(row => row['Row outcome'])).toEqual(['kept-selected', 'removed', 'kept-separate'])
    expect(audit[2].Decision).toBe('keep-separate')
    expect(audit[2]['Original group size']).toBe('3')
    expect(audit[2]['Values to review']).toBe('')
    expect(audit[2]['Selected row']).toBe('no')
    expect(audit.every(row => row['Group ID'] === 'g')).toBe(true)
  })
  it('requires a fresh explicit choice after excluding the selected row', () => {
    const split = setRowSeparate(group, 0, true)
    expect(split.needsSelection).toBe(true)
    expect(parse(exportCleanedCSV([split], [], contacts))).toHaveLength(3)
    const audit = parse(exportAuditCSV([split], new Set(['g']), new Set()))
    expect(audit.every(row => row['Selected row'] === 'no')).toBe(true)
    expect(audit.every(row => row['Row outcome'] !== 'removed')).toBe(true)
    const chosen = selectGroupRow(split, 2)
    expect(chosen.needsSelection).toBe(false)
    expect(parse(exportCleanedCSV([chosen], [], contacts)).map(row => row.Note)).toEqual(['', 'Independent'])
  })
  it('rejects excluded/nonexistent selection and refuses to leave a one-row group', () => {
    const split = setRowSeparate(group, 2, true)
    expect(selectGroupRow(split, 2)).toBe(split)
    expect(selectGroupRow(split, 99)).toBe(split)
    expect(setRowSeparate(split, 1, true)).toBe(split)
    expect(setRowSeparate(split, 99, true)).toBe(split)
    const restored = setRowSeparate(split, 2, false)
    expect(activeContacts(restored)).toHaveLength(3)
    expect(restored.contacts).toBe(group.contacts)
  })
  it('keeps all unapproved rows and all separately kept rows exactly once', () => {
    const split = setRowSeparate(group, 2, true)
    const audit = parse(exportAuditCSV([split], new Set(['g']), new Set(['g'])))
    expect(audit.map(row => row.Decision)).toEqual(['keep-all-rows', 'keep-all-rows', 'keep-separate'])
    const rows = parse(exportCleanedCSV([split], [contacts[2]], contacts))
    expect(rows).toHaveLength(2)
  })
  it('removes excluded matching pairs from the explanation', () => {
    const linked = { ...group, pairs: [{ contactA: contacts[0], contactB: contacts[2], scores: { email: 1, firstName: 1, lastName: 1, company: 0, phone: 0 }, riskLevel: 'certain' as const, weightedScore: 100 }] }
    const remaining = effectiveGroup(setRowSeparate(linked, 2, true))
    expect(remaining.pairs).toEqual([])
    expect(remaining.riskScore).toBe(0)
  })
})
