import Papa from 'papaparse'
import type { ColumnMapping, Contact, DedupeField, ParseResult } from './types'

const FIELD_CANDIDATES: Record<DedupeField, string[]> = {
  email: ['email', 'e-mail', 'email address', 'contact email', 'primary email', 'work email', 'eposta', 'e-posta'],
  firstName: ['first name', 'firstname', 'first_name', 'given name', 'ad', 'adi'],
  lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name', 'soyad', 'soyadi'],
  phone: ['phone number', 'phone', 'mobile phone', 'mobilephone', 'mobile', 'cell phone', 'cell',
    'telephone', 'phone number (primary)', 'business phone', 'telefon'],
  company: ['company name', 'company', 'organization', 'organisation', 'business name',
    'associated company', 'account name', 'sirket', 'firma'],
}

/**
 * Words that mark a column as metadata *about* a field rather than the field itself.
 * Without these, "Email Hard Bounce Reason" outranks the real email column.
 */
const NEGATIVE_TOKENS = [
  'bounce', 'opt out', 'optout', 'opt-out', 'unsubscribe', 'status', 'confirmation',
  'owner', 'domain', 'score', 'stage', 'count', 'url', 'link', 'note', 'reason',
  'date', 'id', 'type', 'source', 'quality', 'validity', 'deliverab',
]

function normalizeHeader(header: string): string {
  return header.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
}

function scoreHeader(normalized: string, candidates: string[]): number {
  if (!normalized) return 0
  let score = 0
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (normalized === c) { score = Math.max(score, 100 - i); break }
    if (c.length >= 3 && normalized.includes(c)) score = Math.max(score, 40 - i)
  }
  if (score === 0) return 0
  for (const bad of NEGATIVE_TOKENS) {
    if (normalized.includes(bad)) return Math.max(0, score - 60)
  }
  return score
}

export function detectHubSpotMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { email: null, firstName: null, lastName: null, phone: null, company: null }
  const normalized = headers.map(normalizeHeader)
  const used = new Set<number>()

  // Resolve the most confident field first so a strong match cannot be stolen by a weaker one.
  const ranked: { field: DedupeField; index: number; score: number }[] = []
  for (const field of Object.keys(FIELD_CANDIDATES) as DedupeField[]) {
    for (let i = 0; i < headers.length; i++) {
      const score = scoreHeader(normalized[i], FIELD_CANDIDATES[field])
      if (score > 0) ranked.push({ field, index: i, score })
    }
  }
  ranked.sort((a, b) => b.score - a.score || a.index - b.index)

  for (const { field, index, score } of ranked) {
    if (mapping[field] !== null || used.has(index) || score <= 0) continue
    mapping[field] = headers[index]
    used.add(index)
  }

  return mapping
}

/** papaparse puts overflow cells from ragged rows under this key. */
const PARSED_EXTRA = '__parsed_extra'

/**
 * papaparse types rows as string maps but can yield arrays (ragged rows) and
 * inherited keys (a column literally named __proto__). Normalise to a real string
 * map with a null prototype so downstream code cannot be surprised.
 */
function toStringRecord(row: unknown): Record<string, string> {
  const clean: Record<string, string> = Object.create(null)
  if (!row || typeof row !== 'object') return clean
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (key === PARSED_EXTRA) continue
    if (value == null) clean[key] = ''
    else if (Array.isArray(value)) clean[key] = value.join(' ')
    else clean[key] = String(value)
  }
  return clean
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = (results.meta.fields ?? []).filter(h => h !== PARSED_EXTRA)
        if (headers.length === 0) {
          reject(new Error('This file has no column headers. Export contacts from HubSpot as CSV and try again.'))
          return
        }
        const rows = (results.data as unknown[]).map(toStringRecord)
        // Surface structural problems instead of silently importing broken data.
        const warnings: string[] = []
        const counted = new Map<string, number>()
        for (const err of results.errors ?? []) {
          counted.set(err.code, (counted.get(err.code) ?? 0) + 1)
        }
        for (const [code, count] of counted) {
          const row = count === 1 ? 'row has' : 'rows have'
          const label = code === 'TooManyFields' ? `${count} ${row} more values than columns`
            : code === 'TooFewFields' ? `${count} ${row} fewer values than columns`
            : code === 'UndetectableDelimiter' ? 'the delimiter could not be detected'
            : `the parser reported ${code} on ${count} row(s)`
          warnings.push(label)
        }
        resolve({ headers, rows, totalRows: rows.length, warnings })
      },
      error(err) {
        reject(new Error(`Failed to parse CSV: ${err.message}`))
      },
    })
  })
}

/** Read a cell without tripping over inherited keys such as __proto__. */
function cell(row: Record<string, string>, key: string | null): string {
  if (!key) return ''
  const value = Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined
  return typeof value === 'string' ? value : ''
}

function normalizeText(v: string): string {
  return v.normalize('NFC').trim()
}

/**
 * Strip an extension before reducing to digits, otherwise "555 0101 ext 22"
 * becomes 55501012 2 and stops matching the same person without an extension.
 */
function normalizePhone(v: string): string {
  // "x99" has no word boundary after the x, so match it by lookahead.
  const withoutExtension = v.split(/\b(?:ext|extn|extension|dahili|poste)\b|\bx(?=\s*\d)|#/i)[0]
  return withoutExtension.replace(/[^0-9+]/g, '')
}

export function normalizeContacts(rows: Record<string, string>[], mapping: ColumnMapping): Contact[] {
  return rows.map((row, index) => ({
    email: normalizeText(cell(row, mapping.email)).toLowerCase(),
    firstName: normalizeText(cell(row, mapping.firstName)),
    lastName: normalizeText(cell(row, mapping.lastName)),
    phone: normalizePhone(cell(row, mapping.phone)),
    company: normalizeText(cell(row, mapping.company)).toLowerCase(),
    raw: row,
    rowIndex: index,
  }))
}

/** True when the detected mapping looks like it came from a contact export at all. */
export function looksLikeContactExport(mapping: ColumnMapping): boolean {
  return mapping.email !== null || (mapping.firstName !== null && mapping.lastName !== null)
}
