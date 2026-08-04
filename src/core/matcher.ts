import type { Contact, DedupeField, DuplicateGroup, SimilarityResult } from './types'

/** Below this, a fuzzy string score is treated as "no evidence" rather than partial credit. */
const SIM_FLOOR = 0.7
/** Pair score required to link two contacts. */
const THRESHOLD = 50

export function jaroWinkler(a: string, b: string): number {
  if (!a || !b) return 0
  a = a.toLowerCase()
  b = b.toLowerCase()
  if (a === b) return 1

  const aLen = a.length
  const bLen = b.length
  const rangeClamped = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1)

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

  // Standard Jaro-Winkler applies the prefix bonus only to already-similar strings.
  if (jaro < 0.7) return jaro

  let prefix = 0
  for (let i = 0; i < Math.min(aLen, bLen, 4); i++) {
    if (a[i] !== b[i]) break
    prefix++
  }
  return jaro + prefix * 0.1 * (1 - jaro)
}

/** Fuzzy score with a floor: weak resemblance is not evidence of identity. */
function fuzzy(a: string, b: string): number {
  const s = jaroWinkler(a, b)
  return s >= SIM_FLOOR ? s : 0
}

// ---------------------------------------------------------------- email

function splitEmail(e: string): [string, string] {
  const at = e.lastIndexOf('@')
  if (at <= 0 || at === e.length - 1) return ['', '']
  return [e.slice(0, at), e.slice(at + 1)]
}

/** Drop a "+tag" suffix: john+hubspot -> john */
function baseLocal(local: string): string {
  const plus = local.indexOf('+')
  return plus > 0 ? local.slice(0, plus) : local
}

/** Split a local part into name-ish components: john.q-smith -> [john, q, smith] */
function localComponents(local: string): string[] {
  return baseLocal(local).split(/[._-]/).filter(Boolean)
}

/**
 * Shared mailboxes that identify a function, not a person. Two addresses built
 * on the same role word are two inboxes, so the word must never act as identity.
 */
const ROLE_LOCALS: ReadonlySet<string> = new Set([
  'info', 'admin', 'sales', 'support', 'contact', 'hello', 'help', 'office',
  'team', 'billing', 'accounts', 'finance', 'hr', 'jobs', 'careers', 'press',
  'marketing', 'noreply', 'no-reply', 'donotreply', 'mail', 'email', 'webmaster',
  'service', 'orders', 'bilgi', 'destek', 'satis', 'iletisim', 'muhasebe',
])

function isInitialOf(short: string, long: string): boolean {
  return short.length === 1 && long.length > 1 && long.startsWith(short)
}

/**
 * Two structured local parts (first.last style) refer to the same person only if
 * every component lines up, allowing initials. This is what stops
 * mustafa.yilmaz@ from matching mustafa.yildirim@.
 */
function componentsCompatible(ca: string[], cb: string[]): boolean {
  if (ca.length !== cb.length) return false
  for (let i = 0; i < ca.length; i++) {
    const x = ca[i]
    const y = cb[i]
    if (x === y) continue
    if (isInitialOf(x, y) || isInitialOf(y, x)) continue
    return false
  }
  return true
}

export function emailSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  const [localA, domainA] = splitEmail(a)
  const [localB, domainB] = splitEmail(b)
  if (!localA || !localB || !domainA || !domainB) return 0

  const baseA = baseLocal(localA)
  const baseB = baseLocal(localB)

  if (domainA === domainB) {
    // Same address apart from a +tag.
    if (baseA === baseB) return 0.95

    const compA = localComponents(localA)
    const compB = localComponents(localB)

    // Both structured (first.last): every component must agree, or they are different people.
    if (compA.length > 1 && compB.length > 1) {
      return componentsCompatible(compA, compB) ? 0.85 : 0
    }

    // Punctuation-only difference: john.smith == johnsmith
    const flatA = baseA.replace(/[._-]/g, '')
    const flatB = baseB.replace(/[._-]/g, '')
    if (flatA === flatB) return 0.85

    // A bare handle equal to the other's leading component: john@ ~ john.smith@.
    // Role mailboxes are excluded — info@ and info.sales@ are two different
    // inboxes, not one person, and they rarely carry a surname to conflict on.
    if (compA.length === 1 && compB.length > 1 && compA[0] === compB[0]) {
      return ROLE_LOCALS.has(compA[0]) ? 0 : 0.85
    }
    if (compB.length === 1 && compA.length > 1 && compB[0] === compA[0]) {
      return ROLE_LOCALS.has(compB[0]) ? 0 : 0.85
    }

    // Two bare handles that are near-identical: alice@ ~ alicia@.
    // The length guard is what separates alice/alicia (1 char apart) from
    // john/johnson (3 apart), which Jaro-Winkler alone rates as *more* similar.
    // Only a probable signal, so compareContacts still demands corroboration.
    if (compA.length === 1 && compB.length === 1 &&
        baseA.length >= 4 && baseB.length >= 4 &&
        Math.abs(baseA.length - baseB.length) <= 2 &&
        jaroWinkler(baseA, baseB) >= 0.89) {
      return 0.8
    }
    return 0
  }

  // Different providers, identical handle: the classic work + personal pair.
  if (baseA === baseB && baseA.length >= 4) return 0.6
  return 0
}

// ---------------------------------------------------------------- phone

function phoneDigits(p: string): string {
  return p.replace(/\D/g, '')
}

export function phoneSimilarity(a: string, b: string): number {
  const da = phoneDigits(a)
  const db = phoneDigits(b)
  if (!da || !db) return 0
  if (da === db) return 1

  // Suffix match tolerates country/trunk prefixes but needs enough digits to mean anything.
  const minLen = Math.min(da.length, db.length)
  if (minLen < 7) return 0
  const n = Math.min(9, minLen)
  return da.slice(-n) === db.slice(-n) ? 0.9 : 0
}

// ---------------------------------------------------------------- company

const COMPANY_SUFFIX = /\b(incorporated|inc|llc|ltd|corporation|corp|limited|gmbh|sarl|sa|co|as|sti|ag|bv|nv|plc|holding)\b/g

function stripCompany(s: string): string {
  return s
    .toLowerCase()
    .replace(COMPANY_SUFFIX, '')
    .replace(/[^a-z0-9À-ɏ]/g, '')
}

export function companySimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const sa = stripCompany(a)
  const sb = stripCompany(b)
  if (!sa || !sb) return 0
  if (sa === sb) return 1

  // Containment counts only for distinctive names of comparable length,
  // so "meta" no longer matches "metamask".
  const ratio = Math.min(sa.length, sb.length) / Math.max(sa.length, sb.length)
  if (ratio < 0.6) return 0
  if (sa.length >= 5 && sb.length >= 5 && (sa.includes(sb) || sb.includes(sa))) return 0.9
  return fuzzy(sa, sb)
}

// ---------------------------------------------------------------- scoring

const FIELD_WEIGHTS: Record<DedupeField, number> = {
  email: 0.35,
  phone: 0.25,
  firstName: 0.10,
  lastName: 0.15,
  company: 0.15,
}

const COMPARATORS: Record<DedupeField, (a: string, b: string) => number> = {
  email: emailSimilarity,
  firstName: fuzzy,
  lastName: fuzzy,
  phone: phoneSimilarity,
  company: companySimilarity,
}

/**
 * Fields a person can legitimately have more than one of. A mismatch here is
 * "no evidence", not "evidence against" — otherwise a work/personal email pair
 * gets penalised for being exactly what it is.
 */
const MULTI_VALUE: ReadonlySet<DedupeField> = new Set<DedupeField>(['email', 'phone', 'company'])

/**
 * A shared strong identifier is required before two rows may be linked at all.
 * Names and companies can corroborate an identity but must never establish one,
 * otherwise everyone sharing a first name at one employer collapses together.
 * Returns 1 for a decisive identifier, 0.5 for a probable one, 0 for none.
 */
function identifierStrength(a: Contact, b: Contact): number {
  const emailScore = a.email && b.email ? emailSimilarity(a.email, b.email) : 0
  // Same mailbox: identical address, or identical apart from a +tag.
  if (emailScore >= 0.95) return 1
  if (a.phone && b.phone && phoneSimilarity(a.phone, b.phone) >= 0.9) return 1
  // Same-domain local-part variant: john@ ~ john.smith@, j.smith@ ~ john.smith@
  if (emailScore >= 0.85) return 0.75
  // Same handle at a different provider, or two near-identical bare handles.
  if (emailScore >= 0.6) return 0.5
  return 0
}

/** Evidence that two rows are definitely different people. */
function hasConflict(a: Contact, b: Contact): boolean {
  // Two known, clearly different surnames. Catches shared inboxes (info@) and
  // colleagues sharing a switchboard number.
  if (a.lastName && b.lastName && jaroWinkler(a.lastName, b.lastName) < SIM_FLOOR) return true
  return false
}

export function compareContacts(a: Contact, b: Contact): SimilarityResult {
  const scores = {} as Record<DedupeField, number>
  let weightedSum = 0
  let weightSum = 0
  let positiveFields = 0

  for (const field of Object.keys(FIELD_WEIGHTS) as DedupeField[]) {
    const valA = a[field]
    const valB = b[field]
    if (!valA || !valB) {
      scores[field] = 0
      continue
    }
    const score = COMPARATORS[field](valA, valB)
    scores[field] = score
    if (score > 0) positiveFields++
    // A differing email/phone/company is not held against the pair.
    if (score === 0 && MULTI_VALUE.has(field)) continue
    weightedSum += score * FIELD_WEIGHTS[field]
    weightSum += FIELD_WEIGHTS[field]
  }

  const reject = (): SimilarityResult => ({
    contactA: a, contactB: b, scores, weightedScore: 0, riskLevel: 'unlikely',
  })

  const strength = identifierStrength(a, b)
  if (strength === 0) return reject()
  if (hasConflict(a, b)) return reject()
  // A merely probable identifier needs at least one other field to agree.
  if (strength <= 0.5 && positiveFields < 2) return reject()
  if (weightSum <= 0) return reject()

  // Confidence is capped by how decisive the shared identifier was.
  const ceiling = strength >= 1 ? 100 : strength >= 0.75 ? 95 : 85
  const weightedScore = Math.min(ceiling, Math.round((weightedSum / weightSum) * 100))

  const riskLevel: SimilarityResult['riskLevel'] =
    weightedScore >= 90 ? 'certain' :
    weightedScore >= 70 ? 'likely' :
    weightedScore >= 50 ? 'possible' :
    'unlikely'

  return { contactA: a, contactB: b, scores, weightedScore, riskLevel }
}

// ---------------------------------------------------------------- grouping

function contentLength(c: Contact): number {
  return c.email.length + c.firstName.length + c.lastName.length + c.phone.length + c.company.length
}

function findMasterContact(contacts: Contact[]): Contact {
  let best = contacts[0]
  let bestFields = -1
  let bestLength = -1
  for (const c of contacts) {
    const fields =
      (c.email ? 1 : 0) + (c.firstName ? 1 : 0) + (c.lastName ? 1 : 0) +
      (c.phone ? 1 : 0) + (c.company ? 1 : 0)
    const length = contentLength(c)
    // Most populated record wins; ties go to the one carrying more detail
    // ("Jonathan" over "Jon"), then to the earliest row.
    if (fields > bestFields || (fields === bestFields && length > bestLength)) {
      bestFields = fields
      bestLength = length
      best = c
    }
  }
  return best
}

/**
 * Blocking keys. Every rule in identifierStrength() has a matching key here, so
 * any pair that could possibly link shares at least one bucket. Keys are kept
 * narrow — a bucket per domain would put every gmail.com contact in one list.
 */
function blockingKeys(c: Contact): string[] {
  const keys: string[] = []

  if (c.email) {
    const [local, domain] = splitEmail(c.email)
    if (local && domain) {
      const base = baseLocal(local)
      const comps = localComponents(local)

      // Exact address, +tag variants and punctuation-only variants.
      keys.push(`f:${domain}|${base.replace(/[._-]/g, '')}`)
      // Same handle at another provider (work + personal).
      keys.push(`l:${base}`)

      if (comps.length > 1) {
        // Structured local: component-compatible pairs agree on the first or the
        // last component (an initial can only replace one of them at a time).
        keys.push(`a:${domain}|${comps[0]}`)
        keys.push(`z:${domain}|${comps[comps.length - 1]}`)
      } else {
        // Bare handle: can meet a structured local whose leading component equals it…
        keys.push(`a:${domain}|${base}`)
        // …or a near-identical bare handle, which shares its first character.
        keys.push(`h:${domain}|${base[0]}`)
      }
    }
  }

  if (c.phone) {
    const digits = phoneDigits(c.phone)
    if (digits.length >= 7) keys.push(`p:${digits.slice(-9)}`)
  }

  return keys
}

export function findDuplicateGroups(
  contacts: Contact[],
): { groups: DuplicateGroup[]; uniqueContacts: Contact[] } {
  if (contacts.length < 2) return { groups: [], uniqueContacts: contacts }

  const buckets = new Map<string, number[]>()
  const keysByIndex: string[][] = new Array(contacts.length)
  for (let i = 0; i < contacts.length; i++) {
    const keys = blockingKeys(contacts[i])
    keysByIndex[i] = keys
    for (const key of keys) {
      const list = buckets.get(key)
      if (list) list.push(i)
      else buckets.set(key, [i])
    }
  }

  const pairs: SimilarityResult[] = []
  for (let i = 0; i < contacts.length; i++) {
    const candidates = new Set<number>()
    for (const key of keysByIndex[i]) {
      for (const j of buckets.get(key) ?? []) if (j > i) candidates.add(j)
    }
    for (const j of candidates) {
      const result = compareContacts(contacts[i], contacts[j])
      if (result.weightedScore >= THRESHOLD) pairs.push(result)
    }
  }

  if (pairs.length === 0) return { groups: [], uniqueContacts: contacts }

  // Union-find over array positions.
  const parent = contacts.map((_, idx) => idx)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (x: number, y: number) => { parent[find(x)] = find(y) }

  const posByRow = new Map<number, number>()
  for (let i = 0; i < contacts.length; i++) posByRow.set(contacts[i].rowIndex, i)
  const posOf = (c: Contact): number => {
    const pos = posByRow.get(c.rowIndex)
    if (pos === undefined) throw new Error(`Contact rowIndex ${c.rowIndex} is not part of this scan`)
    return pos
  }

  for (const pair of pairs) union(posOf(pair.contactA), posOf(pair.contactB))

  const membersByRoot = new Map<number, number[]>()
  for (let pos = 0; pos < contacts.length; pos++) {
    const root = find(pos)
    const list = membersByRoot.get(root)
    if (list) list.push(pos)
    else membersByRoot.set(root, [pos])
  }

  const pairsByRoot = new Map<number, SimilarityResult[]>()
  for (const pair of pairs) {
    const root = find(posOf(pair.contactA))
    const list = pairsByRoot.get(root)
    if (list) list.push(pair)
    else pairsByRoot.set(root, [pair])
  }

  const groups: DuplicateGroup[] = []
  for (const [root, members] of membersByRoot) {
    if (members.length < 2) continue
    const contactList = members.map(pos => contacts[pos]).sort((x, y) => x.rowIndex - y.rowIndex)
    const groupPairs = pairsByRoot.get(root) ?? []
    const avgRisk = groupPairs.length > 0
      ? Math.round(groupPairs.reduce((s, p) => s + p.weightedScore, 0) / groupPairs.length)
      : THRESHOLD

    groups.push({
      id: `group-${root}`,
      contacts: contactList,
      masterContact: findMasterContact(contactList),
      pairs: groupPairs,
      riskScore: avgRisk,
      riskLevel: avgRisk >= 90 ? 'certain' : avgRisk >= 70 ? 'likely' : 'possible',
    })
  }

  groups.sort((a, b) => b.riskScore - a.riskScore)

  const grouped = new Set<number>()
  for (const g of groups) for (const c of g.contacts) grouped.add(c.rowIndex)
  const uniqueContacts = contacts.filter(c => !grouped.has(c.rowIndex))

  return { groups, uniqueContacts }
}
