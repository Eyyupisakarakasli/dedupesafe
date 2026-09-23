import type { DuplicateGroup } from './types'

/** Describe one actual linked pair; never imply every row shares its signals. */
export function reviewSummary(group: DuplicateGroup): string {
  if (group.riskLevel === 'review') return 'Name-based suggestion. Verify the identity before keeping one row.'
  const pair = group.pairs.reduce<DuplicateGroup['pairs'][number] | undefined>(
    (best, current) => !best || current.weightedScore > best.weightedScore ? current : best,
    undefined,
  )
  if (!pair) return 'Compare the original values before deciding.'
  const signals: string[] = []
  const present = (field: keyof typeof pair.scores) => Boolean(pair.contactA[field] && pair.contactB[field])
  if (present('email') && pair.scores.email >= 0.6) signals.push('similar email addresses')
  if (present('phone') && pair.scores.phone >= 0.9) signals.push('matching phone numbers')
  if (present('firstName') && present('lastName') && pair.scores.firstName >= 0.8 && pair.scores.lastName >= 0.8) signals.push('similar names')
  if (present('company') && pair.scores.company >= 0.8) signals.push('similar company names')
  const prefix = group.contacts.length > 2
    ? `Rows ${pair.contactA.rowIndex + 2} and ${pair.contactB.rowIndex + 2}: `
    : 'Matching signals: '
  return signals.length ? prefix + signals.join(', ') + '.' : 'Compare the original values before deciding.'
}
