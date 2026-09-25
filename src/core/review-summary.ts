import type { DuplicateGroup } from './types'

/** Describe one actual linked pair; never imply every row shares its signals. */
export function reviewSummary(group: DuplicateGroup, translate: (text: string, values?: Record<string, string | number>) => string = (text, values = {}) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))): string {
  if (group.riskLevel === 'review') return translate('Name-based suggestion. Verify the identity before keeping one row.')
  const pair = group.pairs.reduce<DuplicateGroup['pairs'][number] | undefined>(
    (best, current) => !best || current.weightedScore > best.weightedScore ? current : best,
    undefined,
  )
  if (!pair) return translate('Compare the original values before deciding.')
  const signals: string[] = []
  const present = (field: keyof typeof pair.scores) => Boolean(pair.contactA[field] && pair.contactB[field])
  if (present('email') && pair.scores.email >= 0.6) signals.push(translate('similar email addresses'))
  if (present('phone') && pair.scores.phone >= 0.9) signals.push(translate('matching phone numbers'))
  if (present('firstName') && present('lastName') && pair.scores.firstName >= 0.8 && pair.scores.lastName >= 0.8) signals.push(translate('similar names'))
  if (present('company') && pair.scores.company >= 0.8) signals.push(translate('similar company names'))
  const prefix = group.contacts.length > 2
    ? translate('Rows {a} and {b}: ', { a: pair.contactA.rowIndex + 2, b: pair.contactB.rowIndex + 2 })
    : translate('Matching signals: ')
  return signals.length ? prefix + signals.join(', ') + '.' : translate('Compare the original values before deciding.')
}
