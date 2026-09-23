import { describe, expect, it } from 'vitest'
import {
  jaroWinkler, emailSimilarity, phoneSimilarity, companySimilarity,
  compareContacts, findDuplicateGroups,
} from '../src/core/matcher'
import { detectHubSpotMapping, normalizeContacts, looksLikeContactExport } from '../src/core/csv'
import { exportAuditCSV, exportCleanedCSV } from '../src/core/export'
import type { Contact, DuplicateGroup } from '../src/core/types'

function makeContact(overrides: Partial<Contact> & { rowIndex: number }): Contact {
  return { email: '', firstName: '', lastName: '', phone: '', company: '', raw: {}, ...overrides }
}

describe('jaroWinkler', () => {
  it('scores identical and empty strings', () => {
    expect(jaroWinkler('John', 'John')).toBe(1)
    expect(jaroWinkler('', 'x')).toBe(0)
    expect(jaroWinkler('John', '')).toBe(0)
  })

  it('is case-insensitive so ALL-CAPS imports still match', () => {
    expect(jaroWinkler('JOHN', 'john')).toBe(1)
    expect(jaroWinkler('Smith', 'SMITH')).toBe(1)
  })

  it('rates similar names high and unrelated names low', () => {
    expect(jaroWinkler('Jon', 'John')).toBeGreaterThan(0.7)
    expect(jaroWinkler('Smith', 'Smyth')).toBeGreaterThan(0.7)
    expect(jaroWinkler('Alice', 'Bob')).toBeLessThan(0.5)
  })

  it('only applies the prefix bonus to already-similar strings', () => {
    // "al" vs "alexander" must not be inflated into a match.
    expect(jaroWinkler('al', 'alexander')).toBeLessThan(0.8)
  })
})

describe('emailSimilarity', () => {
  it('treats an identical address, or a +tag variant, as the same mailbox', () => {
    expect(emailSimilarity('a@x.com', 'a@x.com')).toBe(1)
    expect(emailSimilarity('john@x.com', 'john+hubspot@x.com')).toBeGreaterThanOrEqual(0.95)
  })

  it('matches bare handle against its own first.last form', () => {
    expect(emailSimilarity('john@acme.com', 'john.smith@acme.com')).toBeGreaterThanOrEqual(0.85)
    expect(emailSimilarity('j.smith@acme.com', 'john.smith@acme.com')).toBeGreaterThanOrEqual(0.85)
    expect(emailSimilarity('johnsmith@acme.com', 'john.smith@acme.com')).toBeGreaterThanOrEqual(0.85)
  })

  it('REJECTS two different people who share a first name (regression)', () => {
    expect(emailSimilarity('john.smith@acme.com', 'john.doe@acme.com')).toBe(0)
    expect(emailSimilarity('mustafa.yilmaz@x.com', 'mustafa.yildirim@x.com')).toBe(0)
    expect(emailSimilarity('ali.kaya@firma.com', 'ali.demir@firma.com')).toBe(0)
  })

  it('does not treat a role mailbox as a person (regression)', () => {
    // info@ and info.sales@ are two inboxes, not one duplicated contact.
    expect(emailSimilarity('info@acme.com', 'info.sales@acme.com')).toBe(0)
    expect(emailSimilarity('sales@acme.com', 'sales.eu@acme.com')).toBe(0)
    expect(emailSimilarity('bilgi@firma.com', 'bilgi.destek@firma.com')).toBe(0)
    // …but a real first name still links to its first.last form.
    expect(emailSimilarity('john@acme.com', 'john.smith@acme.com')).toBeGreaterThanOrEqual(0.85)
  })

  it('rejects unrelated local parts and unrelated domains', () => {
    expect(emailSimilarity('john@acme.com', 'johnson@acme.com')).toBe(0)
    expect(emailSimilarity('alice@a.com', 'bob@b.com')).toBe(0)
  })

  it('links the same handle across providers (work + personal)', () => {
    expect(emailSimilarity('john.smith@acme.com', 'john.smith@gmail.com')).toBeGreaterThan(0)
  })
})

describe('phoneSimilarity', () => {
  it('matches identical numbers and country-code variants', () => {
    expect(phoneSimilarity('+15550101234', '+15550101234')).toBe(1)
    expect(phoneSimilarity('+905321112233', '00905321112233')).toBeGreaterThanOrEqual(0.9)
  })

  it('ignores short fragments that would collide by chance', () => {
    expect(phoneSimilarity('1234', '+15551234')).toBe(0)
    expect(phoneSimilarity('', '+15551234')).toBe(0)
  })
})

describe('companySimilarity', () => {
  it('ignores legal suffixes', () => {
    expect(companySimilarity('Acme Corp', 'ACME Corporation')).toBe(1)
    expect(companySimilarity('Example LLC', 'Example Ltd')).toBe(1)
  })

  it('does not match a short name against a longer one that contains it', () => {
    expect(companySimilarity('Meta', 'Metamask')).toBe(0)
    expect(companySimilarity('Acme', 'Acme Labs Industries')).toBe(0)
  })

  it('scores unrelated companies at zero', () => {
    expect(companySimilarity('Microsoft', 'Amazon')).toBe(0)
    expect(companySimilarity('Garanti Bankasi', 'Turkcell Iletisim')).toBe(0)
  })
})

describe('compareContacts — requires a strong identifier', () => {
  it('never links on name/company alone', () => {
    const a = makeContact({ lastName: 'Yilmaz', rowIndex: 0 })
    const b = makeContact({ lastName: 'Yilmaz', rowIndex: 1 })
    expect(compareContacts(a, b).weightedScore).toBe(0)

    const c = makeContact({ company: 'Acme', rowIndex: 0 })
    const d = makeContact({ company: 'Acme', rowIndex: 1 })
    expect(compareContacts(c, d).weightedScore).toBe(0)
  })

  it('rejects colleagues who share a first name and employer', () => {
    const a = makeContact({ email: 'mehmet.yilmaz@akbank.com', firstName: 'Mehmet', lastName: 'Yilmaz', company: 'Akbank', rowIndex: 0 })
    const b = makeContact({ email: 'mehmet.demir@akbank.com', firstName: 'Mehmet', lastName: 'Demir', company: 'Akbank', rowIndex: 1 })
    expect(compareContacts(a, b).weightedScore).toBe(0)
  })

  it('rejects two people behind one shared inbox', () => {
    const a = makeContact({ email: 'info@acme.com', firstName: 'Ann', lastName: 'Baker', rowIndex: 0 })
    const b = makeContact({ email: 'info@acme.com', firstName: 'Zed', lastName: 'Kwon', rowIndex: 1 })
    expect(compareContacts(a, b).weightedScore).toBe(0)
  })

  it('rejects colleagues sharing a switchboard number', () => {
    const a = makeContact({ email: 'ann@acme.com', firstName: 'Ann', lastName: 'Baker', phone: '+902123456789', company: 'Acme', rowIndex: 0 })
    const b = makeContact({ email: 'zed@acme.com', firstName: 'Zed', lastName: 'Kwon', phone: '+902123456789', company: 'Acme', rowIndex: 1 })
    expect(compareContacts(a, b).weightedScore).toBe(0)
  })

  it('scores a real duplicate as certain', () => {
    const a = makeContact({ email: 'x@x.com', firstName: 'John', lastName: 'Doe', phone: '+15550101234', company: 'Acme', rowIndex: 0 })
    const b = makeContact({ email: 'x@x.com', firstName: 'John', lastName: 'Doe', phone: '+15550101234', company: 'acme', rowIndex: 1 })
    const result = compareContacts(a, b)
    expect(result.weightedScore).toBeGreaterThanOrEqual(90)
    expect(result.riskLevel).toBe('certain')
  })

  it('matches the same person across ALL-CAPS and mixed-case rows', () => {
    const a = makeContact({ email: 'j@a.com', firstName: 'JOHN', lastName: 'SMITH', phone: '+15550101234', company: 'ACME', rowIndex: 0 })
    const b = makeContact({ email: 'j.smith@a.com', firstName: 'John', lastName: 'Smith', phone: '+15550101234', company: 'Acme', rowIndex: 1 })
    expect(compareContacts(a, b).weightedScore).toBeGreaterThanOrEqual(90)
  })

  it('ranks a work/personal pair above any rejected pair', () => {
    const a = makeContact({ email: 'john.smith@acme.com', firstName: 'John', lastName: 'Smith', phone: '+15550101234', rowIndex: 0 })
    const b = makeContact({ email: 'jsmith@gmail.com', firstName: 'John', lastName: 'Smith', phone: '+15550101234', rowIndex: 1 })
    expect(compareContacts(a, b).weightedScore).toBeGreaterThanOrEqual(90)
  })

  it('never reports a score above 100', () => {
    const a = makeContact({ email: 'x@x.com', rowIndex: 0 })
    const b = makeContact({ email: 'x@x.com', rowIndex: 1 })
    expect(compareContacts(a, b).weightedScore).toBeLessThanOrEqual(100)
  })
})

describe('findDuplicateGroups', () => {
  it('returns empty for a single contact', () => {
    const contacts = [makeContact({ email: 'a@a.com', firstName: 'A', rowIndex: 0 })]
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(0)
    expect(uniqueContacts).toHaveLength(1)
  })

  it('groups contacts sharing an email', () => {
    const contacts = [
      makeContact({ email: 'dup@test.com', firstName: 'John', lastName: 'Doe', phone: '+15550101234', company: 'Acme Corp', rowIndex: 0 }),
      makeContact({ email: 'dup@test.com', firstName: 'John', lastName: 'Doe', phone: '+15550102345', company: 'ACME Corporation', rowIndex: 1 }),
    ]
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(1)
    expect(groups[0].contacts).toHaveLength(2)
    expect(uniqueContacts).toHaveLength(0)
  })

  it('groups transitively when every link is real', () => {
    const contacts = [0, 1, 2].map(i => makeContact({
      email: 'same@test.com', firstName: 'A', lastName: 'One', phone: `+1555010${i}234`, company: 'X', rowIndex: i,
    }))
    expect(findDuplicateGroups(contacts).groups[0].contacts).toHaveLength(3)
  })

  it('does not use a sparse contact to bridge conflicting surnames', () => {
    const contacts = [
      makeContact({ email: 'info@x.com', firstName: 'Ann', lastName: 'Baker', rowIndex: 0 }),
      makeContact({ email: 'info@x.com', firstName: 'Ann', rowIndex: 1 }),
      makeContact({ email: 'info@x.com', firstName: 'Ann', lastName: 'Kwon', rowIndex: 2 }),
    ]

    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(1)
    expect(groups[0].contacts).toHaveLength(2)
    expect(groups[0].contacts.map(c => c.lastName)).not.toEqual(
      expect.arrayContaining(['Baker', 'Kwon']),
    )
    expect(uniqueContacts).toHaveLength(1)
  })

  it('keeps the conflicting endpoint in a cleaned export', () => {
    const contacts = [
      makeContact({ email: 'info@x.com', firstName: 'Ann', lastName: 'Baker', rowIndex: 0, raw: { Email: 'info@x.com', Last: 'Baker' } }),
      makeContact({ email: 'info@x.com', firstName: 'Ann', rowIndex: 1, raw: { Email: 'info@x.com', Last: '' } }),
      makeContact({ email: 'info@x.com', firstName: 'Ann', lastName: 'Kwon', rowIndex: 2, raw: { Email: 'info@x.com', Last: 'Kwon' } }),
    ]

    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    const csv = exportCleanedCSV(groups, uniqueContacts, contacts, ['Email', 'Last'])
    const rows = csv.replace(/^﻿/, '').trim().split('\r\n').slice(1)
    expect(rows).toHaveLength(2)
    expect(csv).toContain('Baker')
    expect(csv).toContain('Kwon')
  })

  it('does NOT merge a company directory into one group (regression)', () => {
    // 60 distinct employees at one employer: 20 first names repeat, every
    // surname/email/phone is unique. Nothing here is a duplicate.
    const first = ['ahmet', 'mehmet', 'ayse', 'fatma', 'mustafa', 'ali', 'zeynep', 'elif', 'emre', 'burak',
      'deniz', 'can', 'ece', 'murat', 'selin', 'okan', 'pelin', 'tolga', 'yasemin', 'kerem']
    const last = ['yilmaz', 'kaya', 'demir', 'sahin', 'celik', 'yildiz', 'ozturk', 'aydin', 'ozdemir', 'arslan',
      'dogan', 'kilic', 'aslan', 'cetin', 'kara', 'koc', 'kurt', 'ozkan', 'simsek', 'polat',
      'korkmaz', 'ozcan', 'acar', 'kaplan', 'bulut', 'yavuz', 'erdogan', 'gunes', 'ozer', 'sen',
      'bozkurt', 'turan', 'aktas', 'cakir', 'avci', 'gul', 'kose', 'eren', 'bilgin', 'sari',
      'duman', 'gokce', 'ates', 'uysal', 'sezer', 'coskun', 'toprak', 'sonmez', 'balci', 'yalcin',
      'gulen', 'ergin', 'ucar', 'ince', 'tekin', 'baran', 'altun', 'akin', 'kartal', 'keskin']
    const staff = Array.from({ length: 60 }, (_, i) => makeContact({
      email: `${first[i % 20]}.${last[i]}@akbank.com`,
      firstName: first[i % 20],
      lastName: last[i],
      phone: `+90532${1000000 + i * 97}`,
      company: 'Akbank',
      rowIndex: i,
    }))
    const { groups, uniqueContacts } = findDuplicateGroups(staff)
    expect(groups).toHaveLength(0)
    expect(uniqueContacts).toHaveLength(60)
  })

  it('keeps unrelated contacts unique', () => {
    const contacts = [
      makeContact({ email: 'unique@test.com', firstName: 'Uno', rowIndex: 0 }),
      makeContact({ email: 'other@test.com', firstName: 'Dos', rowIndex: 1 }),
    ]
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(0)
    expect(uniqueContacts).toHaveLength(2)
  })

  it('picks the most complete record as the one to keep', () => {
    const contacts = [
      makeContact({ email: 'dup@test.com', firstName: 'Alice', rowIndex: 0 }),
      makeContact({ email: 'dup@test.com', firstName: 'Alice', lastName: 'Smith', phone: '+15550101234', company: 'Acme', rowIndex: 1 }),
    ]
    expect(findDuplicateGroups(contacts).groups[0].masterContact.rowIndex).toBe(1)
  })

  it('breaks master ties toward the record carrying more detail', () => {
    const contacts = [
      makeContact({ email: 'dup@test.com', firstName: 'Jon', lastName: 'Smith', phone: '+15550101234', rowIndex: 0 }),
      makeContact({ email: 'dup@test.com', firstName: 'Jonathan', lastName: 'Smith', phone: '+15550101234', rowIndex: 1 }),
    ]
    expect(findDuplicateGroups(contacts).groups[0].masterContact.firstName).toBe('Jonathan')
  })
})

describe('review tier — name-only matches', () => {
  const bob = makeContact({ email: 'bob@global.com', firstName: 'Bob', lastName: 'Johnson', phone: '+15550104111', company: 'Global Inc', rowIndex: 0 })
  const robert = makeContact({ email: 'robert@global.com', firstName: 'Robert', lastName: 'Johnson', phone: '+15550105222', company: 'Global Inc', rowIndex: 1 })

  it('surfaces a nickname pair for review instead of merging it', () => {
    const { groups, reviewGroups } = findDuplicateGroups([bob, robert])
    expect(groups).toHaveLength(0)
    expect(reviewGroups).toHaveLength(1)
    expect(reviewGroups[0].contacts).toHaveLength(2)
    expect(reviewGroups[0].riskLevel).toBe('review')
  })

  it('keeps BOTH review contacts in the export until they are confirmed', () => {
    const { groups, reviewGroups, uniqueContacts } = findDuplicateGroups([bob, robert])
    const headers = ['Email']
    const withRaw = [bob, robert].map(c => ({ ...c, raw: { Email: c.email } }))
    const kept = reviewGroups.flatMap(g => g.contacts).map(c => withRaw[c.rowIndex])
    const csv = exportCleanedCSV(groups, [...uniqueContacts, ...kept], withRaw, headers)
    const rows = csv.replace(/^﻿/, '').trim().split('\r\n').slice(1)
    expect(rows).toHaveLength(2)
  })

  it('needs a shared employer or mail domain, not just a name', () => {
    const elsewhere = makeContact({ ...robert, email: 'robert@othercorp.com', company: 'Other Corp', rowIndex: 1 })
    expect(findDuplicateGroups([bob, elsewhere]).reviewGroups).toHaveLength(0)
  })

  it('does not flag two colleagues who merely share a first name', () => {
    const a = makeContact({ email: 'ahmet.yilmaz@akbank.com', firstName: 'Ahmet', lastName: 'Yilmaz', company: 'Akbank', rowIndex: 0 })
    const b = makeContact({ email: 'ahmet.kaya@akbank.com', firstName: 'Ahmet', lastName: 'Kaya', company: 'Akbank', rowIndex: 1 })
    expect(findDuplicateGroups([a, b]).reviewGroups).toHaveLength(0)
  })

  it('does not flag near-miss surnames as a review pair', () => {
    // "Arslan" and "Aslan" are two ordinary surnames, not a typo of each other.
    const a = makeContact({ email: 'ahmet.arslan@akbank.com', firstName: 'Ahmet', lastName: 'Arslan', company: 'Akbank', rowIndex: 0 })
    const b = makeContact({ email: 'ahmet.aslan@akbank.com', firstName: 'Ahmet', lastName: 'Aslan', company: 'Akbank', rowIndex: 1 })
    expect(findDuplicateGroups([a, b]).reviewGroups).toHaveLength(0)
  })

  it('separates spelling variants from genuinely different first names', () => {
    // first.last addresses, so the email rule stays out of it and the review
    // tier is what decides. Mehmet/Mehmed differ at the end (a variant);
    // Selin/Pelin differ at the start (two names).
    const mk = (fn: string, i: number) => makeContact({
      email: `${fn.toLowerCase()}.yilmaz@akbank.com`,
      firstName: fn, lastName: 'Yilmaz', company: 'Akbank', rowIndex: i,
    })
    expect(findDuplicateGroups([mk('Selin', 0), mk('Pelin', 1)]).reviewGroups).toHaveLength(0)
    expect(findDuplicateGroups([mk('Mehmet', 0), mk('Mehmed', 1)]).reviewGroups).toHaveLength(1)
  })

  it('never puts a contact in both a confirmed group and a review group', () => {
    const dup = makeContact({ ...bob, email: 'bob@global.com', rowIndex: 2 })
    const { groups, reviewGroups } = findDuplicateGroups([bob, robert, dup])
    const inGroups = new Set(groups.flatMap(g => g.contacts.map(c => c.rowIndex)))
    for (const g of reviewGroups) {
      for (const c of g.contacts) expect(inGroups.has(c.rowIndex)).toBe(false)
    }
  })
})

describe('detectHubSpotMapping', () => {
  it('detects a standard export', () => {
    const mapping = detectHubSpotMapping(['Email', 'First Name', 'Last Name', 'Phone Number', 'Company Name', 'Lifecycle Stage'])
    expect(mapping).toEqual({
      email: 'Email', firstName: 'First Name', lastName: 'Last Name',
      phone: 'Phone Number', company: 'Company Name',
    })
  })

  it('is not fooled by lookalike metadata columns (regression)', () => {
    const mapping = detectHubSpotMapping([
      'Record ID', 'Email Hard Bounce Reason', 'Email Domain',
      'Marketing email confirmation status', 'First Name', 'Last Name', 'Email', 'Phone Number',
    ])
    expect(mapping.email).toBe('Email')
  })

  it('falls back to a real email column when there is no exact match', () => {
    expect(detectHubSpotMapping(['Email Hard Bounce Reason', 'Contact Email']).email).toBe('Contact Email')
  })

  it('handles alternative and localised spellings', () => {
    expect(detectHubSpotMapping(['Email', 'Mobile']).phone).toBe('Mobile')
    expect(detectHubSpotMapping(['Email', 'Organisation']).company).toBe('Organisation')
    const tr = detectHubSpotMapping(['E-Posta', 'Ad', 'Soyad', 'Telefon', 'Firma'])
    expect(tr.email).toBe('E-Posta')
    expect(tr.lastName).toBe('Soyad')
  })

  it('maps nothing for a non-contact CSV and reports it', () => {
    const mapping = detectHubSpotMapping(['a', 'b', 'c'])
    expect(mapping.email).toBeNull()
    expect(looksLikeContactExport(mapping)).toBe(false)
  })

  it('never assigns one column to two fields', () => {
    const mapping = detectHubSpotMapping(['Name', 'Value'])
    const used = Object.values(mapping).filter(Boolean)
    expect(new Set(used).size).toBe(used.length)
  })
})

describe('normalizeContacts', () => {
  it('lowercases email/company and keeps display casing for names', () => {
    const rows = [{ Email: 'John@ACME.com', 'First Name': 'JOHN', 'Last Name': 'Smith', 'Company Name': 'Acme Corp' }]
    const contacts = normalizeContacts(rows, {
      email: 'Email', firstName: 'First Name', lastName: 'Last Name', phone: null, company: 'Company Name',
    })
    expect(contacts[0].email).toBe('john@acme.com')
    expect(contacts[0].company).toBe('acme corp')
    expect(contacts[0].firstName).toBe('JOHN')
  })

  it('strips phone extensions instead of merging them into the number', () => {
    const mapping = { email: null, firstName: null, lastName: null, phone: 'P', company: null }
    expect(normalizeContacts([{ P: '+1 (555) 010-1234 ext. 22' }], mapping)[0].phone).toBe('+15550101234')
    expect(normalizeContacts([{ P: '5550101234 x99' }], mapping)[0].phone).toBe('5550101234')
  })

  it('normalises unicode so composed and decomposed names match', () => {
    const mapping = { email: null, firstName: 'N', lastName: null, phone: null, company: null }
    const composed = normalizeContacts([{ N: 'José' }], mapping)[0].firstName
    const decomposed = normalizeContacts([{ N: 'José' }], mapping)[0].firstName
    expect(composed).toBe(decomposed)
  })

  it('survives a column named __proto__ instead of throwing', () => {
    const row: Record<string, string> = Object.create(null)
    row['Email'] = 'a@a.com'
    const mapping = { email: '__proto__', firstName: null, lastName: null, phone: null, company: null }
    expect(() => normalizeContacts([row], mapping)).not.toThrow()
    expect(normalizeContacts([row], mapping)[0].email).toBe('')
  })
})

describe('exportCleanedCSV', () => {
  const headers = ['Email', 'Name']
  const contacts = [
    makeContact({ email: 'keep@test.com', rowIndex: 0, raw: { Email: 'keep@test.com', Name: 'Keep' } }),
    makeContact({ email: 'dup@test.com', firstName: 'A', rowIndex: 1, raw: { Email: 'dup@test.com', Name: 'A' } }),
    makeContact({ email: 'dup@test.com', firstName: 'A', rowIndex: 2, raw: { Email: 'dup@test.com', Name: 'A' } }),
  ]

  function dataRows(csv: string): string[] {
    return csv.replace(/^﻿/, '').trim().split('\r\n').slice(1)
  }

  it('keeps every contact that is not a removed duplicate', () => {
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    const csv = exportCleanedCSV(groups, uniqueContacts, contacts, headers)
    // 3 contacts, one duplicate pair collapsed to its master => 2 rows.
    expect(dataRows(csv)).toHaveLength(2)
    expect(csv).toContain('keep@test.com')
  })

  it('loses nothing when there are no duplicates', () => {
    const solo = [
      makeContact({ email: 'a@a.com', rowIndex: 0, raw: { Email: 'a@a.com', Name: 'A' } }),
      makeContact({ email: 'b@b.com', rowIndex: 1, raw: { Email: 'b@b.com', Name: 'B' } }),
    ]
    const { groups, uniqueContacts } = findDuplicateGroups(solo)
    expect(dataRows(exportCleanedCSV(groups, uniqueContacts, solo, headers))).toHaveLength(2)
  })

  it('neutralises formula injection in cells AND headers', () => {
    const evil = [makeContact({
      email: 'a@a.com', rowIndex: 0,
      raw: { '=cmd|calc': 'x', F: '=SUM(A1)', A: '@echo', H: '+HYPERLINK("http://evil")' },
    })]
    const csv = exportCleanedCSV([], evil, evil, ['=cmd|calc', 'F', 'A', 'H'])
    expect(csv).toContain("'=cmd|calc")
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain("'@echo")
    expect(csv).toContain("'+HYPERLINK")
  })

  it('leaves phone numbers and negative numbers untouched', () => {
    const rows = [makeContact({ email: 'a@a.com', rowIndex: 0, raw: { P: '+90 555 123 45 67', N: '-5' } })]
    const csv = exportCleanedCSV([], rows, rows, ['P', 'N'])
    expect(csv).toContain('+90 555 123 45 67')
    expect(csv).not.toContain("'+90")
    expect(csv).toContain('-5')
  })

  it('quotes commas, quotes and carriage returns', () => {
    const rows = [makeContact({ email: 'a@a.com', rowIndex: 0, raw: { A: 'x,y', B: 'he "said"', C: 'l1\rl2' } })]
    const csv = exportCleanedCSV([], rows, rows, ['A', 'B', 'C'])
    expect(csv).toContain('"x,y"')
    expect(csv).toContain('"he ""said"""')
    expect(csv).toContain('"l1\rl2"')
  })

  it('emits a BOM and CRLF so Excel reads UTF-8 correctly', () => {
    const rows = [makeContact({ email: 'a@a.com', rowIndex: 0, raw: { A: 'Şahin' } })]
    const csv = exportCleanedCSV([], rows, rows, ['A'])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain('\r\n')
  })

  it('preserves the original column order', () => {
    const rows = [makeContact({ email: 'a@a.com', rowIndex: 0, raw: { B: '1', A: '2' } })]
    const csv = exportCleanedCSV([], rows, rows, ['A', 'B'])
    expect(csv.replace(/^﻿/, '').split('\r\n')[0]).toBe('A,B')
  })
})

describe('exportAuditCSV', () => {
  it('records merge, keep-both and unreviewed decisions separately', () => {
    const makeGroup = (id: string, row: number): DuplicateGroup => {
      const contacts = [
        makeContact({ email: `${id}-a@example.com`, rowIndex: row }),
        makeContact({ email: `${id}-b@example.com`, rowIndex: row + 1 }),
      ]
      return {
        id,
        contacts,
        masterContact: contacts[0],
        pairs: [],
        riskScore: 80,
        riskLevel: 'likely',
      }
    }
    const groups = [makeGroup('merge-me', 0), makeGroup('keep-me', 2), makeGroup('review-me', 4)]
    const csv = exportAuditCSV(groups, new Set(['merge-me']), new Set(['keep-me']))

    expect(csv).toContain('merge-me,keep-one-row')
    expect(csv).toContain('keep-me,keep-all-rows')
    expect(csv).toContain('review-me,unreviewed')
  })
})

describe('review tier — international name forms', () => {
  const pair = (aFirst: string, bFirst: string, last: string, domain: string) => [
    makeContact({ email: `a@${domain}`, firstName: aFirst, lastName: last, company: 'Same Co', rowIndex: 0 }),
    makeContact({ email: `b@${domain}`, firstName: bFirst, lastName: last, company: 'Same Co', rowIndex: 1 }),
  ]

  it('links a Slavic form to its English short form through the shared full name', () => {
    // katarina and kate sit in different rows of the table and only meet
    // because both rows contain katherine. This is the union step.
    const { reviewGroups } = findDuplicateGroups(pair('Katarina', 'Kate', 'Novak', 'umbrella.co'))

    expect(reviewGroups).toHaveLength(1)
  })

  it('links a cross-language equivalent of the same name', () => {
    const { reviewGroups } = findDuplicateGroups(pair('Guillermo', 'William', 'Ruiz', 'vertex.es'))

    expect(reviewGroups).toHaveLength(1)
  })

  it('reaches an ASCII table entry from a name written with diacritics', () => {
    // Contact text keeps its diacritics, so "Hüseyin" only finds the huseyin
    // row because the lookup folds both sides.
    const { reviewGroups } = findDuplicateGroups(pair('Hüseyin', 'Huso', 'Demir', 'atlas.com.tr'))

    expect(reviewGroups).toHaveLength(1)
  })

  it('still separates two ordinary names that differ at the start', () => {
    const { groups, reviewGroups } = findDuplicateGroups(pair('Selin', 'Pelin', 'Kaya', 'nova.io'))

    expect(groups).toHaveLength(0)
    expect(reviewGroups).toHaveLength(0)
  })

  it('does not let the merged table connect two unrelated names', () => {
    const { groups, reviewGroups } = findDuplicateGroups(pair('Katarina', 'Guillermo', 'Novak', 'umbrella.co'))

    expect(groups).toHaveLength(0)
    expect(reviewGroups).toHaveLength(0)
  })
})

describe('folded surnames', () => {
  const pair = (aFirst: string, aLast: string, bFirst: string, bLast: string) => [
    makeContact({ firstName: aFirst, lastName: aLast, company: 'acme', rowIndex: 0 }),
    makeContact({ firstName: bFirst, lastName: bLast, company: 'acme', rowIndex: 1 }),
  ]

  it('reviews one surname written with and without diacritics', () => {
    const { reviewGroups } = findDuplicateGroups(pair('Mehmet', 'Öztürk', 'Memo', 'Ozturk'))

    expect(reviewGroups).toHaveLength(1)
    expect(reviewGroups[0].contacts).toHaveLength(2)
  })

  it('still separates two different surnames that fold to different keys', () => {
    const { groups, reviewGroups } = findDuplicateGroups(pair('Mehmet', 'Öztürk', 'Memo', 'Yılmaz'))

    expect(groups).toHaveLength(0)
    expect(reviewGroups).toHaveLength(0)
  })

  it('does not read a diacritic as a surname conflict on a shared switchboard', () => {
    const contacts = [
      makeContact({ firstName: 'Ayşe', lastName: 'Şahin', phone: '+902125550101', rowIndex: 0 }),
      makeContact({ firstName: 'Ayse', lastName: 'Sahin', phone: '+902125550101', rowIndex: 1 }),
    ]

    expect(findDuplicateGroups(contacts).groups).toHaveLength(1)
  })
})

describe('employer blocking follows companySimilarity', () => {
  const pair = (aCompany: string, bCompany: string) => [
    makeContact({ firstName: 'Robert', lastName: 'Baker', company: aCompany, rowIndex: 0 }),
    makeContact({ firstName: 'Bob', lastName: 'Baker', company: bCompany, rowIndex: 1 }),
  ]

  it('reviews a nickname pair whose employer differs only in punctuation', () => {
    expect(findDuplicateGroups(pair('acme inc', 'acme, inc.')).reviewGroups).toHaveLength(1)
  })

  it('reviews a nickname pair at an employer written with and without its legal suffix', () => {
    expect(findDuplicateGroups(pair('vertex logistics', 'vertex logistics ltd')).reviewGroups).toHaveLength(1)
  })

  it('does not reach an employer written in long and short form', () => {
    // Blocking keys on the whole stripped employer, so "Northwind" and
    // "Northwind Trading" never meet. Widening the key to a prefix would put
    // every row of a single-employer export in one bucket.
    expect(findDuplicateGroups(pair('northwind', 'northwind trading')).reviewGroups).toHaveLength(0)
  })

  it('leaves a nickname pair at two unrelated employers alone', () => {
    expect(findDuplicateGroups(pair('acme', 'vertex logistics')).reviewGroups).toHaveLength(0)
  })
})

describe('surname change on one personal mailbox', () => {
  const smith = makeContact({ email: 'jane.doe@acme.com', firstName: 'Jane', lastName: 'Smith', rowIndex: 0 })
  const johnson = makeContact({ email: 'jane.doe@acme.com', firstName: 'Jane', lastName: 'Johnson', rowIndex: 1 })

  it('merges two spellings of one person on an identical private address', () => {
    const { groups } = findDuplicateGroups([smith, johnson])

    expect(groups).toHaveLength(1)
    expect(groups[0].contacts).toHaveLength(2)
  })

  it('does not extend that exemption to a role mailbox', () => {
    const a = makeContact({ email: 'sales.team@acme.com', firstName: 'Ann', lastName: 'Baker', rowIndex: 0 })
    const b = makeContact({ email: 'sales.team@acme.com', firstName: 'Ann', lastName: 'Kwon', rowIndex: 1 })

    expect(findDuplicateGroups([a, b]).groups).toHaveLength(0)
  })

  it('does not let the merged group swallow a third person on a shared phone', () => {
    const contacts = [
      makeContact({ ...smith, phone: '+12125550101' }),
      johnson,
      makeContact({ firstName: 'Ann', lastName: 'Kwon', phone: '+12125550101', rowIndex: 2 }),
    ]

    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    expect(groups).toHaveLength(1)
    expect(groups[0].contacts).toHaveLength(2)
    expect(uniqueContacts.map(c => c.lastName)).toEqual(['Kwon'])
  })
})
