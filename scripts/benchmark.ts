import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { findDuplicateGroups } from '../src/core/matcher'
import type { Contact } from '../src/core/types'

const here = dirname(fileURLToPath(import.meta.url))

function contact(index: number, identity: number, duplicate: boolean): Contact {
  const firstName = `Person${identity}`
  const lastName = `Family${identity}`
  const email = duplicate
    ? `person${identity}+duplicate@company${identity}.example`
    : `person${identity}@company${identity}.example`
  const phone = `+1555${String(10_000_000 + identity).slice(-8)}`
  return {
    email,
    firstName,
    lastName,
    phone,
    company: `Company ${identity}`,
    raw: { Email: email, 'First Name': firstName, 'Last Name': lastName, Phone: phone },
    rowIndex: index,
  }
}

function dataset(size: number): { contacts: Contact[]; duplicatePairs: number } {
  const duplicatePairs = Math.floor(size * 0.05)
  const originals = size - duplicatePairs
  const contacts: Contact[] = []
  for (let i = 0; i < originals; i++) contacts.push(contact(i, i, false))
  for (let i = 0; i < duplicatePairs; i++) contacts.push(contact(originals + i, i, true))
  return { contacts, duplicatePairs }
}

function run(size: number) {
  const { contacts, duplicatePairs } = dataset(size)
  const started = performance.now()
  const outcome = findDuplicateGroups(contacts)
  const durationMs = Math.round((performance.now() - started) * 100) / 100
  if (outcome.groups.length !== duplicatePairs) {
    throw new Error(`Expected ${duplicatePairs} groups for ${size} rows, got ${outcome.groups.length}`)
  }
  return {
    rows: size,
    plantedDuplicatePairs: duplicatePairs,
    detectedGroups: outcome.groups.length,
    durationMs,
  }
}

run(1_000)
const report = {
  generatedAt: new Date().toISOString(),
  runtime: { node: process.version, platform: `${platform()} ${release()}`, cpu: cpus()[0]?.model ?? 'unknown' },
  method: 'One warm-up run, then one deterministic run per size. Five percent of rows are exact-identity +tag variants.',
  results: [run(10_000), run(50_000)],
}

const output = resolve(here, '../benchmarks/latest.json')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
