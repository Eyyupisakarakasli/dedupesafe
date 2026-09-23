import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ScanResult } from './App'
import type { DuplicateGroup, DedupeField } from './core/types'
import { activeContacts, effectiveGroup, sourceFields } from './core/review-state'
import { reviewSummary } from './core/review-summary'
import { downloadFile, exportAuditCSV, exportCleanedCSV } from './core/export'
import { ProductFooter } from './ProductFooter'

const FIELDS: [DedupeField, string][] = [['email', 'Email'], ['firstName', 'First Name'], ['lastName', 'Last Name'], ['phone', 'Phone'], ['company', 'Company']]
const PAGE_SIZE = 5
type Status = 'pending' | 'approved' | 'kept'
type View = { allFields: boolean; fieldsOpen: boolean; scoreOpen: boolean }
const DEFAULT_VIEW: View = { allFields: false, fieldsOpen: true, scoreOpen: false }

type ReviewProps = {
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
  onSelectRow?: (id: string, rowIndex: number) => void
  onSeparateRow?: (id: string, rowIndex: number, separate: boolean) => void
  selectionRevision?: number
}

export function ResultsStep(props: ReviewProps) {
  const { result, headers, confirmedIds, dismissedIds, onBack, selectionRevision = 0 } = props
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [page, setPage] = useState(0)
  const [views, setViews] = useState<Record<string, View>>({})
  const [announcement, setAnnouncement] = useState('')
  const queueRef = useRef<HTMLDivElement>(null)
  const focusTarget = useRef<string | null>(null)
  const allGroups = useMemo(() => [...result.groups, ...result.reviewGroups], [result])
  const status = (group: DuplicateGroup): Status => dismissedIds.has(group.id) ? 'kept'
    : confirmedIds.has(group.id) && !group.needsSelection ? 'approved' : 'pending'
  const pending = allGroups.filter(group => status(group) === 'pending')
  const approved = allGroups.filter(group => status(group) === 'approved')
  const kept = allGroups.filter(group => status(group) === 'kept')
  const needle = query.trim().toLocaleLowerCase()
  const filtered = allGroups.filter(group => (filter === 'all' || status(group) === filter) && (!needle || group.contacts.some(contact =>
    `${contact.email} ${contact.firstName} ${contact.lastName} ${contact.company}`.toLocaleLowerCase().includes(needle))))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const visibleKey = visible.map(group => group.id).join('|')

  // Only actions that remove their focused control request a new focus target.
  // Row selection leaves the radio node mounted, preserving keyboard position.
  useLayoutEffect(() => {
    if (focusTarget.current === null) return
    const cards = queueRef.current?.querySelectorAll<HTMLElement>('[data-group-id]')
    const card = Array.from(cards ?? []).find(element => element.dataset.groupId === focusTarget.current)
    ;(card?.querySelector<HTMLElement>('.group-title') ?? queueRef.current)?.focus()
    focusTarget.current = null
  }, [visibleKey, confirmedIds, dismissedIds, selectionRevision, currentPage, filter, query])

  const act = (id: string, callback: (id: string) => void, message: string) => {
    const next = visible.find(group => group.id !== id && status(group) === 'pending')
    focusTarget.current = filter === 'all' ? id : next?.id ?? ''
    callback(id)
    setAnnouncement(message)
  }
  const updateView = (id: string, patch: Partial<View>) => setViews(previous => {
    const before = previous[id] ?? DEFAULT_VIEW
    const after = { ...before, ...patch }
    return before.allFields === after.allFields && before.fieldsOpen === after.fieldsOpen && before.scoreOpen === after.scoreOpen
      ? previous : { ...previous, [id]: after }
  })
  const nextPending = () => {
    const lastVisible = visible.at(-1)
    const after = lastVisible ? allGroups.findIndex(group => group.id === lastVisible.id) : -1
    const next = allGroups.slice(after + 1).find(group => status(group) === 'pending') ?? pending[0]
    if (!next) return
    setQuery('')
    setFilter('pending')
    setPage(Math.floor(pending.indexOf(next) / PAGE_SIZE))
    focusTarget.current = next.id
    // Handles navigation when the destination is already on the current page.
    requestAnimationFrame(() => {
      const card = Array.from(queueRef.current?.querySelectorAll<HTMLElement>('[data-group-id]') ?? []).find(element => element.dataset.groupId === next.id)
      card?.querySelector<HTMLElement>('.group-title')?.focus()
      focusTarget.current = null
    })
  }
  const exportKey = `${selectionRevision}:${[...confirmedIds].sort().join('|')}:${[...dismissedIds].sort().join('|')}`

  return <div className="app-container">
    <a className="app-brand" href="/">DedupeSafe</a>
    <header><h1>Scan Complete</h1><p>{result.total.toLocaleString()} contacts scanned · {allGroups.length} candidate groups · original file unchanged</p></header>
    <div className="summary-cards">
      <div className="summary-card high"><span className="card-num">{approved.length}</span><span className="card-label">Approved groups ({approved.length})</span></div>
      <div className="summary-card medium"><span className="card-num">{pending.length}</span><span className="card-label">Awaiting decision</span></div>
      <div className="summary-card unique"><span className="card-num">{result.uniqueContacts.length.toLocaleString()}</span><span className="card-label">No candidate match</span></div>
    </div>
    <p className="visually-hidden" role="status">{announcement}</p>
    {allGroups.length === 0 ? <p className="no-results">No duplicate candidates were found. The original rows remain unchanged.</p> : <>
      <div className="review-toolbar">
        <label>Search contacts<input type="search" value={query} placeholder="Name, email or company" onChange={event => { setQuery(event.target.value); setPage(0) }} /></label>
        <label>Group status<select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(0) }}>
          <option value="all">All groups ({allGroups.length})</option><option value="pending">Awaiting decision ({pending.length})</option>
          <option value="approved">Approved ({approved.length})</option><option value="kept">Kept separately ({kept.length})</option>
        </select></label>
        <button className="demo-btn" onClick={nextPending} disabled={!pending.length}>Next awaiting group</button>
      </div>
      <div className="review-queue" ref={queueRef} tabIndex={-1} aria-label="Contact review queue">
        <p className="queue-count">{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} groups` : 'No groups match this search or filter.'}</p>
        {visible.map(group => <GroupCard key={group.id} group={group} status={status(group)} view={views[group.id] ?? DEFAULT_VIEW}
          onView={patch => updateView(group.id, patch)}
          onConfirm={() => act(group.id, props.onConfirm, 'Group approved. Export confirmation was reset.')}
          onDismiss={() => act(group.id, props.onDismiss, 'All rows in this group will stay in the export.')}
          onUndo={() => act(group.id, props.onUnconfirm, 'Approval removed. All group rows will stay until you approve again.')}
          onRestore={() => act(group.id, props.onRestore, 'Group returned for review.')}
          onSelect={props.onSelectRow ? row => {
            if (filter === 'approved') focusTarget.current = ''
            props.onSelectRow?.(group.id, row)
            setAnnouncement('Selected row changed. Approve this group again before removing rows.')
          } : undefined}
          onSeparate={props.onSeparateRow ? (row, separate) => {
            focusTarget.current = group.id
            props.onSeparateRow?.(group.id, row, separate)
            setAnnouncement(separate ? 'Row kept separately. Review the remaining group again.' : 'Row returned to the group. Review the group again.')
          } : undefined} />)}
      </div>
      <nav className="queue-pages" aria-label="Review pages">
        <button className="demo-btn" disabled={currentPage === 0} onClick={() => { focusTarget.current = ''; setPage(currentPage - 1) }}>Previous page</button>
        <span>Page {currentPage + 1} of {pageCount}</span>
        <button className="demo-btn" disabled={currentPage + 1 >= pageCount} onClick={() => { focusTarget.current = ''; setPage(currentPage + 1) }}>Next page</button>
      </nav>
      {/* Reset only export authorization; queue nodes and view preferences survive. */}
      <ExportPanel key={exportKey} result={result} groups={allGroups} approved={approved} headers={headers} confirmedIds={confirmedIds} dismissedIds={dismissedIds} />
    </>}
    <button className="back-btn" onClick={onBack}>← Upload another file</button>
    <ProductFooter />
  </div>
}

function ExportPanel({ result, groups, approved, headers, confirmedIds, dismissedIds }: {
  result: ScanResult; groups: DuplicateGroup[]; approved: DuplicateGroup[]; headers: string[] | undefined
  confirmedIds: Set<string>; dismissedIds: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [auditStarted, setAuditStarted] = useState(false)
  const approvedIds = new Set(approved.map(group => group.id))
  const preserved = groups.flatMap(group => approvedIds.has(group.id)
    ? group.contacts.filter(contact => group.excludedRows?.includes(contact.rowIndex)) : group.contacts)
  const removed = approved.reduce((count, group) => count + activeContacts(group).length - 1, 0)
  const rowsAfter = result.total - removed
  const canDownload = confirmed && (!removed || auditStarted)
  return <div className="export-panel">
    <p className="export-summary">Export keeps <strong>{rowsAfter.toLocaleString()}</strong> of {result.total.toLocaleString()} contacts{removed ? ` · removes ${removed.toLocaleString()} approved duplicate row${removed === 1 ? '' : 's'}` : ' · nothing removed'}</p>
    <p className="export-scope">Exports include all groups, including those hidden by search or filters.</p>
    <div className="export-actions">
      <button className="scan-btn" onClick={() => setOpen(true)}>Review export</button>
      <button className="back-btn" onClick={() => { downloadFile(exportAuditCSV(groups, confirmedIds, dismissedIds, headers), 'dedupesafe-audit-report.csv'); setAuditStarted(true) }}>Download audit report</button>
    </div>
    {open && <div className="export-review" role="region" aria-label="Final export confirmation">
      <h2>Final export check</h2>
      <p>This export keeps the selected row from each approved group. It does not combine fields or merge records inside HubSpot. Rows kept separately remain intact. Every source field from candidate rows is preserved in the audit report.</p>
      {removed > 0 && <p>{auditStarted ? 'Audit download started. Check that the file was saved before continuing.' : 'Download the audit report before exporting fewer rows. Keep it private: it contains all original fields, including custom fields.'}</p>}
      <dl><div><dt>Original rows</dt><dd>{result.total}</dd></div><div><dt>Approved groups</dt><dd>{approved.length}</dd></div><div><dt>Rows removed</dt><dd>{removed}</dd></div><div><dt>Rows in export</dt><dd>{rowsAfter}</dd></div></dl>
      <label className="confirm-export"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed every approved group and kept the original CSV as a backup.</label>
      <button className="scan-btn" disabled={!canDownload} onClick={() => {
        if (canDownload) downloadFile(exportCleanedCSV(approved, [...result.uniqueContacts, ...preserved], result.contacts, headers), 'dedupesafe-reviewed-contacts.csv')
      }}>Download reviewed CSV</button>
    </div>}
  </div>
}

type CardProps = {
  group: DuplicateGroup; status: Status; view: View; onView: (patch: Partial<View>) => void
  onConfirm: () => void; onDismiss: () => void; onUndo: () => void; onRestore: () => void
  onSelect?: (row: number) => void; onSeparate?: (row: number, separate: boolean) => void
}

function GroupCard({ group, status, view, onView, onConfirm, onDismiss, onUndo, onRestore, onSelect, onSeparate }: CardProps) {
  const compared = effectiveGroup(group)
  const separate = group.contacts.filter(contact => group.excludedRows?.includes(contact.rowIndex))
  const editable = status !== 'kept'
  return <article className={`group-card ${group.riskLevel}`} data-group-id={group.id}>
    <div className="group-header">
      <h2 className="group-title" tabIndex={-1}>{status === 'approved' ? 'Approved group' : status === 'kept' ? 'Kept as separate rows' : 'Compare these records'}</h2>
      <span className="group-size">{compared.contacts.length} contacts{separate.length ? ` · ${separate.length} kept separately` : ''}</span>
    </div>
    <div className="match-explanation">
      <p>{reviewSummary(compared)}</p>
      {group.contacts.length > 2 && <p>Check every remaining contact. Some records may have been linked through another row.</p>}
      {group.riskLevel !== 'review' && <details open={view.scoreOpen} onToggle={event => onView({ scoreOpen: event.currentTarget.open })}><summary>Matching score</summary><p>{compared.pairs.length === 0 && separate.length ? 'No direct matching pair remains after separating rows.' : `${compared.riskScore}/100 is a comparison score, not the probability that these records belong to the same person.`}</p></details>}
    </div>
    {group.needsSelection && <p className="selection-needed" role="status">The selected row was kept separately. Choose a remaining row before approving this group.</p>}
    <div className="table-scroll"><table className="group-table">
      <thead><tr><th>Keep row</th>{FIELDS.map(([field, label]) => <th key={field}>{label}</th>)}{onSeparate && group.contacts.length > 2 && <th>Separate record</th>}</tr></thead>
      <tbody>{compared.contacts.map(contact => {
        const selected = !group.needsSelection && contact.rowIndex === group.masterContact.rowIndex
        return <tr key={contact.rowIndex} className={selected ? 'master-row' : ''}>
          <td className="record-position"><label className="row-choice"><input type="radio" name={`keep-${group.id}`} checked={selected} disabled={!onSelect || !editable} onChange={() => onSelect?.(contact.rowIndex)} aria-label={`Keep CSV row ${contact.rowIndex + 2}`} /><span>Row {contact.rowIndex + 2}</span></label></td>
          {FIELDS.map(([field, label]) => <td key={field} className={!group.needsSelection && contact[field] && contact[field] !== group.masterContact[field] ? 'diff-cell' : undefined}><span className="mobile-field-label" aria-hidden="true">{label}</span>{contact[field] || <span className="empty">—</span>}</td>)}
          {onSeparate && group.contacts.length > 2 && <td><button className="dismiss-btn" disabled={!editable || compared.contacts.length <= 2} onClick={() => onSeparate(contact.rowIndex, true)} aria-label={`Keep row ${contact.rowIndex + 2} separate`}>Keep separate</button></td>}
        </tr>
      })}</tbody>
    </table></div>
    {group.contacts.length > 2 && compared.contacts.length === 2 && <p className="group-hint">Two rows remain. Use Keep both below if they should also stay separate.</p>}
    {separate.length > 0 && <div className="separate-records"><h3>Kept separately, without changes</h3>{separate.map(contact => <div key={contact.rowIndex}>
      <span>Row {contact.rowIndex + 2}: {contact.email || `${contact.firstName} ${contact.lastName}`}</span>
      <button className="dismiss-btn" onClick={() => onSeparate?.(contact.rowIndex, false)} disabled={!onSeparate} aria-label={`Return row ${contact.rowIndex + 2} to group`}>Return to group</button>
    </div>)}</div>}
    <SourceFields group={group} view={view} onView={onView} decision={status} />
    <div className="decision-panel">
      <p>{status === 'kept' ? 'All rows in this group will stay in the new CSV.' : group.needsSelection ? 'Choose a row to keep, or keep all remaining rows.' : `Keep selected row keeps CSV row ${group.masterContact.rowIndex + 2} and removes ${compared.contacts.length - 1} other row${compared.contacts.length > 2 ? 's' : ''} from the new CSV. Values will not be combined.`}</p>
      <div className="group-actions">
        {status === 'kept' ? <button className="dismiss-btn" onClick={onRestore}>Restore for review</button> : <>
          <span className="master-label">{group.needsSelection ? 'No row selected' : `Selected: CSV row ${group.masterContact.rowIndex + 2}`}</span>
          {status === 'approved' ? <button className="dismiss-btn" onClick={onUndo}>Undo selection</button> : <>
            <button className="confirm-btn" disabled={group.needsSelection} onClick={onConfirm}>Keep selected row</button>
            <button className="dismiss-btn" onClick={onDismiss}>{compared.contacts.length === 2 ? 'Keep both' : 'Keep all rows'}</button>
          </>}
        </>}
      </div>
    </div>
  </article>
}

function SourceFields({ group, view, onView, decision }: { group: DuplicateGroup; view: View; onView: (patch: Partial<View>) => void; decision: Status }) {
  const fields = useMemo(() => sourceFields(group), [group])
  const differences = fields.filter(field => field.differs)
  const shown = view.allFields ? fields : differences
  return <details className="source-fields" open={view.fieldsOpen} onToggle={event => onView({ fieldsOpen: event.currentTarget.open })}>
    <summary>Original file: {differences.length} differing field{differences.length === 1 ? '' : 's'}</summary>
    {view.fieldsOpen && <>
      <p>{decision === 'kept' ? 'All values are kept. These are differences between the original rows.' : '“Not carried over” applies only if you approve keeping one row. Separate records stay intact.'}</p>
      <label className="show-all-fields"><input type="checkbox" checked={view.allFields} onChange={event => onView({ allFields: event.target.checked })} /> Show all original fields</label>
      {shown.map(({ field, values }) => <section className="source-field" key={field}><h3>{field}</h3><dl>{values.map(row => <div key={row.rowIndex} className={row.omitted && decision !== 'kept' ? 'source-omitted' : undefined}>
        <dt>Row {row.rowIndex + 2}{row.selected ? ' · selected' : ''}</dt><dd>{row.value || <span className="empty">Empty</span>}{row.omitted && decision !== 'kept' && <strong className="omitted-label">Not carried over</strong>}</dd>
      </div>)}</dl></section>)}
    </>}
  </details>
}
