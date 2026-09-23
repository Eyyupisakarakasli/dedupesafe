import { describe, expect, it } from 'vitest'
import { reviewSummary } from '../src/core/review-summary'
import type { Contact, DuplicateGroup } from '../src/core/types'

const a: Contact = { email: 'a@example.com', phone: '', firstName: 'Alex', lastName: 'Lee', company: '', raw: {}, rowIndex: 0 }
const b: Contact = { ...a, rowIndex: 1 }
const group: DuplicateGroup = {
  id: 'test', contacts: [a, b], masterContact: a, riskScore: 100, riskLevel: 'certain',
  pairs: [{ contactA: a, contactB: b, scores: { email: 1, phone: 1, firstName: 1, lastName: 1, company: 1 }, weightedScore: 100, riskLevel: 'certain' }],
}

describe('review explanations', () => {
  it('does not describe missing values as matching evidence even if their comparator score is high', () => {
    const text = reviewSummary(group)
    expect(text).toContain('similar email addresses')
    expect(text).toContain('similar names')
    expect(text).not.toContain('phone')
    expect(text).not.toContain('company')
  })
  it('identifies the actual pair in a connected group instead of attributing its signals to every row', () => {
    const text = reviewSummary({ ...group, contacts: [a, b, { ...a, email: 'different@example.com', rowIndex: 2 }] })
    expect(text).toMatch(/^Rows 2 and 3:/)
  })
  it('never fabricates identifier evidence for a name-based review group', () => {
    expect(reviewSummary({ ...group, riskLevel: 'review', pairs: [] })).toBe('Name-based suggestion. Verify the identity before keeping one row.')
  })
})
