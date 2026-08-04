import type { Contact, DuplicateGroup } from './types'

export function exportCleanedCSV(groups: DuplicateGroup[], uniqueContacts: Contact[], allContacts: Contact[]): string {
  const membersInGroups = new Set(groups.flatMap(g => g.contacts.map(c => c.rowIndex)))
  const masterContacts = groups.map(g => g.masterContact)
  const deduplicated = [
    ...masterContacts,
    ...uniqueContacts.filter(c => !membersInGroups.has(c.rowIndex)),
  ].sort((a, b) => a.rowIndex - b.rowIndex)

  // Collect all headers from original rows
  const headerSet = new Set<string>()
  for (const c of allContacts) Object.keys(c.raw).forEach(k => headerSet.add(k))
  const headers = [...headerSet]

  const sanitize = (v: string): string => {
    // Prevent CSV formula injection (CWE-1236): values starting with
    // =, +, -, @, tab, or carriage-return trigger Excel formula execution.
    if (/^[=+\-@\t\r]/.test(v)) return `'${v}`
    return v
  }

  const escape = (v: string) => {
    const safe = sanitize(v)
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
      return `"${safe.replace(/"/g, '""')}"`
    }
    return safe
  }

  const lines = [headers.join(',')]
  for (const c of deduplicated) {
    lines.push(headers.map(h => escape(c.raw[h] ?? '')).join(','))
  }

  return lines.join('\n')
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
      suggestions.push(`Merge from ${contact.email || `row ${contact.rowIndex + 2}`}: add ${diffs.join(', ')}`)
    }
  }

  return suggestions
}

export function downloadFile(content: string, filename: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
