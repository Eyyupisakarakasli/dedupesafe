import { describe, expect, it } from 'vitest'
import { jaroWinkler, compareContacts, findDuplicateGroups } from '../src/core/matcher'
import { detectHubSpotMapping, normalizeContacts, parseCSV } from '../src/core/csv'
import { buildMergeSuggestions, exportCleanedCSV } from '../src/core/export'
import type { Contact } from '../src/core/types'

function makeContact(overrides: Partial<Contact> & { rowIndex: number }): Contact {
  return {
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    raw: {},
    ...overrides,
  }
}

describe('jaroWinkler', () => {
  it('returns 1 for identical non-empty strings, 0 for empty', () => {
    expect(jaroWinkler('John', 'John')).toBe(1)
    expect(jaroWinkler('', 'x')).toBe(0)
  })

  it('returns 0 when one side is empty', () => {
    expect(jaroWinkler('John', '')).toBe(0)
    expect(jaroWinkler('', 'John')).toBe(0)
  })

  it('gives high score for similar names', () => {
    expect(jaroWinkler('Jon', 'John')).toBeGreaterThan(0.7)
    expect(jaroWinkler('Smith', 'Smyth')).toBeGreaterThan(0.7)
  })

  it('gives low score for unrelated names', () => {
    expect(jaroWinkler('Alice', 'Bob')).toBeLessThan(0.5)
    expect(jaroWinkler('Williams', 'Chen')).toBeLessThan(0.5)
  })

  it('handles prefix bonus for matching first chars', () => {
    const withPrefix = jaroWinkler('ab', 'abcdef')
    const noPrefix = jaroWinkler('xy', 'abcdef')
    expect(withPrefix).toBeGreaterThan(noPrefix)
  })
})

describe('compareContacts', () => {
  it('returns certain for identical contact', () => {
    const a = makeContact({ email: 'x@x.com', firstName: 'John', lastName: 'Doe', phone: '+15550101', company: 'Acme', rowIndex: 0 })
    const b = makeContact({ email: 'x@x.com', firstName: 'John', lastName: 'Doe', phone: '+15550101', company: 'acme', rowIndex: 1 })
    const result = compareContacts(a, b)
    expect(result.weightedScore).toBeGreaterThanOrEqual(90)
    expect(result.riskLevel).toBe('certain')
  })

  it('does not inflate score for empty phone/company', () => {
    const a = makeContact({ email: 'a@a.com', firstName: 'A', lastName: 'B', phone: '', company: '', rowIndex: 0 })
    const b = makeContact({ email: 'b@b.com', firstName: 'X', lastName: 'Y', phone: '', company: '', rowIndex: 1 })
    const result = compareContacts(a, b)
    expect(result.weightedScore).toBeLessThan(20)
  })

  it('different email with same name/phone reaches possible', () => {
    const a = makeContact({ email: 'john@old.com', firstName: 'John', lastName: 'Smith', phone: '+15550101', company: 'Acme', rowIndex: 0 })
    const b = makeContact({ email: 'john@new.com', firstName: 'John', lastName: 'Smith', phone: '+15550101', company: 'Acme', rowIndex: 1 })
    const result = compareContacts(a, b)
    expect(result.weightedScore).toBeGreaterThanOrEqual(50)
  })

  it('unrelated contacts are unlikely', () => {
    const a = makeContact({ email: 'a@x.com', firstName: 'Alice', lastName: 'X', phone: '', company: '', rowIndex: 0 })
    const b = makeContact({ email: 'b@y.com', firstName: 'Bob', lastName: 'Y', phone: '+15550102', company: 'Different', rowIndex: 1 })
    const result = compareContacts(a, b)
    expect(result.riskLevel).toBe('unlikely')
  })
})

describe('findDuplicateGroups', () => {
  it('returns empty for single contact', () => {
    const contacts = [makeContact({ email: 'a@a.com', firstName: 'A', rowIndex: 0 })]
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(0)
    expect(uniqueContacts).toHaveLength(1)
  })

  it('groups same email contacts', () => {
    const contacts = [
      makeContact({ email: 'dup@test.com', firstName: 'John', lastName: 'Doe', phone: '+15550101', company: 'Acme Corp', rowIndex: 0 }),
      makeContact({ email: 'dup@test.com', firstName: 'John', lastName: 'Doe', phone: '+15550102', company: 'ACME Corporation', rowIndex: 1 }),
    ]
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(1)
    expect(groups[0].contacts).toHaveLength(2)
    expect(uniqueContacts).toHaveLength(0)
  })

  it('transitively groups A≈B and B≈C', () => {
    const contacts = [
      makeContact({ email: 'same@test.com', firstName: 'A', lastName: 'One', phone: '+15550101', company: 'X', rowIndex: 0 }),
      makeContact({ email: 'same@test.com', firstName: 'A', lastName: 'One', phone: '+15550102', company: 'X', rowIndex: 1 }),
      makeContact({ email: 'same@test.com', firstName: 'A', lastName: 'One', phone: '+15550103', company: 'X', rowIndex: 2 }),
    ]
    const { groups } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(1)
    expect(groups[0].contacts).toHaveLength(3)
  })

  it('keeps unrelated contacts as unique', () => {
    const contacts = [
      makeContact({ email: 'unique@test.com', firstName: 'Uno', rowIndex: 0 }),
      makeContact({ email: 'other@test.com', firstName: 'Dos', rowIndex: 1 }),
    ]
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(0)
    expect(uniqueContacts).toHaveLength(2)
  })

  it('picks most complete record as master', () => {
    const contacts = [
      makeContact({ email: 'dup@test.com', firstName: 'Alice', lastName: '', phone: '', company: '', rowIndex: 0 }),
      makeContact({ email: 'dup@test.com', firstName: 'Alice', lastName: 'Smith', phone: '+15550101', company: 'Acme', rowIndex: 1 }),
    ]
    const { groups } = findDuplicateGroups(contacts)
    expect(groups[0].masterContact.rowIndex).toBe(1)
  })
})

describe('detectHubSpotMapping', () => {
  it('detects standard HubSpot export columns', () => {
    const headers = ['Email', 'First Name', 'Last Name', 'Phone Number', 'Company Name', 'Lifecycle Stage']
    const mapping = detectHubSpotMapping(headers)
    expect(mapping.email).toBe('Email')
    expect(mapping.firstName).toBe('First Name')
    expect(mapping.lastName).toBe('Last Name')
    expect(mapping.phone).toBe('Phone Number')
    expect(mapping.company).toBe('Company Name')
  })

  it('handles alternative column names', () => {
    const headers = ['E-mail', 'Firstname', 'Surname', 'Mobile Phone', 'Organization']
    const mapping = detectHubSpotMapping(headers)
    expect(mapping.email).toBe('E-mail')
    expect(mapping.firstName).toBe('Firstname')
    expect(mapping.lastName).toBe('Surname')
    expect(mapping.phone).toBe('Mobile Phone')
    expect(mapping.company).toBe('Organization')
  })
})

describe('normalizeContacts', () => {
  it('normalizes email to lowercase and strips phone formatting', () => {
    const rows = [{ Email: 'John@ACME.com', 'First Name': 'John', 'Last Name': 'Smith', 'Phone Number': '+1 (555) 0101', 'Company Name': 'Acme Corp' }]
    const mapping = { email: 'Email', firstName: 'First Name', lastName: 'Last Name', phone: 'Phone Number', company: 'Company Name' }
    const contacts = normalizeContacts(rows, mapping)
    expect(contacts[0].email).toBe('john@acme.com')
    expect(contacts[0].phone).toBe('+15550101')
    expect(contacts[0].company).toBe('acme corp')
  })
})

describe('exportCleanedCSV', () => {
  it('produces CSV with headers and deduplicated rows', () => {
    const contacts = [
      makeContact({ email: 'keep@test.com', firstName: 'Keep', rowIndex: 0, raw: { Email: 'keep@test.com', Name: 'Keep' } }),
      makeContact({ email: 'dup@test.com', firstName: 'A', rowIndex: 1, raw: { Email: 'dup@test.com', Name: 'A' } }),
      makeContact({ email: 'dup@test.com', firstName: 'A', rowIndex: 2, raw: { Email: 'dup@test.com', Name: 'A' } }),
    ]
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    const csv = exportCleanedCSV(groups, uniqueContacts, contacts)
    expect(csv).toContain('keep@test.com')
    const lines = csv.trim().split('\n')
    expect(lines.length).toBeGreaterThan(1) // header + at least 1 row
  })
})

describe('buildMergeSuggestions', () => {
  it('suggests merging fields that master is missing', () => {
    const a = makeContact({ email: 'dup@test.com', firstName: 'Alice', lastName: '', phone: '', company: 'Acme', rowIndex: 0 })
    const b = makeContact({ email: 'dup@test.com', firstName: 'Alice', lastName: 'Smith', phone: '+15550101', company: '', rowIndex: 1 })
    const { groups } = findDuplicateGroups([a, b])
    expect(groups.length).toBeGreaterThan(0)
    const suggestions = buildMergeSuggestions(groups[0])
    expect(suggestions.length).toBeGreaterThan(0)
  })

  it('returns empty when no fields to merge', () => {
    const a = makeContact({ email: 'x@x.com', firstName: 'A', rowIndex: 0 })
    const b = makeContact({ email: 'x@x.com', firstName: 'A', rowIndex: 1 })
    const { groups } = findDuplicateGroups([a, b])
    expect(groups.length).toBeGreaterThan(0)
    const suggestions = buildMergeSuggestions(groups[0])
    expect(suggestions).toHaveLength(0)
  })
})