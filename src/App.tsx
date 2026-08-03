import { useCallback, useState } from 'react'
import { detectHubSpotMapping, normalizeContacts, parseCSV } from './core/csv'
import { findDuplicateGroups } from './core/matcher'
import { buildMergeSuggestions, downloadFile, exportCleanedCSV } from './core/export'
import type { ColumnMapping, DedupeField, DuplicateGroup, ParseResult } from './core/types'
import demoCsvUrl from './data/demo-hubspot-contacts.csv?url'
import './App.css'

type Step = 'upload' | 'mapping' | 'results'

const FIELD_LABELS: Record<DedupeField, string> = {
  email: 'Email',
  firstName: 'First Name',
  lastName: 'Last Name',
  phone: 'Phone',
  company: 'Company',
}

const FIELD_ORDER: DedupeField[] = ['email', 'firstName', 'lastName', 'phone', 'company']

export default function App() {
  const [step, setStep] = useState<Step>('upload')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({ email: null, firstName: null, lastName: null, phone: null, company: null })
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<{ groups: DuplicateGroup[]; unique: number; total: number } | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file')
      return
    }
    try {
      const r = await parseCSV(file)
      setParseResult(r)
      setMapping(detectHubSpotMapping(r.headers))
      setStep('mapping')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleLoadDemo = useCallback(async () => {
    const res = await fetch(demoCsvUrl)
    const blob = await res.blob()
    handleFile(new File([blob], 'demo.csv', { type: 'text/csv' }))
  }, [handleFile])

  const mappingComplete = mapping.email !== null

  const handleStartScan = useCallback(() => {
    if (!parseResult || !mapping.email) return
    const contacts = normalizeContacts(parseResult.rows, mapping)
    const { groups, uniqueContacts } = findDuplicateGroups(contacts)
    setResult({ groups, unique: uniqueContacts.length, total: contacts.length })
    setContacts(contacts)
    setStep('results')
  }, [parseResult, mapping])

  const [contacts, setContacts] = useState<import('./core/types').Contact[]>([])

  const updateMappingField = (field: DedupeField, column: string) => {
    setMapping(prev => ({ ...prev, [field]: column || null }))
  }

  // --- Upload step ---
  if (step === 'upload') {
    return (
      <div className="app-container">
        <header>
          <h1>HubSpot Duplicate Contact Checker</h1>
          <p>Upload your HubSpot contact CSV. Find duplicates that exact-match tools miss.</p>
        </header>
        <div className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}>
          <div className="drop-zone-content">
            <span className="drop-icon">📁</span>
            <p>Drag &amp; drop your HubSpot contact CSV here</p>
            <p className="sub">or</p>
            <label className="file-btn">
              Choose file
              <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} hidden />
            </label>
          </div>
        </div>
        <div className="demo-section">
          <button className="demo-btn" onClick={handleLoadDemo}>Try with demo CSV (15 contacts)</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="privacy-note">Your file is processed locally. Nothing leaves your device.</div>
      </div>
    )
  }

  // --- Mapping step ---
  if (step === 'mapping' && parseResult) {
    return (
      <div className="app-container">
        <header>
          <h1>Confirm Column Mapping</h1>
          <p>{parseResult.totalRows} rows detected. Verify the column mapping below.</p>
        </header>
        <div className="mapping-grid">
          {FIELD_ORDER.map(field => (
            <div key={field} className="mapping-row">
              <label>{FIELD_LABELS[field]}</label>
              <select value={mapping[field] ?? ''} onChange={(e) => updateMappingField(field, e.target.value)}>
                <option value="">— Skip —</option>
                {parseResult.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              {mapping[field] && (
                <span className="preview-value">{parseResult.rows[0]?.[mapping[field] as string] ?? ''}</span>
              )}
            </div>
          ))}
        </div>
        <div className="preview-section">
          <h3>Preview (first 3 rows)</h3>
          <table>
            <thead><tr>{parseResult.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {parseResult.rows.slice(0, 3).map((row, i) => (
                <tr key={i}>{parseResult.headers.map(h => <td key={h}>{row[h] ?? ''}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="scan-btn" disabled={!mappingComplete} onClick={handleStartScan}>
          {mappingComplete ? `Scan ${parseResult.totalRows} contacts for duplicates` : 'Map at least the Email column to start'}
        </button>
        <button className="back-btn" onClick={() => setStep('upload')}>← Back</button>
      </div>
    )
  }

  // --- Results step ---
  if (step === 'results' && result) {
    const highRisk = result.groups.filter(g => g.riskLevel === 'certain' || g.riskLevel === 'likely')
    const mediumRisk = result.groups.filter(g => g.riskLevel === 'possible')

    return (
      <div className="app-container">
        <header>
          <h1>Scan Complete</h1>
          <p>{result.total} contacts scanned &middot; {result.groups.length} duplicate groups found &middot; {result.unique} unique</p>
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
            <span className="card-num">{result.unique}</span>
            <span className="card-label">Unique Contacts</span>
          </div>
        </div>

        {result.groups.length === 0 ? (
          <div className="no-results">
            <p>No duplicates found. Your contact list looks clean.</p>
          </div>
        ) : (
          <div className="groups-list">
            {result.groups.map(group => (
              <div key={group.id} className={`group-card ${group.riskLevel}`}>
                <div className="group-header">
                  <div>
                    <span className={`risk-badge ${group.riskLevel}`}>
                      {group.riskLevel === 'certain' ? '🔴' : group.riskLevel === 'likely' ? '🟠' : '🟡'} {group.riskScore}%
                    </span>
                    <span className="group-size">{group.contacts.length} contacts</span>
                  </div>
                  <span className="master-label">Master: <strong>{group.masterContact.email || group.masterContact.firstName || '—'}</strong></span>
                </div>
                <table className="group-table">
                  <thead>
                    <tr>
                      <th></th>
                      {FIELD_ORDER.map(f => <th key={f}>{FIELD_LABELS[f]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {group.contacts.map(c => (
                      <tr key={c.rowIndex} className={c.rowIndex === group.masterContact.rowIndex ? 'master-row' : ''}>
                        <td>{c.rowIndex === group.masterContact.rowIndex ? '★' : ''}</td>
                        {FIELD_ORDER.map(f => {
                          const value = c[f]
                          const masterValue = group.masterContact[f]
                          const differs = value !== masterValue && value && masterValue
                          return (
                            <td key={f} className={differs ? 'diff-cell' : ''} title={differs ? 'Differs from master' : undefined}>
                              {value || <span className="empty">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(() => {
                  const suggestions = buildMergeSuggestions(group)
                  if (suggestions.length === 0) return null
                  return (
                    <div className="merge-suggestions">
                      <strong>Merge suggestions:</strong>
                      <ul>
                        {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>
        )}

        {result.groups.length > 0 && (
          <button className="scan-btn" onClick={() => {
            const csv = exportCleanedCSV(result.groups, [], contacts)
            downloadFile(csv, 'hubspot-contacts-deduplicated.csv')
          }}>
            Download Cleaned CSV
          </button>
        )}

        <button className="back-btn" onClick={() => setStep('upload')}>← Upload another file</button>
      </div>
    )
  }

  return null
}
