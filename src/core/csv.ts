import Papa from 'papaparse'
import type { ColumnMapping, Contact, DedupeField, ParseResult } from './types'

const HUBSPOT_EMAIL_KEYS = ['email', 'e-mail', 'email address', 'contact email']
const HUBSPOT_FIRST_NAME_KEYS = ['first name', 'firstname', 'first_name', 'given name']
const HUBSPOT_LAST_NAME_KEYS = ['last name', 'lastname', 'last_name', 'surname', 'family name']
const HUBSPOT_PHONE_KEYS = ['phone number', 'phone', 'mobile phone', 'mobilephone', 'mobile', 'phone number (primary)', 'business phone']
const HUBSPOT_COMPANY_KEYS = ['company name', 'company', 'organization', 'organisation', 'business name', 'associated company']

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase()
    .replace(/['']/g, "'")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[""]/g, '"')
}

function findBestMatch(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map(h => normalizeHeader(h))
  for (const candidate of candidates) {
    const index = normalized.findIndex(h => h === candidate)
    if (index !== -1) return headers[index]
  }
  // Partial match fallback
  for (const candidate of candidates) {
    const index = normalized.findIndex(h => h.includes(candidate) || candidate.includes(h))
    if (index !== -1) return headers[index]
  }
  return null
}

export function detectHubSpotMapping(headers: string[]): ColumnMapping {
  return {
    email: findBestMatch(headers, HUBSPOT_EMAIL_KEYS),
    firstName: findBestMatch(headers, HUBSPOT_FIRST_NAME_KEYS),
    lastName: findBestMatch(headers, HUBSPOT_LAST_NAME_KEYS),
    phone: findBestMatch(headers, HUBSPOT_PHONE_KEYS),
    company: findBestMatch(headers, HUBSPOT_COMPANY_KEYS),
  }
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
      firstName: (mapping.firstName ? row[mapping.firstName] ?? '' : '').trim(),
      lastName: (mapping.lastName ? row[mapping.lastName] ?? '' : '').trim(),
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
