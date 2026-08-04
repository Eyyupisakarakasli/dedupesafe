import { normalizeContacts } from './csv'
import { findDuplicateGroups } from './matcher'
import type { ColumnMapping, Contact, DuplicateGroup } from './types'

export interface ScanRequest {
  rows: Record<string, string>[]
  mapping: ColumnMapping
}

export type ScanResponse =
  | { type: 'progress'; done: number; total: number }
  | {
      type: 'done'
      groups: DuplicateGroup[]
      reviewGroups: DuplicateGroup[]
      uniqueContacts: Contact[]
      contacts: Contact[]
    }
  | { type: 'error'; message: string }

const post = (message: ScanResponse) => { self.postMessage(message) }

self.onmessage = (event: MessageEvent<ScanRequest>) => {
  try {
    const { rows, mapping } = event.data
    const contacts = normalizeContacts(rows, mapping)
    const { groups, reviewGroups, uniqueContacts } = findDuplicateGroups(contacts, {
      onProgress: (done, total) => post({ type: 'progress', done, total }),
    })
    post({ type: 'done', groups, reviewGroups, uniqueContacts, contacts })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : 'The scan failed unexpectedly.' })
  }
}
