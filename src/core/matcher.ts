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

/**
 * Common short forms. A nickname is not proof of identity — it only ever feeds
 * the review tier, never an automatic merge.
 */
const NICKNAME_GROUPS: string[][] = [
  ['robert', 'rob', 'bob', 'bobby', 'robbie'],
  ['william', 'will', 'bill', 'billy', 'liam'],
  ['richard', 'rich', 'rick', 'dick', 'ricky'],
  ['james', 'jim', 'jimmy', 'jamie'],
  ['john', 'jon', 'johnny', 'jack'],
  ['michael', 'mike', 'mick', 'mikey'],
  ['charles', 'charlie', 'chuck', 'chas'],
  ['thomas', 'tom', 'tommy'],
  ['joseph', 'joe', 'joey'],
  ['daniel', 'dan', 'danny'],
  ['matthew', 'matt', 'matty'],
  ['christopher', 'chris', 'kit'],
  ['anthony', 'tony'],
  ['nicholas', 'nick', 'nicky'],
  ['edward', 'ed', 'eddie', 'ted', 'teddy'],
  ['katherine', 'catherine', 'kate', 'katie', 'kathy', 'cathy'],
  ['elizabeth', 'liz', 'beth', 'betty', 'eliza', 'lisa'],
  ['margaret', 'maggie', 'meg', 'peggy'],
  ['patricia', 'pat', 'patty', 'tricia'],
  ['jennifer', 'jen', 'jenny'],
  ['susan', 'sue', 'susie'],
  ['deborah', 'deb', 'debbie'],
  ['alexander', 'alex', 'sasha', 'sandy'],
  ['alexandra', 'alex', 'sandra', 'sasha'],
  ['stephen', 'steven', 'steve'],
  ['andrew', 'andy', 'drew'],
  ['benjamin', 'ben', 'benny'],
  ['samuel', 'sam', 'sammy'],
  ['mehmet', 'memo', 'memet'],
  ['mustafa', 'mustu'],
  ['ibrahim', 'ibo'],
  ['huseyin', 'huso'],
  ['abdullah', 'apo'],
  ['suleyman', 'sulo'],
  ['muhammed', 'muhammet', 'mehmet'],
]

const NICKNAME_INDEX: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>()
  for (const group of NICKNAME_GROUPS) {
    for (const name of group) {
      let set = map.get(name)
      if (!set) { set = new Set(); map.set(name, set) }
      for (const other of group) if (other !== name) set.add(other)
    }
  }
  return map
})()

function isNicknameOf(a: string, b: string): boolean {
  return NICKNAME_INDEX.get(a.toLowerCase())?.has(b.toLowerCase()) ?? false
}

/** Evidence that two rows are definitely different people. */
function hasConflict(a: Contact, b: Contact): boolean {
  // Two known, clearly different surnames. Catches shared inboxes (info@) and
  // colleagues sharing a switchboard number.
  if (a.lastName && b.lastName && jaroWinkler(a.lastName, b.lastName) < SIM_FLOOR) return true
  return false
}

/**
 * A pair with no shared identifier but strong enough name evidence to be worth
 * a human glance: same surname, a related first name, and a shared employer or
 * mail domain. These are surfaced separately and are never removed from the
 * export unless the user confirms them.
 */
export function isReviewCandidate(a: Contact, b: Contact): boolean {
  if (identifierStrength(a, b) > 0) return false
  if (!a.lastName || !b.lastName || !a.firstName || !b.firstName) return false
  // The surname must match outright. Allowing near-misses here surfaced pairs
  // like "Ahmet Arslan" / "Ahmet Aslan", which are two ordinary surnames one
  // letter apart, and buried the real nickname matches in noise.
  if (a.lastName.toLowerCase() !== b.lastName.toLowerCase()) return false

  // A known short form, or a spelling variant. The 0.92 bar leans on the
  // Jaro-Winkler prefix bonus: "mehmet"/"mehmed" differ at the end and pass,
  // while "selin"/"pelin" differ at the start and are two different names.
  const firstRelated =
    isNicknameOf(a.firstName, b.firstName) ||
    jaroWinkler(a.firstName, b.firstName) >= 0.92
  if (!firstRelated) return false

  const [, domainA] = a.email ? splitEmail(a.email) : ['', '']
  const [, domainB] = b.email ? splitEmail(b.email) : ['', '']
  const sharedDomain = Boolean(domainA) && domainA === domainB
  const sharedCompany = Boolean(a.company) && Boolean(b.company) &&
    companySimilarity(a.company, b.company) >= 0.9
  return sharedDomain || sharedCompany
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
 * Blocking keys, one set to index by and one to probe with. They are usually the
 * same, but the "bare handle meets first.last" rule is one-directional: a bare
 * handle probes the structured bucket and vice versa. Keying both sides the same
 * way would rebuild the bucket that dominated the whole scan — every
 * `first.last@gmail.com` sharing a first name landed in one list.
 */
function blockingKeys(c: Contact): { index: string[]; probe: string[] } {
  const index: string[] = []
  const probe: string[] = []
  const both = (k: string) => { index.push(k); probe.push(k) }

  if (c.email) {
    const [local, domain] = splitEmail(c.email)
    if (local && domain) {
      const base = baseLocal(local)
      const comps = localComponents(local)

      // Exact address, +tag variants and punctuation-only variants.
      both(`f:${domain}|${base.replace(/[._-]/g, '')}`)
      // Same handle at another provider (work + personal).
      both(`l:${base}`)

      if (comps.length > 1) {
        const first = comps[0]
        const last = comps[comps.length - 1]
        // Component-compatible locals differ in at most one component, and only
        // by an initial. Keying on (first initial + last) and (first + last
        // initial) catches every such pair while staying highly selective.
        both(`k1:${domain}|${first[0]}|${last}`)
        both(`k2:${domain}|${first}|${last[0]}`)
        // Meet bare handles equal to our leading component.
        index.push(`st:${domain}|${first}`)
        probe.push(`ba:${domain}|${first}`)
      } else {
        index.push(`ba:${domain}|${base}`)
        probe.push(`st:${domain}|${base}`)
        // Near-identical bare handles keep the first two characters.
        both(`h:${domain}|${base.slice(0, 2)}`)
      }
    }
  }

  if (c.phone) {
    const digits = phoneDigits(c.phone)
    if (digits.length >= 7) both(`p:${digits.slice(-9)}`)
  }

  // Review-tier candidates need a near-identical surname plus a shared employer
  // or mail domain, so key on both. A 4-character surname prefix is implied by
  // the 0.9 similarity bar.
  if (c.lastName && c.firstName) {
    const surname = c.lastName.slice(0, 4).toLowerCase()
    if (c.email) {
      const [, domain] = splitEmail(c.email)
      if (domain) both(`rd:${domain}|${surname}`)
    }
    if (c.company) both(`rc:${c.company.toLowerCase()}|${surname}`)
  }

  return { index, probe }
}

/** Union-find over array positions. */
function makeUnionFind(size: number) {
  const parent = Array.from({ length: size }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  return { find, union: (x: number, y: number) => { parent[find(x)] = find(y) } }
}

export interface ScanOptions {
  /** Called periodically during the comparison sweep so callers can report progress. */
  onProgress?: (done: number, total: number) => void
}

export interface ScanOutcome {
  /** Pairs sharing a strong identifier. Safe to collapse on export. */
  groups: DuplicateGroup[]
  /** Name-only matches that need a human decision. Never collapsed by default. */
  reviewGroups: DuplicateGroup[]
  uniqueContacts: Contact[]
}

export function findDuplicateGroups(
  contacts: Contact[],
  options: ScanOptions = {},
): ScanOutcome {
  if (contacts.length < 2) return { groups: [], reviewGroups: [], uniqueContacts: contacts }

  const buckets = new Map<string, number[]>()
  const probesByIndex: string[][] = new Array(contacts.length)
  for (let i = 0; i < contacts.length; i++) {
    const { index, probe } = blockingKeys(contacts[i])
    probesByIndex[i] = probe
    for (const key of index) {
      const list = buckets.get(key)
      if (list) list.push(i)
      else buckets.set(key, [i])
    }
  }

  const pairs: SimilarityResult[] = []
  const reviewPairs: [number, number][] = []
  const candidates = new Set<number>()
  const progressEvery = Math.max(256, Math.floor(contacts.length / 100))
  for (let i = 0; i < contacts.length; i++) {
    if (options.onProgress && i % progressEvery === 0) options.onProgress(i, contacts.length)
    candidates.clear()
    for (const key of probesByIndex[i]) {
      for (const j of buckets.get(key) ?? []) if (j !== i) candidates.add(j)
    }
    for (const j of candidates) {
      // Probe keys are one-directional, so order the pair rather than relying on j > i.
      if (j < i) continue
      const result = compareContacts(contacts[i], contacts[j])
      if (result.weightedScore >= THRESHOLD) pairs.push(result)
      else if (isReviewCandidate(contacts[i], contacts[j])) reviewPairs.push([i, j])
    }
  }

  if (pairs.length === 0 && reviewPairs.length === 0) {
    return { groups: [], reviewGroups: [], uniqueContacts: contacts }
  }

  const { find, union } = makeUnionFind(contacts.length)

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

  // Second pass: name-only matches, over the contacts no confirmed group claimed.
  const reviewUf = makeUnionFind(contacts.length)
  let reviewLinks = 0
  for (const [i, j] of reviewPairs) {
    if (grouped.has(contacts[i].rowIndex) || grouped.has(contacts[j].rowIndex)) continue
    reviewUf.union(i, j)
    reviewLinks++
  }

  const reviewGroups: DuplicateGroup[] = []
  if (reviewLinks > 0) {
    const membersByReviewRoot = new Map<number, number[]>()
    for (let pos = 0; pos < contacts.length; pos++) {
      if (grouped.has(contacts[pos].rowIndex)) continue
      const root = reviewUf.find(pos)
      const list = membersByReviewRoot.get(root)
      if (list) list.push(pos)
      else membersByReviewRoot.set(root, [pos])
    }
    for (const [root, members] of membersByReviewRoot) {
      if (members.length < 2) continue
      const contactList = members.map(pos => contacts[pos]).sort((x, y) => x.rowIndex - y.rowIndex)
      reviewGroups.push({
        id: `review-${root}`,
        contacts: contactList,
        masterContact: findMasterContact(contactList),
        pairs: [],
        riskScore: 0,
        riskLevel: 'review',
      })
    }
    for (const g of reviewGroups) for (const c of g.contacts) grouped.add(c.rowIndex)
  }

  const uniqueContacts = contacts.filter(c => !grouped.has(c.rowIndex))

  return { groups, reviewGroups, uniqueContacts }
}
