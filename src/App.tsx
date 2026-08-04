import { useCallback, useState } from 'react'
import { detectHubSpotMapping, looksLikeContactExport, normalizeContacts, parseCSV } from './core/csv'
import { findDuplicateGroups } from './core/matcher'
import { buildMergeSuggestions, downloadFile, exportCleanedCSV } from './core/export'
import type { ColumnMapping, Contact, DedupeField, DuplicateGroup, ParseResult } from './core/types'
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

interface ScanResult {
  groups: DuplicateGroup[]
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

  const resetAll = useCallback(() => {
    setParseResult(null)
    setMapping(EMPTY_MAPPING)
    setResult(null)
    setDismissedIds(new Set())
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

  const handleStartScan = useCallback(() => {
    if (!parseResult || !mapping.email) return
    setError(null)
    setDismissedIds(new Set())
    setStep('scanning')
    // Yield once so the spinner paints before the synchronous scan blocks the thread.
    setTimeout(() => {
      try {
        const contacts = normalizeContacts(parseResult.rows, mapping)
        const { groups, uniqueContacts } = findDuplicateGroups(contacts)
        setResult({ groups, uniqueContacts, contacts, total: contacts.length })
        setStep('results')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The scan failed unexpectedly.')
        setStep('mapping')
      }
    }, 50)
  }, [parseResult, mapping])

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
    return (
      <div className="app-container">
        <header>
          <h1>Scanning for duplicates…</h1>
          {parseResult && <p>Comparing {parseResult.totalRows.toLocaleString()} contacts</p>}
        </header>
        <div className="scanning-indicator" role="status" aria-live="polite">
          <div className="spinner" />
          <p className="sub">This runs entirely on your device.</p>
        </div>
      </div>
    )
  }

  if (step === 'results' && result) {
    return (
      <ResultsStep
        result={result}
        headers={parseResult?.headers}
        dismissedIds={dismissedIds}
        onDismiss={dismissGroup}
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
      <header>
        <h1>HubSpot Duplicate Contact Checker</h1>
        <p>Upload your HubSpot contact CSV. Find duplicates that exact-match tools miss.</p>
      </header>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="drop-zone-content">
          <span className="drop-icon" aria-hidden="true">📁</span>
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

      {error && <div className="error-msg" role="alert">{error}</div>}

      <div className="privacy-note">
        Your file is processed locally. Nothing leaves your device.
      </div>
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
      <header>
        <h1>Confirm Column Mapping</h1>
        <p>{parseResult.totalRows.toLocaleString()} rows detected. Check each column below before scanning.</p>
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
          {parseResult.totalRows.toLocaleString()} contacts is a large scan — the page will be busy
          for a while and may appear frozen. Consider exporting in smaller batches.
        </div>
      )}

      {error && <div className="error-msg" role="alert">{error}</div>}

      <button className="scan-btn" disabled={!ready} onClick={onScan}>
        {ready
          ? `Scan ${parseResult.totalRows.toLocaleString()} contacts for duplicates`
          : 'Map the Email column to start'}
      </button>
      <button className="back-btn" onClick={onBack}>← Start over</button>
    </div>
  )
}

// ---------------------------------------------------------------- results

function ResultsStep({ result, headers, dismissedIds, onDismiss, onRestore, onRestoreAll, onBack }: {
  result: ScanResult
  headers: string[] | undefined
  dismissedIds: Set<string>
  onDismiss: (id: string) => void
  onRestore: (id: string) => void
  onRestoreAll: () => void
  onBack: () => void
}) {
  const activeGroups = result.groups.filter(g => !dismissedIds.has(g.id))
  const dismissedGroups = result.groups.filter(g => dismissedIds.has(g.id))
  const highRisk = activeGroups.filter(g => g.riskLevel === 'certain' || g.riskLevel === 'likely')
  const mediumRisk = activeGroups.filter(g => g.riskLevel === 'possible')

  // Contacts in a dismissed group are kept in full — they are not duplicates.
  const keptFromDismissed = dismissedGroups.flatMap(g => g.contacts)
  const rowsAfterCleanup = result.uniqueContacts.length + keptFromDismissed.length + activeGroups.length
  const rowsRemoved = result.total - rowsAfterCleanup

  const handleDownload = () => {
    const csv = exportCleanedCSV(
      activeGroups,
      [...result.uniqueContacts, ...keptFromDismissed],
      result.contacts,
      headers,
    )
    downloadFile(csv, 'hubspot-contacts-deduplicated.csv')
  }

  return (
    <div className="app-container">
      <header>
        <h1>Scan Complete</h1>
        <p>
          {result.total.toLocaleString()} contacts scanned · {activeGroups.length} duplicate
          {activeGroups.length === 1 ? ' group' : ' groups'} found · {result.uniqueContacts.length.toLocaleString()} unique
        </p>
      </header>

      <div className="summary-cards">
        <div className="summary-card high">
          <span className="card-num">{highRisk.length}</span>
          <span className="card-label">High Risk Groups</span>
        </div>
        <div className="summary-card medium">
          <span className="card-num">{mediumRisk.length}</span>
          <span className="card-label">Medium Risk Groups</span>
        </div>
        <div className="summary-card unique">
          <span className="card-num">{result.uniqueContacts.length.toLocaleString()}</span>
          <span className="card-label">Unique Contacts</span>
        </div>
      </div>

      {activeGroups.length === 0 ? (
        <div className="no-results">
          <p>{dismissedGroups.length > 0
            ? 'No duplicate groups left — you marked them all as not duplicates.'
            : 'No duplicates found. Your contact list looks clean.'}</p>
        </div>
      ) : (
        <div className="groups-list">
          {activeGroups.map(group => (
            <GroupCard key={group.id} group={group} onDismiss={onDismiss} />
          ))}
        </div>
      )}

      {dismissedGroups.length > 0 && (
        <div className="dismissed-section">
          <div className="dismissed-header">
            <strong>Marked as not duplicates ({dismissedGroups.length})</strong>
            <button className="link-btn" onClick={onRestoreAll}>Restore all</button>
          </div>
          <ul className="dismissed-list">
            {dismissedGroups.map(group => (
              <li key={group.id}>
                <span className="dismissed-label">
                  {group.riskScore}% · {group.contacts.length} contacts ·{' '}
                  {group.contacts.map(c => c.email || `${c.firstName} ${c.lastName}`.trim() || `row ${c.rowIndex + 2}`).join(', ')}
                </span>
                <button className="link-btn" onClick={() => onRestore(group.id)}>Restore</button>
              </li>
            ))}
          </ul>
          <p className="dismissed-note">All contacts in these groups are kept in the exported CSV.</p>
        </div>
      )}

      {result.groups.length > 0 && (
        <>
          <p className="export-summary">
            Export keeps <strong>{rowsAfterCleanup.toLocaleString()}</strong> of {result.total.toLocaleString()} contacts
            {rowsRemoved > 0
              ? <> · removes {rowsRemoved.toLocaleString()} duplicate row{rowsRemoved === 1 ? '' : 's'}</>
              : ' · nothing removed'}
          </p>
          <button className="scan-btn" onClick={handleDownload}>Download Cleaned CSV</button>
        </>
      )}

      <button className="back-btn" onClick={onBack}>← Upload another file</button>
    </div>
  )
}

function GroupCard({ group, onDismiss }: {
  group: DuplicateGroup
  onDismiss: (id: string) => void
}) {
  const suggestions = buildMergeSuggestions(group)
  const icon = group.riskLevel === 'certain' ? '🔴' : group.riskLevel === 'likely' ? '🟠' : '🟡'

  return (
    <div className={`group-card ${group.riskLevel}`}>
      <div className="group-header">
        <div>
          <span className={`risk-badge ${group.riskLevel}`}>
            <span aria-hidden="true">{icon}</span> {group.riskScore}% {group.riskLevel}
          </span>
          <span className="group-size">{group.contacts.length} contacts</span>
        </div>
        <div className="group-actions">
          <span className="master-label">
            Keeping: <strong>{group.masterContact.email || group.masterContact.firstName || '—'}</strong>
          </span>
          <button
            className="dismiss-btn"
            onClick={() => onDismiss(group.id)}
            title="Keep all of these contacts — they are different people"
          >
            Not a duplicate
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="group-table">
          <thead>
            <tr>
              <th><span className="visually-hidden">Kept</span></th>
              {FIELD_ORDER.map(f => <th key={f}>{FIELD_LABELS[f]}</th>)}
            </tr>
          </thead>
          <tbody>
            {group.contacts.map(c => {
              const isMaster = c.rowIndex === group.masterContact.rowIndex
              return (
                <tr key={c.rowIndex} className={isMaster ? 'master-row' : ''}>
                  <td>{isMaster ? <span title="Kept in the export">★</span> : ''}</td>
                  {FIELD_ORDER.map(f => {
                    const value = c[f]
                    const masterValue = group.masterContact[f]
                    const differs = Boolean(value && masterValue && value !== masterValue)
                    return (
                      <td
                        key={f}
                        className={differs ? 'diff-cell' : ''}
                        title={differs ? 'Differs from the record being kept' : undefined}
                      >
                        {value || <span className="empty">—</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {suggestions.length > 0 && (
        <div className="merge-suggestions">
          <strong>Before deleting, copy these into the kept record:</strong>
          <ul>
            {suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
