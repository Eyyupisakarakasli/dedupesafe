import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResultsStep, type ScanResult } from '../src/App'
import type { Contact, DuplicateGroup } from '../src/core/types'

describe('ResultsStep export controls', () => {
  it('shows the cleaned CSV download after confirming a review-only match', () => {
    const contacts: Contact[] = [
      { email: 'bob@global.com', firstName: 'Bob', lastName: 'Johnson', phone: '', company: 'Global', raw: {}, rowIndex: 0 },
      { email: 'robert@global.com', firstName: 'Robert', lastName: 'Johnson', phone: '', company: 'Global', raw: {}, rowIndex: 1 },
    ]
    const reviewGroup: DuplicateGroup = {
      id: 'review-0',
      contacts,
      masterContact: contacts[1],
      pairs: [],
      riskScore: 0,
      riskLevel: 'review',
    }
    const result: ScanResult = {
      groups: [],
      reviewGroups: [reviewGroup],
      uniqueContacts: [],
      contacts,
      total: contacts.length,
    }

    const html = renderToStaticMarkup(
      <ResultsStep
        result={result}
        headers={['Email']}
        dismissedIds={new Set()}
        confirmedIds={new Set([reviewGroup.id])}
        onDismiss={() => {}}
        onConfirm={() => {}}
        onUnconfirm={() => {}}
        onRestore={() => {}}
        onRestoreAll={() => {}}
        onBack={() => {}}
      />,
    )

    expect(html).toContain('Approved merges (1)')
    expect(html).toContain('Review export')
    expect(html).toContain('removes 1 approved duplicate row')
  })

  it('keeps the export available when every automatic group is dismissed', () => {
    const contacts: Contact[] = [
      { email: 'same@example.com', firstName: 'A', lastName: 'One', phone: '', company: '', raw: {}, rowIndex: 0 },
      { email: 'same@example.com', firstName: 'A', lastName: 'One', phone: '', company: '', raw: {}, rowIndex: 1 },
    ]
    const group: DuplicateGroup = {
      id: 'group-0',
      contacts,
      masterContact: contacts[0],
      pairs: [],
      riskScore: 100,
      riskLevel: 'certain',
    }
    const result: ScanResult = {
      groups: [group],
      reviewGroups: [],
      uniqueContacts: [],
      contacts,
      total: contacts.length,
    }

    const html = renderToStaticMarkup(
      <ResultsStep
        result={result}
        headers={['Email']}
        dismissedIds={new Set([group.id])}
        confirmedIds={new Set()}
        onDismiss={() => {}}
        onConfirm={() => {}}
        onUnconfirm={() => {}}
        onRestore={() => {}}
        onRestoreAll={() => {}}
        onBack={() => {}}
      />,
    )

    expect(html).toContain('Download audit report')
    expect(html).toContain('nothing removed')
  })

  it('keeps every unreviewed automatic group intact by default', () => {
    const contacts: Contact[] = [
      { email: 'same@example.com', firstName: 'A', lastName: 'One', phone: '', company: '', raw: {}, rowIndex: 0 },
      { email: 'same@example.com', firstName: 'A', lastName: 'One', phone: '', company: '', raw: {}, rowIndex: 1 },
    ]
    const group: DuplicateGroup = {
      id: 'group-0', contacts, masterContact: contacts[0], pairs: [], riskScore: 100, riskLevel: 'certain',
    }
    const result: ScanResult = { groups: [group], reviewGroups: [], uniqueContacts: [], contacts, total: 2 }

    const html = renderToStaticMarkup(
      <ResultsStep
        result={result}
        headers={['Email']}
        dismissedIds={new Set()}
        confirmedIds={new Set()}
        onDismiss={() => {}}
        onConfirm={() => {}}
        onUnconfirm={() => {}}
        onRestore={() => {}}
        onRestoreAll={() => {}}
        onBack={() => {}}
      />,
    )

    expect(html).toContain('Awaiting decision')
    expect(html).toContain('nothing removed')
    expect(html).toContain('Merge these')
    expect(html).toContain('Keep both')
  })
})
