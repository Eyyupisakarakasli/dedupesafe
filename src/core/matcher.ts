import type { Contact, DedupeField, DuplicateGroup, SimilarityResult } from './types'

export function jaroWinkler(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

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

  // Gate prefix bonus on jaro >= 0.7
  if (jaro < 0.7) return jaro

  let prefix = 0
  const maxPrefix = 4
  for (let i = 0; i < Math.min(aLen, bLen, maxPrefix); i++) {
    if (a[i] !== b[i]) break
    prefix++
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

function emailSimilarity(a: string, b: string): number {
  if (!a && !b) return 0
  if (!a || !b) return 0
  if (a === b) return 1

  const [localA, domainA] = a.split('@')
  const [localB, domainB] = b.split('@')
  if (!localA || !localB || !domainA || !domainB) return 0

  // Same domain + similar local-part (typical for name variants)
  if (domainA === domainB) {
    // Dot-separated prefix: john.smith → john matches john
    const prefixA = localA.split('.')[0]
    const prefixB = localB.split('.')[0]
    if (prefixA === prefixB) return 0.85

    // Dot/hyphen/underscore-stripped equality
    if (localA.replace(/[._-]/g, '') === localB.replace(/[._-]/g, '')) return 0.85

    // Jaro-Winkler with high threshold
    const localSim = jaroWinkler(localA, localB)
    if (localSim >= 0.92) return 0.80

    return 0
  }

  return 0
}

function phoneSimilarity(a: string, b: string): number {
  const digitsA = a.replace(/\D/g, '')
  const digitsB = b.replace(/\D/g, '')
  if (!digitsA && !digitsB) return 0
  if (!digitsA || !digitsB) return 0
  if (digitsA === digitsB) return 1

  // Fuzzy phone: last 8 digits match (minimum 6 digit length)
  const minLen = Math.min(digitsA.length, digitsB.length)
  if (minLen < 6) return 0
  const suffixLen = Math.min(8, minLen)
  return digitsA.slice(-suffixLen) === digitsB.slice(-suffixLen) ? 0.85 : 0
}

function companySimilarity(a: string, b: string): number {
  if (!a && !b) return 0
  if (!a || !b) return 0
  const strip = (s: string) => {
    const lower = s.toLowerCase()
    return lower
      .replace(/\b(inc|llc|ltd|corp|corporation|co|limited|gmbh|sa|sarl)\b/gi, '')
      .replace(/[^a-z0-9\u00C0-\u024F]/g, '')
      .trim()
  }
  const strippedA = strip(a)
  const strippedB = strip(b)
  if (!strippedA && !strippedB) return 0
  if (!strippedA || !strippedB) return 0
  if (strippedA === strippedB) return 1
  if (strippedA.includes(strippedB) || strippedB.includes(strippedA)) return 0.9
  return jaroWinkler(strippedA, strippedB)
}

const FIELD_WEIGHTS: Record<DedupeField, number> = {
  email: 0.35,
  phone: 0.25,
  firstName: 0.10,
  lastName: 0.15,
  company: 0.15,
}

type FieldComparator = (a: string, b: string) => number

const COMPARATORS: Record<DedupeField, FieldComparator> = {
  email: emailSimilarity,
  firstName: jaroWinkler,
  lastName: jaroWinkler,
  phone: phoneSimilarity,
  company: companySimilarity,
}

export function compareContacts(a: Contact, b: Contact): SimilarityResult {
  const scores = {} as Record<DedupeField, number>
  let weightedSum = 0
  let weightSum = 0
  let positiveFields = 0

  for (const field of Object.keys(FIELD_WEIGHTS) as DedupeField[]) {
    const valA = a[field]
    const valB = b[field]
    // Skip field entirely when either side is empty
    if (!valA || !valB) {
      scores[field] = 0
      continue
    }
    const score = COMPARATORS[field](valA, valB)
    scores[field] = score
    weightedSum += score * FIELD_WEIGHTS[field]
    weightSum += FIELD_WEIGHTS[field]
    if (score > 0) positiveFields++
  }

  // Require minimum signal: at least 2 fields with positive scores
  // and total weight >= 0.40 (prevents single-field matches like surname-only)
  if (positiveFields < 2 || weightSum < 0.40) {
    return {
      contactA: a, contactB: b,
      scores: scores as Record<DedupeField, number>,
      weightedScore: 0,
      riskLevel: 'unlikely',
    }
  }

  const weightedScore = Math.min(100, Math.round((weightedSum / weightSum) * 100))

  const riskLevel: SimilarityResult['riskLevel'] =
    weightedScore >= 90 ? 'certain' :
    weightedScore >= 70 ? 'likely' :
    weightedScore >= 50 ? 'possible' :
    'unlikely'

  return { contactA: a, contactB: b, scores, weightedScore, riskLevel }
}

function findMasterContact(contacts: Contact[]): Contact {
  let best = contacts[0]
  let bestScore = 0
  for (const c of contacts) {
    const score =
      (c.email ? 1 : 0) +
      (c.firstName ? 1 : 0) +
      (c.lastName ? 1 : 0) +
      (c.phone ? 1 : 0) +
      (c.company ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = c }
  }
  return best
}

export function findDuplicateGroups(contacts: Contact[]): { groups: DuplicateGroup[]; uniqueContacts: Contact[] } {
  if (contacts.length < 2) return { groups: [], uniqueContacts: contacts }

  // Blocking-cost guard: pre-index contacts by email domain + last-name initial + phone suffix
  const domainMap = new Map<string, number[]>()
  const lastNameMap = new Map<string, number[]>()
  const phoneMap = new Map<string, number[]>()

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i]
    if (c.email) {
      const domain = c.email.split('@')[1]
      if (domain) {
        const existing = domainMap.get(domain) ?? []
        existing.push(i)
        domainMap.set(domain, existing)
      }
    }
    if (c.lastName) {
      const initial = c.lastName[0].toLowerCase()
      const existing = lastNameMap.get(initial) ?? []
      existing.push(i)
      lastNameMap.set(initial, existing)
    }
    if (c.phone) {
      const suffix = c.phone.slice(-6)
      const existing = phoneMap.get(suffix) ?? []
      existing.push(i)
      phoneMap.set(suffix, existing)
    }
  }

  const threshold = 50
  const pairs: SimilarityResult[] = []

  // Compare only candidates with at least one shared signal
  for (let i = 0; i < contacts.length; i++) {
    const a = contacts[i]
    const candidates = new Set<number>()

    if (a.email) {
      const domain = a.email.split('@')[1]
      if (domain) for (const j of domainMap.get(domain) ?? []) if (j > i) candidates.add(j)
    }
    if (a.lastName) {
      const initial = a.lastName[0].toLowerCase()
      for (const j of lastNameMap.get(initial) ?? []) if (j > i) candidates.add(j)
    }
    if (a.phone) {
      const suffix = a.phone.slice(-6)
      for (const j of phoneMap.get(suffix) ?? []) if (j > i) candidates.add(j)
    }

    for (const j of candidates) {
      const result = compareContacts(a, contacts[j])
      if (result.weightedScore >= threshold) {
        pairs.push(result)
      }
    }
  }

  if (pairs.length === 0) return { groups: [], uniqueContacts: contacts }

  // Union-find: use array positions consistently
  const parent = contacts.map((_, idx) => idx)
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  function union(x: number, y: number) { parent[find(x)] = find(y) }

  // Build position map
  const posByIndex = new Map<number, number>()
  for (let i = 0; i < contacts.length; i++) posByIndex.set(contacts[i].rowIndex, i)

  for (const pair of pairs) {
    const posA = posByIndex.get(pair.contactA.rowIndex) ?? pair.contactA.rowIndex
    const posB = posByIndex.get(pair.contactB.rowIndex) ?? pair.contactB.rowIndex
    union(posA, posB)
  }

  // Collect groups by position
  const membersByRoot = new Map<number, Set<number>>()
  const pairsByRoot = new Map<number, SimilarityResult[]>()
  for (let pos = 0; pos < contacts.length; pos++) {
    const root = find(pos)
    if (!membersByRoot.has(root)) { membersByRoot.set(root, new Set()); pairsByRoot.set(root, []) }
    membersByRoot.get(root)!.add(pos)
  }
  for (const pair of pairs) {
    const posA = posByIndex.get(pair.contactA.rowIndex) ?? pair.contactA.rowIndex
    const root = find(posA)
    if (root !== undefined) pairsByRoot.get(root)?.push(pair)
  }

  const groups: DuplicateGroup[] = []
  for (const [root, members] of membersByRoot) {
    if (members.size < 2) continue
    const contactList = [...members].map(pos => contacts[pos]).sort((a, b) => a.rowIndex - b.rowIndex)
    const master = findMasterContact(contactList)
    const groupPairs = pairsByRoot.get(root) ?? []
    const avgRisk = groupPairs.length > 0
      ? Math.round(groupPairs.reduce((s, p) => s + p.weightedScore, 0) / groupPairs.length)
      : 0

    groups.push({
      id: `group-${root}`,
      contacts: contactList,
      masterContact: master,
      pairs: groupPairs,
      riskScore: avgRisk,
      riskLevel: avgRisk >= 90 ? 'certain' : avgRisk >= 70 ? 'likely' : 'possible',
    })
  }

  groups.sort((a, b) => b.riskScore - a.riskScore)

  const membersInGroups = new Set(groups.flatMap(g => g.contacts.map(c => c.rowIndex)))
  const uniqueContacts = contacts.filter(c => !membersInGroups.has(c.rowIndex))

  return { groups, uniqueContacts }
}
