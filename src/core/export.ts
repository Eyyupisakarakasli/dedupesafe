import type { Contact, DuplicateGroup } from './types'
import { activeContacts, effectiveGroup, sourceFields } from './review-state'

/**
 * Neutralise CSV formula injection (CWE-1236). Spreadsheets execute a cell that
 * starts with =, +, -, @, tab or CR, so those get an apostrophe prefix — except
 * values that are plainly numeric or a phone number, which must survive intact.
 */
function sanitizeCell(v: string): string {
  if (/^[=@\t\r]/.test(v)) return `'${v}`
  if (/^[+-]/.test(v) && !/^[+-]?[\d\s().-]+$/.test(v)) return `'${v}`
  return v
}

function escapeCell(v: string): string {
  const safe = sanitizeCell(v)
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/**
 * @param headers Original column order. Falls back to the order keys appear in
 *                the data, which is only stable when every row has every column.
 */
export function exportCleanedCSV(
  groups: DuplicateGroup[],
  uniqueContacts: Contact[],
  allContacts: Contact[],
  headers?: string[],
): string {
  const approved = groups.filter(group => !group.needsSelection && activeContacts(group).length >= 2)
  const membersInGroups = new Set(approved.flatMap(group => activeContacts(group).map(contact => contact.rowIndex)))
  const protectedRows = groups.flatMap(group => group.needsSelection
    ? group.contacts
    : group.contacts.filter(contact => group.excludedRows?.includes(contact.rowIndex)))
  const output = [
    ...approved.map(group => group.masterContact),
    ...uniqueContacts.filter(contact => !membersInGroups.has(contact.rowIndex)),
    ...protectedRows,
  ]
  const deduplicated = [...new Map(output.map(contact => [contact.rowIndex, contact])).values()]
    .sort((a, b) => a.rowIndex - b.rowIndex)
  let columns = headers
  if (!columns || columns.length === 0) {
    const headerSet = new Set<string>()
    for (const c of allContacts) for (const k of Object.keys(c.raw)) headerSet.add(k)
    columns = [...headerSet]
  }

  const lines = [columns.map(escapeCell).join(',')]
  for (const c of deduplicated) {
    lines.push(columns.map(h => escapeCell(
      Object.prototype.hasOwnProperty.call(c.raw, h) ? c.raw[h] ?? '' : '',
    )).join(','))
  }

  // BOM + CRLF so Excel opens UTF-8 names correctly.
  return '﻿' + lines.join('\r\n')
}

export type GroupDecision = 'keep-one-row' | 'keep-all-rows' | 'unreviewed' | 'keep-separate'
/**
 * Preserve every source field for every candidate row, including rows removed
 * from the reviewed export. Source columns have a numbered namespace so they
 * cannot collide with metadata or with another source column's label.
 */
export function exportAuditCSV(
  groups: DuplicateGroup[],
  confirmedIds: ReadonlySet<string>,
  dismissedIds: ReadonlySet<string>,
  headers?: string[],
): string {
  const sourceHeaders = [...new Set([
    ...(headers ?? []),
    ...groups.flatMap(g => g.contacts.flatMap(c => Object.keys(c.raw))),
  ])]
  const columns = [
    'Group ID', 'Decision', 'Matching score', 'Row', 'Selected row',
    'Email', 'First name', 'Last name', 'Phone', 'Company', 'Values to review', 'Audit schema version', 'Original group size', 'Row outcome', 'Review actions',
    ...sourceHeaders.map((header, index) => `Source ${index + 1}: ${header}`),
  ]
  const lines = [columns.map(escapeCell).join(',')]

  for (const group of groups) {
    const decision: GroupDecision = dismissedIds.has(group.id)
      ? 'keep-all-rows'
      : confirmedIds.has(group.id) && !group.needsSelection ? 'keep-one-row' : 'unreviewed'
    const omittedByRow = new Map<number, string[]>()
    for (const { field, values } of sourceFields(group)) {
      for (const row of values) {
        if (!row.omitted) continue
        const list = omittedByRow.get(row.rowIndex) ?? []
        list.push(field + ': ' + row.value)
        omittedByRow.set(row.rowIndex, list)
      }
    }
    const compared = effectiveGroup(group)
    for (const contact of group.contacts) {
      const separate = Boolean(group.excludedRows?.includes(contact.rowIndex))
      const selected = !group.needsSelection && !separate && contact.rowIndex === group.masterContact.rowIndex
      const rowDecision = separate ? 'keep-separate' : decision
      const outcome = separate ? 'kept-separate' : decision === 'keep-one-row'
        ? selected ? 'kept-selected' : 'removed' : 'kept'
      lines.push([
        group.id,
        rowDecision,
        group.riskLevel === 'review' ? 'name-based suggestion' : compared.pairs.length === 0 && group.excludedRows?.length ? 'No direct pair after exclusion' : String(compared.riskScore) + '/100 comparison score (not a probability)',
        String(contact.rowIndex + 2),
        selected ? 'yes' : 'no',
        contact.email,
        contact.firstName,
        contact.lastName,
        contact.phone,
        contact.company,
        separate ? '' : (omittedByRow.get(contact.rowIndex) ?? []).join(' | '),
        '3',
        String(group.contacts.length),
        outcome,
        (group.reviewActions ?? []).join(' | '),
        ...sourceHeaders.map(header => Object.prototype.hasOwnProperty.call(contact.raw, header)
          ? contact.raw[header] ?? '' : ''),
      ].map(escapeCell).join(','))
    }
  }

  return '\uFEFF' + lines.join('\r\n')
}

export function downloadFile(content: string, filename: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  // Firefox and Safari need the anchor in the document, and revoking the URL
  // synchronously can cancel the download before it starts.
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
