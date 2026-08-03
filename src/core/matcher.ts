import type { Contact, DedupeField, DuplicateGroup, SimilarityResult } from './types'

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0

  const aLen = a.length
  const bLen = b.length
  const range = Math.floor(Math.max(aLen, bLen) / 2) - 1
  const rangeClamped = Math.max(0, range)

  const aMatches = new Array<boolean>(aLen).fill(false)
  const bMatches = new Array<boolean>(bLen).fill(false)
  let matchCount = 0

  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - rangeClamped)
    const end = Math.min(bLen, i + rangeClamped + 1)
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matchCount++
      break
    }
  }

  if (matchCount === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }
  transpositions = Math.floor(transpositions / 2)

  const jaro = (matchCount / aLen + matchCount / bLen + (matchCount - transpositions) / matchCount) / 3

  let prefix = 0
  const maxPrefix = 4
  for (let i = 0; i < Math.min(aLen, bLen, maxPrefix); i++) {
    if (a[i] !== b[i]) break
    prefix++
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

function phoneSimilarity(a: string, b: string): number {
  const digitsA = a.replace(/\D/g, '')
  const digitsB = b.replace(/\D/g, '')
  if (!digitsA && !digitsB) return 0
  if (!digitsA || !digitsB) return 0
  if (digitsA === digitsB) return 1

  // Fuzzy phone: last 8 digits match
  const suffixLen = Math.min(8, digitsA.length, digitsB.length)
  return digitsA.slice(-suffixLen) === digitsB.slice(-suffixLen) ? 0.9 : 0
}

function companySimilarity(a: string, b: string): number {
  if (!a && !b) return 0
  if (!a || !b) return 0
  // Strip common suffixes
  const strip = (s: string) => s.replace(/\b(inc|llc|ltd|corp|corporation|co|limited|gmbh|sa|sarl)\b/gi, '').replace(/[^a-z0-9]/g, '').trim()
  const strippedA = strip(a)
  const strippedB = strip(b)
  if (strippedA === strippedB) return 1
  if (strippedA.includes(strippedB) || strippedB.includes(strippedA)) return 0.9
  return jaroWinkler(strippedA, strippedB)
}

const FIELD_WEIGHTS: Record<DedupeField, number> = {
  email: 0.40,
  phone: 0.25,
  firstName: 0.10,
  lastName: 0.15,
  company: 0.10,
}

interface FieldComparator {
  (a: string, b: string): number
}

const COMPARATORS: Record<DedupeField, FieldComparator> = {
  email: (a, b) => a === b ? 1 : 0,
  firstName: jaroWinkler,
  lastName: jaroWinkler,
  phone: phoneSimilarity,
  company: companySimilarity,
}

export function compareContacts(a: Contact, b: Contact): SimilarityResult {
  const scores = {} as Record<DedupeField, number>
  let weightedSum = 0
  let weightSum = 0

  for (const field of Object.keys(FIELD_WEIGHTS) as DedupeField[]) {
    const score = COMPARATORS[field](a[field], b[field])
    scores[field] = score
    weightedSum += score * FIELD_WEIGHTS[field]
    // Only count non-empty fields in the weight sum for both contacts
    if (a[field] || b[field]) weightSum += FIELD_WEIGHTS[field]
  }

  const weightedScore = weightSum > 0 ? Math.round((weightedSum / weightSum) * 100) : 0

  const riskLevel: SimilarityResult['riskLevel'] =
    weightedScore >= 90 ? 'certain' :
    weightedScore >= 70 ? 'likely' :
    weightedScore >= 50 ? 'possible' :
    'unlikely'

  return { contactA: a, contactB: b, scores, weightedScore, riskLevel }
}

function findMasterContact(contacts: Contact[]): Contact {
  // Most complete record = most non-empty fields
  let best = contacts[0]
  let bestScore = 0
  for (const c of contacts) {
    const score =
      (c.email ? 1 : 0) +
      (c.firstName ? 1 : 0) +
      (c.lastName ? 1 : 0) +
      (c.phone ? 1 : 0) +
      (c.company ? 1 : 0)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

export function findDuplicateGroups(contacts: Contact[]): { groups: DuplicateGroup[]; uniqueContacts: Contact[] } {
  if (contacts.length < 2) return { groups: [], uniqueContacts: contacts }

  // Build pairs above threshold
  const threshold = 50
  const pairs: SimilarityResult[] = []
  const indexesInGroup = new Set<number>()

  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      // Skip if neither has email (weak signal)
      if (!contacts[i].email && !contacts[j].email) continue
      const result = compareContacts(contacts[i], contacts[j])
      if (result.weightedScore >= threshold) {
        pairs.push(result)
        indexesInGroup.add(i)
        indexesInGroup.add(j)
      }
    }
  }

  if (pairs.length === 0) return { groups: [], uniqueContacts: contacts }

  // Transitive grouping via union-find
  const parent = contacts.map((_, i) => i)
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  function union(x: number, y: number) {
    parent[find(x)] = find(y)
  }

  for (const pair of pairs) {
    union(pair.contactA.rowIndex, pair.contactB.rowIndex)
  }

  // Collect groups
  const groupMap = new Map<number, { contacts: Set<Contact>; pairs: SimilarityResult[] }>()
  for (const i of indexesInGroup) {
    const root = find(i)
    if (!groupMap.has(root)) groupMap.set(root, { contacts: new Set(), pairs: [] })
    groupMap.get(root)!.contacts.add(contacts[i])
  }

  for (const pair of pairs) {
    const root = find(pair.contactA.rowIndex)
    groupMap.get(root)?.pairs.push(pair)
  }

  const groups: DuplicateGroup[] = []
  for (const [root, data] of groupMap) {
    const contactList = [...data.contacts].sort((a, b) => a.rowIndex - b.rowIndex)
    const master = findMasterContact(contactList)
    const avgRisk = Math.round(data.pairs.reduce((s, p) => s + p.weightedScore, 0) / data.pairs.length)

    groups.push({
      id: `group-${root}`,
      contacts: contactList,
      masterContact: master,
      pairs: data.pairs,
      riskScore: avgRisk,
      riskLevel: avgRisk >= 90 ? 'certain' : avgRisk >= 70 ? 'likely' : 'possible',
    })
  }

  // Sort: highest risk first
  groups.sort((a, b) => b.riskScore - a.riskScore)

  const membersInGroups = new Set(groups.flatMap(g => g.contacts.map(c => c.rowIndex)))
  const uniqueContacts = contacts.filter(c => !membersInGroups.has(c.rowIndex))

  return { groups, uniqueContacts }
}
