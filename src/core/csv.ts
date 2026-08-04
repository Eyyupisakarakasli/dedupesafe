import Papa from 'papaparse'
import type { ColumnMapping, Contact, DedupeField, ParseResult } from './types'

const FIELD_CANDIDATES: Record<DedupeField, string[]> = {
  email: ['email', 'e-mail', 'primary email'],
  firstName: ['first name', 'firstname', 'first_name', 'given name'],
  lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name'],
  phone: ['phone number', 'phone', 'mobile phone', 'mobilephone', 'phone number (primary)', 'business phone'],
  company: ['company name', 'company', 'organization', 'associated company'],
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase()
    .replace(/['']/g, "'")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[""]/g, '"')
}

export function detectHubSpotMapping(headers: string[]): ColumnMapping {
  const used = new Set<string>()
  const mapping: ColumnMapping = { email: null, firstName: null, lastName: null, phone: null, company: null }

  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES) as [DedupeField, string[]][]) {
    // Score all headers for this field
    const normalized = headers.map(h => normalizeHeader(h))
    let bestHeader: string | null = null
    let bestScore = -1

    for (let i = 0; i < headers.length; i++) {
      if (used.has(headers[i])) continue
      const h = normalized[i]
      if (h.length === 0) continue

      // Exact match = score 10
      if (candidates.includes(h)) {
        bestHeader = headers[i]
        bestScore = 10 + candidates.indexOf(h) * 0.01 // prefer earlier candidates
        break
      }

      // Substring match = score 5 (only for headers >= 3 chars)
      if (h.length >= 3) {
        for (const c of candidates) {
          if (c.length >= 3 && h.includes(c)) {
            const score = 5 + candidates.indexOf(c) * 0.01
            if (score > bestScore) { bestScore = score; bestHeader = headers[i] }
          }
        }
      }
    }

    if (bestHeader) {
      mapping[field] = bestHeader
      used.add(bestHeader)
    }
  }

  return mapping
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields ?? []
        if (headers.length === 0) {
          reject(new Error('CSV has no headers'))
          return
        }
        resolve({
          headers,
          rows: results.data as Record<string, string>[],
          totalRows: results.data.length,
        })
      },
      error(err) {
        reject(new Error(`Failed to parse CSV: ${err.message}`))
      },
    })
  })
}

export function normalizeContacts(rows: Record<string, string>[], mapping: ColumnMapping): Contact[] {
  return rows.map((row, index) => {
    const contact: Contact = {
      email: (mapping.email ? row[mapping.email] ?? '' : '').trim().toLowerCase(),
      firstName: (mapping.firstName ? row[mapping.firstName] ?? '' : '').trim().toLowerCase(),
      lastName: (mapping.lastName ? row[mapping.lastName] ?? '' : '').trim().toLowerCase(),
      phone: (mapping.phone ? row[mapping.phone] ?? '' : '').replace(/[^0-9+]/g, ''),
      company: (mapping.company ? row[mapping.company] ?? '' : '').trim().toLowerCase(),
      raw: row,
      rowIndex: index,
    }
    return contact
  })
}

export function getFieldValue(contact: Contact, field: DedupeField): string {
  return contact[field]
}

export function hasAnyValue(contact: Contact, fields: DedupeField[]): boolean {
  return fields.some(f => contact[f].length > 0)
}
