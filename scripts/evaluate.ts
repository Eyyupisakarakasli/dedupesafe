import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Papa from 'papaparse'
import { findDuplicateGroups } from '../src/core/matcher'
import type { Contact, DuplicateGroup } from '../src/core/types'

const REQUIRED_COLUMNS = ['entity_id', 'Email', 'First Name', 'Last Name', 'Phone', 'Company'] as const
const REQUIRED_METADATA = [
  'provenance', 'permission', 'labelingMethod', 'duplicateDefinition', 'anonymization',
] as const

type Metadata = Record<(typeof REQUIRED_METADATA)[number], string>
type Pair = `${number}:${number}`

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function pair(a: number, b: number): Pair {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function pairsForRows(rows: number[]): Set<Pair> {
  const pairs = new Set<Pair>()
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) pairs.add(pair(rows[i], rows[j]))
  }
  return pairs
}

function pairsForGroups(groups: DuplicateGroup[]): Set<Pair> {
  const pairs = new Set<Pair>()
  for (const group of groups) {
    for (const value of pairsForRows(group.contacts.map(contact => contact.rowIndex))) pairs.add(value)
  }
  return pairs
}

function difference(left: Set<Pair>, right: Set<Pair>): Pair[] {
  return [...left].filter(value => !right.has(value)).sort()
}

function intersectionSize(left: Set<Pair>, right: Set<Pair>): number {
  let count = 0
  for (const value of left) if (right.has(value)) count++
  return count
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 10000) / 10000
}

const [, , csvArgument, metadataArgument, outputArgument] = process.argv
if (!csvArgument || !metadataArgument) {
  fail('Usage: npm run evaluate -- <labeled.csv> <metadata.json> [evaluation.json]')
}

const csvPath = resolve(csvArgument)
const metadataPath = resolve(metadataArgument)
const outputPath = outputArgument ? resolve(outputArgument) : resolve('evaluation.json')
const csvText = readFileSync(csvPath, 'utf8')
const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })
if (parsed.errors.length > 0) fail(`CSV parse error: ${parsed.errors[0].message}`)

const headers = parsed.meta.fields ?? []
for (const column of REQUIRED_COLUMNS) {
  if (!headers.includes(column)) fail(`Missing required CSV column: ${column}`)
}

const rawMetadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as Partial<Metadata>
for (const field of REQUIRED_METADATA) {
  if (typeof rawMetadata[field] !== 'string' || rawMetadata[field]?.trim() === '') {
    fail(`Missing non-empty metadata field: ${field}`)
  }
}
const metadata = Object.fromEntries(
  REQUIRED_METADATA.map(field => [field, rawMetadata[field]!.trim()]),
) as Metadata

const contacts: Contact[] = parsed.data.map((row, rowIndex) => ({
  email: (row.Email ?? '').normalize('NFC').trim().toLowerCase(),
  firstName: (row['First Name'] ?? '').normalize('NFC').trim(),
  lastName: (row['Last Name'] ?? '').normalize('NFC').trim(),
  phone: (row.Phone ?? '').replace(/[^0-9+]/g, ''),
  company: (row.Company ?? '').normalize('NFC').trim().toLowerCase(),
  raw: row,
  rowIndex,
}))

const truthByEntity = new Map<string, number[]>()
for (let rowIndex = 0; rowIndex < parsed.data.length; rowIndex++) {
  const entityId = parsed.data[rowIndex].entity_id?.trim()
  if (!entityId) fail(`Missing entity_id on CSV row ${rowIndex + 2}`)
  const rows = truthByEntity.get(entityId)
  if (rows) rows.push(rowIndex)
  else truthByEntity.set(entityId, [rowIndex])
}

const truthPairs = new Set<Pair>()
for (const rows of truthByEntity.values()) {
  for (const value of pairsForRows(rows)) truthPairs.add(value)
}

const result = findDuplicateGroups(contacts)
const automaticPairs = pairsForGroups(result.groups)
const reviewPairs = pairsForGroups(result.reviewGroups)
const candidatePairs = new Set([...automaticPairs, ...reviewPairs])
const automaticTruePositives = intersectionSize(automaticPairs, truthPairs)
const candidateTruePositives = intersectionSize(candidatePairs, truthPairs)

const report = {
  generatedAt: new Date().toISOString(),
  dataset: {
    sha256: createHash('sha256').update(csvText).digest('hex'),
    rows: contacts.length,
    labeledEntities: truthByEntity.size,
    trueDuplicatePairs: truthPairs.size,
    ...metadata,
  },
  automaticTier: {
    predictedPairs: automaticPairs.size,
    truePositives: automaticTruePositives,
    falsePositives: difference(automaticPairs, truthPairs),
    falseNegatives: difference(truthPairs, automaticPairs),
    precision: ratio(automaticTruePositives, automaticPairs.size),
    recall: ratio(automaticTruePositives, truthPairs.size),
  },
  reviewTier: {
    predictedPairs: reviewPairs.size,
    truePositives: intersectionSize(reviewPairs, truthPairs),
    falsePositives: difference(reviewPairs, truthPairs),
  },
  allCandidates: {
    predictedPairs: candidatePairs.size,
    truePositives: candidateTruePositives,
    falsePositives: difference(candidatePairs, truthPairs),
    falseNegatives: difference(truthPairs, candidatePairs),
    precision: ratio(candidateTruePositives, candidatePairs.size),
    recall: ratio(candidateTruePositives, truthPairs.size),
  },
}

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
