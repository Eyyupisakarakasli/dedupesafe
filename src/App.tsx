import { useCallback, useEffect, useRef, useState } from 'react'
import { detectHubSpotMapping, looksLikeContactExport, normalizeContacts, parseCSV } from './core/csv'
import { findDuplicateGroups } from './core/matcher'
import { ResultsStep } from './Review'
export { ResultsStep } from './Review'
import { ProductFooter } from './ProductFooter'
import { selectGroupRow, setRowSeparate } from './core/review-state'
import type { ColumnMapping, Contact, DedupeField, DuplicateGroup, ParseResult } from './core/types'
import type { ScanResponse } from './core/scan.worker'
import demoCsvText from './data/demo-hubspot-contacts.csv?raw'

type Step = 'upload' | 'mapping' | 'scanning' | 'results'

const FIELD_LABELS: Record<DedupeField, string> = {
  email: 'Email',
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone',
  company: 'Company',
}

const FIELD_ORDER: DedupeField[] = ['email', 'firstName', 'lastName', 'phone', 'company']
const MAX_FILE_BYTES = 50 * 1024 * 1024
const SLOW_SCAN_ROWS = 20_000

export interface ScanResult {
  groups: DuplicateGroup[]
  reviewGroups: DuplicateGroup[]
  uniqueContacts: Contact[]
  contacts: Contact[]
  total: number
}

const EMPTY_MAPPING: ColumnMapping = {
  email: null, firstName: null, lastName: null, phone: null, company: null,
}

export default function App() {
  const [step, setStep] = useState<Step>('upload')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState(0)
  const [selectionRevision, setSelectionRevision] = useState(0)
  const workerRef = useRef<Worker | null>(null)

  // A scan still running when the component unmounts must not outlive it.
  useEffect(() => () => workerRef.current?.terminate(), [])

  const resetAll = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setParseResult(null)
    setMapping(EMPTY_MAPPING)
    setResult(null)
    setDismissedIds(new Set())
    setConfirmedIds(new Set())
    setError(null)
    setStep('upload')
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    const isCsv = file.name.toLowerCase().endsWith('.csv') ||
      file.type === 'text/csv' || file.type === 'application/vnd.ms-excel'
    if (!isCsv) {
      setError('Please choose a .csv file. Export your contacts from HubSpot in CSV format.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is 50 MB — try exporting in smaller batches.`)
      return
    }
    try {
      const parsed = await parseCSV(file)
      const detected = detectHubSpotMapping(parsed.headers)
      setParseResult(parsed)
      setMapping(detected)
      setResult(null)
      setDismissedIds(new Set())
      setConfirmedIds(new Set())
      setStep('mapping')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read that CSV.')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }, [handleFile])

  // The demo CSV is inlined at build time, not fetched, so the page can run
  // under `connect-src 'none'` and make no network requests at all.
  const handleLoadDemo = useCallback(() => {
    void handleFile(new File([demoCsvText], 'demo-hubspot-contacts.csv', { type: 'text/csv' }))
  }, [handleFile])

  useEffect(() => {
    if (step === 'upload' && new URLSearchParams(location.search).get('demo') === '1') {
      // The URL is an external navigation signal; loading its bundled demo is
      // the state synchronization this effect exists to perform.
      // oxlint-disable-next-line react/set-state-in-effect
      handleLoadDemo()
    }
  }, [handleLoadDemo, step])

  const handleStartScan = useCallback(() => {
    if (!parseResult || !mapping.email) return
    setError(null)
    setDismissedIds(new Set())
    setConfirmedIds(new Set())
    setProgress(0)
    setStep('scanning')

    const finish = (
      contacts: Contact[],
      groups: DuplicateGroup[],
      reviewGroups: DuplicateGroup[],
      uniqueContacts: Contact[],
    ) => {
      setResult({ groups, reviewGroups, uniqueContacts, contacts, total: contacts.length })
      setStep('results')
    }
    const fail = (message: string) => {
      setError(message)
      setStep('mapping')
    }

    // Run the scan on a worker so the page stays interactive and cancellable.
    // Falls back to running inline where workers are unavailable.
    try {
      const worker = new Worker(new URL('./core/scan.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      worker.onmessage = (event: MessageEvent<ScanResponse>) => {
        const msg = event.data
        if (msg.type === 'progress') {
          setProgress(msg.total > 0 ? msg.done / msg.total : 0)
        } else if (msg.type === 'done') {
          worker.terminate()
          workerRef.current = null
          finish(msg.contacts, msg.groups, msg.reviewGroups, msg.uniqueContacts)
        } else {
          worker.terminate()
          workerRef.current = null
          fail(msg.message)
        }
      }
      worker.onerror = () => {
        worker.terminate()
        workerRef.current = null
        fail('The scan worker failed to start.')
      }
      worker.postMessage({ rows: parseResult.rows, mapping })
      return
    } catch {
      // fall through to the inline path
    }

    setTimeout(() => {
      try {
        const contacts = normalizeContacts(parseResult.rows, mapping)
        const { groups, reviewGroups, uniqueContacts } = findDuplicateGroups(contacts)
        finish(contacts, groups, reviewGroups, uniqueContacts)
      } catch (err) {
        fail(err instanceof Error ? err.message : 'The scan failed unexpectedly.')
      }
    }, 50)
  }, [parseResult, mapping])

  const cancelScan = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setStep('mapping')
  }, [])

  const updateMappingField = useCallback((field: DedupeField, column: string) => {
    setMapping(prev => ({ ...prev, [field]: column || null }))
  }, [])

  const dismissGroup = useCallback((id: string) => {
    setDismissedIds(prev => new Set(prev).add(id))
  }, [])

  const restoreGroup = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const confirmGroup = useCallback((id: string) => {
    setConfirmedIds(prev => new Set(prev).add(id))
  }, [])

  const unconfirmGroup = useCallback((id: string) => {
    setConfirmedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const editGroup = useCallback((id: string, change: (group: DuplicateGroup) => DuplicateGroup) => {
    setResult(previous => {
      if (!previous) return previous
      const update = (group: DuplicateGroup) => group.id === id ? change(group) : group
      return { ...previous, groups: previous.groups.map(update), reviewGroups: previous.reviewGroups.map(update) }
    })
    setConfirmedIds(previous => { const next = new Set(previous); next.delete(id); return next })
    setDismissedIds(previous => { const next = new Set(previous); next.delete(id); return next })
    setSelectionRevision(previous => previous + 1)
  }, [])
  const selectRow = useCallback((id: string, rowIndex: number) => {
    editGroup(id, group => selectGroupRow(group, rowIndex))
  }, [editGroup])
  const separateRow = useCallback((id: string, rowIndex: number, separate: boolean) => {
    editGroup(id, group => setRowSeparate(group, rowIndex, separate))
  }, [editGroup])
  if (step === 'upload') {
    return (
      <UploadStep
        dragOver={dragOver}
        error={error}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onFile={handleFile}
        onDemo={handleLoadDemo}
      />
    )
  }

  if (step === 'mapping' && parseResult) {
    return (
      <MappingStep
        parseResult={parseResult}
        mapping={mapping}
        error={error}
        onChange={updateMappingField}
        onScan={handleStartScan}
        onBack={resetAll}
      />
    )
  }

  if (step === 'scanning') {
    const pct = Math.round(progress * 100)
    return (
      <div className="app-container">
        <a className="app-brand" href="/">DedupeSafe</a>
        <header>
          <h1>Scanning for duplicate candidates…</h1>
          {parseResult && <p>Comparing {parseResult.totalRows.toLocaleString()} contacts</p>}
        </header>
        <div className="scanning-indicator" role="status" aria-live="polite">
          <div className="spinner" />
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="progress-fill" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          <p className="sub">{pct > 0 ? `${pct}% complete` : 'Starting…'} · runs entirely on your device</p>
        </div>
        <button className="back-btn" onClick={cancelScan}>Cancel</button>
        <ProductFooter />
      </div>
    )
  }

  if (step === 'results' && result) {
    return (
      <ResultsStep
        selectionRevision={selectionRevision}
        result={result}
        headers={parseResult?.headers}
        dismissedIds={dismissedIds}
        confirmedIds={confirmedIds}
        onDismiss={dismissGroup}
        onConfirm={confirmGroup}
        onUnconfirm={unconfirmGroup}
        onSelectRow={selectRow}
        onSeparateRow={separateRow}
        onRestore={restoreGroup}
        onRestoreAll={() => setDismissedIds(new Set())}
        onBack={resetAll}
      />
    )
  }

  return null
}

// ---------------------------------------------------------------- upload

function UploadStep({ dragOver, error, onDrop, onDragOver, onDragLeave, onFile, onDemo }: {
  dragOver: boolean
  error: string | null
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onFile: (file: File) => void
  onDemo: () => void
}) {
  return (
    <div className="app-container">
      <a className="app-brand" href="/">DedupeSafe</a>
      <header>
        <h1>Private duplicate contact review</h1>
        <p>Check a HubSpot contact CSV locally. Nothing is removed until you approve it.</p>
      </header>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="drop-zone-content">
          <span className="drop-icon" aria-hidden="true">.csv</span>
          <p>Drag &amp; drop your HubSpot contact CSV here</p>
          <p className="sub">or</p>
          {/* Visually hidden rather than `hidden`, so the input stays in the tab order. */}
          <label className="file-btn" htmlFor="csv-input">Choose file</label>
          <input
            id="csv-input"
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
          />
        </div>
      </div>

      <div className="demo-section">
        <button className="demo-btn" onClick={onDemo}>Try with demo CSV (15 contacts)</button>
      </div>
      <details className="inline-help">
        <summary>Need a contact CSV?</summary>
        <p>Export your contacts in CSV format. Include Email, First Name, Last Name, Phone and Company where available. Keep the original file as a backup. File limit: 50 MB.</p>
        <a href="https://knowledge.hubspot.com/import-and-export/export-records" target="_blank" rel="noreferrer">HubSpot’s export instructions ↗</a>
      </details>

      {error && <div className="error-msg" role="alert">{error}</div>}

      <div className="privacy-note">
        Your file is processed locally. The checker cannot open a network connection.
      </div>
      <ProductFooter />
    </div>
  )
}

// ---------------------------------------------------------------- mapping

function MappingStep({ parseResult, mapping, error, onChange, onScan, onBack }: {
  parseResult: ParseResult
  mapping: ColumnMapping
  error: string | null
  onChange: (field: DedupeField, column: string) => void
  onScan: () => void
  onBack: () => void
}) {
  const ready = mapping.email !== null
  const recognised = looksLikeContactExport(mapping)

  return (
    <div className="app-container">
      <a className="app-brand" href="/">DedupeSafe</a>
      <header>
        <h1>Confirm Column Mapping</h1>
        <p>{parseResult.totalRows.toLocaleString()} rows detected. Check each column below before scanning.</p>
        <p className="mapping-help">Choose the column containing each value. The example beside it comes from your first row. Email is required; leave other fields on Skip if your file does not include them.</p>
      </header>

      {!recognised && (
        <div className="warning-banner" role="alert">
          This doesn’t look like a HubSpot contact export — no email or name column was recognised.
          Pick the right columns manually, or re-export from HubSpot.
        </div>
      )}

      {parseResult.warnings.length > 0 && (
        <div className="warning-banner" role="alert">
          {parseResult.warnings.join('; ')}. Extra values were dropped — check your export.
        </div>
      )}

      <div className="mapping-grid">
        {FIELD_ORDER.map(field => {
          const id = `map-${field}`
          const sample = mapping[field] ? parseResult.rows[0]?.[mapping[field] as string] ?? '' : ''
          return (
            <div key={field} className="mapping-row">
              <label htmlFor={id}>{FIELD_LABELS[field]}</label>
              <select
                id={id}
                value={mapping[field] ?? ''}
                onChange={(e) => onChange(field, e.target.value)}
              >
                <option value="">— Skip —</option>
                {parseResult.headers.map((h, i) => (
                  <option key={`${h}-${i}`} value={h}>{h}</option>
                ))}
              </select>
              <span className="preview-value" title={sample}>{sample}</span>
            </div>
          )
        })}
      </div>

      <div className="preview-section">
        <h2>Preview (first 3 rows)</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>{parseResult.headers.map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {parseResult.rows.slice(0, 3).map((row, i) => (
                <tr key={i}>
                  {parseResult.headers.map((h, j) => <td key={`${h}-${j}`}>{row[h] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {parseResult.totalRows > SLOW_SCAN_ROWS && (
        <div className="warning-banner">
          {parseResult.totalRows.toLocaleString()} contacts may take longer to compare. You can cancel the scan and try a smaller export.
        </div>
      )}

      {error && <div className="error-msg" role="alert">{error}</div>}

      <button className="scan-btn" disabled={!ready} onClick={onScan}>
        {ready
          ? `Scan ${parseResult.totalRows.toLocaleString()} contacts for duplicates`
          : 'Map the Email column to start'}
      </button>
      <button className="back-btn" onClick={onBack}>← Start over</button>
      <ProductFooter />
    </div>
  )
}
