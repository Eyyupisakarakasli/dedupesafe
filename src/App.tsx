import { useCallback, useEffect, useRef, useState } from 'react'
import { detectHubSpotMapping, looksLikeContactExport, normalizeContacts, parseCSV } from './core/csv'
import { findDuplicateGroups } from './core/matcher'
import { buildMergeSuggestions, downloadFile, exportAuditCSV, exportCleanedCSV } from './core/export'
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
        key={`${[...confirmedIds].sort().join('|')}::${[...dismissedIds].sort().join('|')}`}
        result={result}
        headers={parseResult?.headers}
        dismissedIds={dismissedIds}
        confirmedIds={confirmedIds}
        onDismiss={dismissGroup}
        onConfirm={confirmGroup}
        onUnconfirm={unconfirmGroup}
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
      <ProductFooter />
    </div>
  )
}

// ---------------------------------------------------------------- results

export function ResultsStep({
  result, headers, dismissedIds, confirmedIds,
  onDismiss, onConfirm, onUnconfirm, onRestore, onRestoreAll, onBack,
}: {
  result: ScanResult
  headers: string[] | undefined
  dismissedIds: Set<string>
  confirmedIds: Set<string>
  onDismiss: (id: string) => void
  onConfirm: (id: string) => void
  onUnconfirm: (id: string) => void
  onRestore: (id: string) => void
  onRestoreAll: () => void
  onBack: () => void
}) {
  const [exportReviewOpen, setExportReviewOpen] = useState(false)
  const [exportConfirmed, setExportConfirmed] = useState(false)
  const [auditStarted, setAuditStarted] = useState(false)
  const allGroups = [...result.groups, ...result.reviewGroups]
  const approvedGroups = allGroups.filter(g => confirmedIds.has(g.id) && !dismissedIds.has(g.id))
  const pendingGroups = allGroups.filter(g => !confirmedIds.has(g.id) && !dismissedIds.has(g.id))
  const dismissedGroups = allGroups.filter(g => dismissedIds.has(g.id))

  // Unreviewed and rejected groups are always kept in full. Only an explicit
  // merge decision can remove rows from the export.
  const keptWhole = [...dismissedGroups, ...pendingGroups].flatMap(g => g.contacts)
  const rowsAfterCleanup = result.uniqueContacts.length + keptWhole.length + approvedGroups.length
  const rowsRemoved = result.total - rowsAfterCleanup

  const handleDownload = () => {
    if (!exportConfirmed || (rowsRemoved > 0 && !auditStarted)) return
    const csv = exportCleanedCSV(
      approvedGroups,
      [...result.uniqueContacts, ...keptWhole],
      result.contacts,
      headers,
    )
    downloadFile(csv, 'dedupesafe-reviewed-contacts.csv')
  }

  const handleAuditDownload = () => {
    const csv = exportAuditCSV(allGroups, confirmedIds, dismissedIds, headers)
    downloadFile(csv, 'dedupesafe-audit-report.csv')
    setAuditStarted(true)
  }

  return (
    <div className="app-container">
      <a className="app-brand" href="/">DedupeSafe</a>
      <header>
        <h1>Scan Complete</h1>
        <p>
          {result.total.toLocaleString()} contacts scanned · {allGroups.length} candidate
          {allGroups.length === 1 ? ' group' : ' groups'} · no rows removed yet
        </p>
      </header>

      <div className="summary-cards">
        <div className="summary-card high">
          <span className="card-num">{approvedGroups.length}</span>
          <span className="card-label">Approved groups</span>
        </div>
        <div className="summary-card medium">
          <span className="card-num">{pendingGroups.length}</span>
          <span className="card-label">Awaiting decision</span>
        </div>
        <div className="summary-card unique">
          <span className="card-num">{result.uniqueContacts.length.toLocaleString()}</span>
          <span className="card-label">No candidate match</span>
        </div>
      </div>

      {allGroups.length === 0 ? (
        <div className="no-results">
          <p>No duplicate candidates were found. The original rows remain unchanged.</p>
        </div>
      ) : null}

      {pendingGroups.length > 0 && (
        <div className="review-section">
          <div className="review-intro">
            <strong>Needs your decision ({pendingGroups.length})</strong>
            <p>
              Compare each group. Choose <strong>Keep selected row</strong> only when the rows describe
              the same person. Unreviewed groups and groups marked <strong>Keep both</strong> remain
              intact in the export.
            </p>
          </div>
          {pendingGroups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onDismiss={onDismiss}
              onConfirm={onConfirm}
            />
          ))}
        </div>
      )}

      {approvedGroups.length > 0 && (
        <div className="approved-section">
          <div className="review-intro">
            <strong>Approved groups ({approvedGroups.length})</strong>
            <p>Only these groups will collapse to one row. Undo any decision you are unsure about.</p>
          </div>
          {approvedGroups.map(group => (
            <GroupCard key={group.id} group={group} onDismiss={onDismiss} onUnconfirm={onUnconfirm} />
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
                  {group.riskLevel === 'review' ? 'name match only' : `${group.riskScore}/100 score`} · {group.contacts.length} contacts ·{' '}
                  {group.contacts.map(c => c.email || `${c.firstName} ${c.lastName}`.trim() || `row ${c.rowIndex + 2}`).join(', ')}
                </span>
                <button className="link-btn" onClick={() => onRestore(group.id)}>Restore</button>
              </li>
            ))}
          </ul>
          <p className="dismissed-note">All contacts in these groups are kept in the exported CSV.</p>
        </div>
      )}

      {allGroups.length > 0 && (
        <div className="export-panel">
          <p className="export-summary">
            Export keeps <strong>{rowsAfterCleanup.toLocaleString()}</strong> of {result.total.toLocaleString()} contacts
            {rowsRemoved > 0
              ? <> · removes {rowsRemoved.toLocaleString()} approved duplicate row{rowsRemoved === 1 ? '' : 's'}</>
              : ' · nothing removed'}
          </p>
          <div className="export-actions">
            <button className="scan-btn" onClick={() => setExportReviewOpen(true)}>Review export</button>
            <button className="back-btn" onClick={handleAuditDownload}>Download audit report</button>
          </div>
          {exportReviewOpen && (
            <div className="export-review" role="region" aria-label="Final export confirmation">
              <h2>Final export check</h2>
              <p>This export keeps the selected row from each approved group. It does not combine fields or merge records inside HubSpot. Every source field from candidate rows is preserved in the audit report.</p>
              {rowsRemoved > 0 && <p>{auditStarted
                ? 'Audit download started. Check that the file was saved before continuing.'
                : 'Download the audit report before exporting fewer rows. Keep it private: it contains all original fields, including custom fields.'}</p>}
              <dl>
                <div><dt>Original rows</dt><dd>{result.total.toLocaleString()}</dd></div>
                <div><dt>Approved groups</dt><dd>{approvedGroups.length}</dd></div>
                <div><dt>Rows removed</dt><dd>{rowsRemoved.toLocaleString()}</dd></div>
                <div><dt>Rows in export</dt><dd>{rowsAfterCleanup.toLocaleString()}</dd></div>
              </dl>
              <label className="confirm-export">
                <input
                  type="checkbox"
                  checked={exportConfirmed}
                  onChange={(event) => setExportConfirmed(event.target.checked)}
                />
                I reviewed every approved group and kept the original CSV as a backup.
              </label>
              <button className="scan-btn" disabled={!exportConfirmed || (rowsRemoved > 0 && !auditStarted)} onClick={handleDownload}>
                Download reviewed CSV
              </button>
            </div>
          )}
        </div>
      )}

      <button className="back-btn" onClick={onBack}>← Upload another file</button>
      <ProductFooter />
    </div>
  )
}

function GroupCard({ group, onDismiss, onConfirm, onUnconfirm }: {
  group: DuplicateGroup
  onDismiss: (id: string) => void
  onConfirm?: (id: string) => void
  onUnconfirm?: (id: string) => void
}) {
  const suggestions = buildMergeSuggestions(group)
  const isReview = group.riskLevel === 'review'
  const isApproved = Boolean(onUnconfirm)
  const icon = isReview ? '🔎'
    : group.riskLevel === 'certain' ? '🔴'
    : group.riskLevel === 'likely' ? '🟠' : '🟡'

  return (
    <div className={`group-card ${group.riskLevel}`}>
      <div className="group-header">
        <div>
          <span className={`risk-badge ${group.riskLevel}`}>
            <span aria-hidden="true">{icon}</span>{' '}
            {isReview ? 'name match only' : `${group.riskScore}/100 score ${group.riskLevel}`}
          </span>
          <span className="group-size">{group.contacts.length} contacts</span>
        </div>
        <div className="group-actions">
          <span className="master-label">
            {isApproved ? 'Will keep: ' : 'Suggested row: '}
            <strong>{group.masterContact.email || group.masterContact.firstName || '—'}</strong>
          </span>
          {onConfirm && (
            <button
              className="confirm-btn"
              onClick={() => onConfirm(group.id)}
              title="Treat these as the same person and collapse them on export"
            >
              Keep selected row
            </button>
          )}
          {onUnconfirm ? (
            <button className="dismiss-btn" onClick={() => onUnconfirm(group.id)}>Undo selection</button>
          ) : (
            <button
              className="dismiss-btn"
              onClick={() => onDismiss(group.id)}
              title="Keep all of these contacts as separate rows"
            >
              Keep both
            </button>
          )}
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
          <strong>{isApproved ? 'Other values to review in the full audit report:' : 'Other values to review in the full audit report:'}</strong>
          <ul>
            {suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function ProductFooter() {
  return (
    <footer className="product-footer">
      <a href="/privacy/">Privacy</a>
      <a href="/limitations/">Limitations</a>
      <a href="https://github.com/Eyyupisakarakasli/dedupesafe/issues">Feedback</a>
      <p>Independent of and not authorized, endorsed, sponsored or approved by HubSpot, Inc.</p>
    </footer>
  )
}
