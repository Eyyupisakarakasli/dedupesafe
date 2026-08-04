import type { Contact, DuplicateGroup } from './types'

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
  const membersInGroups = new Set(groups.flatMap(g => g.contacts.map(c => c.rowIndex)))
  const deduplicated = [
    ...groups.map(g => g.masterContact),
    ...uniqueContacts.filter(c => !membersInGroups.has(c.rowIndex)),
  ].sort((a, b) => a.rowIndex - b.rowIndex)

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

export function buildMergeSuggestions(group: DuplicateGroup): string[] {
  const suggestions: string[] = []
  const master = group.masterContact

  for (const contact of group.contacts) {
    if (contact.rowIndex === master.rowIndex) continue
    const diffs: string[] = []

    if (contact.firstName && !master.firstName) diffs.push(`first name "${contact.firstName}"`)
    if (contact.lastName && !master.lastName) diffs.push(`last name "${contact.lastName}"`)
    if (contact.phone && !master.phone) diffs.push(`phone ${contact.phone}`)
    if (contact.company && !master.company) diffs.push(`company "${contact.company}"`)
    if (contact.email && contact.email !== master.email) diffs.push(`alternative email ${contact.email}`)

    if (diffs.length > 0) {
      const label = contact.email || `${contact.firstName} ${contact.lastName}`.trim() || `row ${contact.rowIndex + 2}`
      suggestions.push(`From ${label}: add ${diffs.join(', ')}`)
    }
  }

  return suggestions
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
