export interface Contact {
  email: string
  firstName: string
  lastName: string
  phone: string
  company: string
  raw: Record<string, string>
  rowIndex: number
}

export interface ColumnMapping {
  email: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  company: string | null
}

export type DedupeField = keyof ColumnMapping

export interface SimilarityResult {
  contactA: Contact
  contactB: Contact
  scores: Record<DedupeField, number>
  weightedScore: number
  riskLevel: 'certain' | 'likely' | 'possible' | 'unlikely'
}

export interface DuplicateGroup {
  id: string
  contacts: Contact[]
  masterContact: Contact
  pairs: SimilarityResult[]
  riskScore: number
  riskLevel: string
}

export interface ScanResult {
  totalContacts: number
  duplicateGroups: DuplicateGroup[]
  uniqueContacts: Contact[]
  summary: {
    totalDuplicatesFound: number
    highRiskGroups: number
    mediumRiskGroups: number
    lowRiskGroups: number
  }
}

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}
