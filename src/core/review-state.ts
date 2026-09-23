import type { Contact, DuplicateGroup } from './types'

export function activeContacts(group: DuplicateGroup): Contact[] {
  const excluded = new Set(group.excludedRows)
  return group.contacts.filter(contact => !excluded.has(contact.rowIndex))
}

export function selectGroupRow(group: DuplicateGroup, rowIndex: number): DuplicateGroup {
  const contact = activeContacts(group).find(row => row.rowIndex === rowIndex)
  return contact ? { ...group, masterContact: contact, needsSelection: false,
    reviewActions: [...(group.reviewActions ?? []), `Select row ${rowIndex + 2}; previous selection ${group.needsSelection ? 'none' : group.masterContact.rowIndex + 2}; approval reset`] } : group
}

export function setRowSeparate(group: DuplicateGroup, rowIndex: number, separate: boolean): DuplicateGroup {
  if (!group.contacts.some(contact => contact.rowIndex === rowIndex)) return group
  const excluded = new Set(group.excludedRows)
  if (separate === excluded.has(rowIndex)) return group
  // A remaining group must still have two rows to compare.
  if (separate && activeContacts(group).length <= 2) return group
  if (separate) excluded.add(rowIndex)
  else excluded.delete(rowIndex)
  const next = { ...group, excludedRows: [...excluded],
    reviewActions: [...(group.reviewActions ?? []), `Row ${rowIndex + 2}: ${separate ? 'kept separately' : 'returned to group'}; approval reset`] }
  if (excluded.has(group.masterContact.rowIndex)) {
    next.masterContact = activeContacts(next)[0]
    next.needsSelection = true
  }
  return next
}

export function effectiveGroup(group: DuplicateGroup): DuplicateGroup {
  if (!group.excludedRows?.length) return group
  const contacts = activeContacts(group)
  const rows = new Set(contacts.map(contact => contact.rowIndex))
  const pairs = group.pairs.filter(pair => rows.has(pair.contactA.rowIndex) && rows.has(pair.contactB.rowIndex))
  return { ...group, contacts, pairs, riskScore: pairs.reduce((score, pair) => Math.max(score, pair.weightedScore), 0) }
}

export function sourceValue(contact: Contact, field: string): string {
  return Object.hasOwn(contact.raw, field) ? contact.raw[field] ?? '' : ''
}

/** One source of truth for UI differences and per-row audit omissions. */
export function sourceFields(group: DuplicateGroup) {
  const contacts = activeContacts(group)
  const fields = [...new Set(contacts.flatMap(contact => Object.keys(contact.raw)))]
  return fields.map(field => {
    const selectedValue = sourceValue(group.masterContact, field)
    const values = contacts.map(contact => {
      const value = sourceValue(contact, field)
      const selected = !group.needsSelection && contact.rowIndex === group.masterContact.rowIndex
      return { rowIndex: contact.rowIndex, value, selected,
        omitted: !group.needsSelection && !selected && value !== '' && value !== selectedValue }
    })
    return { field, values, differs: new Set(values.map(row => row.value)).size > 1 }
  })
}

export function valuesToReview(group: DuplicateGroup, rowIndex: number): string {
  return sourceFields(group).flatMap(({ field, values }) => {
    const row = values.find(value => value.rowIndex === rowIndex)
    return row?.omitted ? [`${field}: ${row.value}`] : []
  }).join(' | ')
}
