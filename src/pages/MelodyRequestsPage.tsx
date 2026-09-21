// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { DataTable } from '../components/DataTable'
import { useAuth } from '../context/AuthContext'
import type { ColDef } from 'ag-grid-community'
import { Upload, MessageSquare, FileText, Search, Trash2, Edit2, Check, Play, RefreshCw, CheckCircle, XCircle, Loader, Clock, Download } from 'lucide-react'
import { oppIdCol } from '../components/OppIdCol'
import { MultiSelect, SearchMultiSelect } from '../components/MultiSelect'
import { exportToExcel } from '../lib/exportExcel'
import { ExcelDownloadButton } from '../components/ExcelDownloadButton'
import { OutlookTokenBanner } from '../components/OutlookTokenBanner'
import { useOutlookToken } from '../lib/useOutlookToken'

// ── Engagement Status helpers ─────────────────────────────────────────────────
const ENG_STATUS_META = {
  assigned:           { label: 'Assigned',           bg: '#E8F5E9', color: '#1B5E20', dot: '#43A047' },
  waiting_definition: { label: 'Waiting Definition', bg: '#FFF8E1', color: '#7A5800', dot: '#F0AB00' },
  return_to:          { label: 'Return To',          bg: '#FFEBEE', color: '#BB0000', dot: '#BB0000' },
}

function EngBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-sap-muted">—</span>
  const m = ENG_STATUS_META[status]
  if (!m) return <span className="text-[10px] text-sap-muted">{status}</span>
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: m.bg, color: m.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, display: 'inline-block', flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

const engStatusCol = {
  field: 'engagement_status',
  headerName: 'Engagement',
  width: 155,
  cellRenderer: (p: any) => {
    const status = p.value
    const m = status ? ENG_STATUS_META[status] : null
    if (!m) return '—'
    return `<span style="display:inline-flex;align-items:center;gap:4px;border-radius:9999px;padding:2px 8px;font-size:10px;font-weight:700;background:${m.bg};color:${m.color}"><span style="width:6px;height:6px;border-radius:50%;background:${m.dot};display:inline-block;flex-shrink:0"></span>${m.label}</span>`
  },
}


type Row = Record<string, unknown>
interface Comment { id: number; author: string; body: string; created_at: string; updated_at: string }

const TABS = [
  { id: 'upload',   label: '⬆ Upload File',   icon: Upload },
  { id: 'log',      label: '📋 Upload Log',    icon: FileText },
  { id: 'explorer', label: '🔍 Data Explorer', icon: Search },
]

export function MelodyRequestsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState('upload')

  const { data: summary = {} } = useQuery({
    queryKey: ['mr-summary'],
    queryFn: () => api.get('/api/melody-requests/summary').then(r => r.data),
    })

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-sap-text mb-1">Melody Requests</h2>
      <hr className="border-sap-border mb-4" />

      {/* Summary KPIs */}
      <div className="grid grid-cols-6 gap-3 mb-5">
        <KpiCard label="Total Rows"       value={(summary.total_rows ?? 0).toLocaleString()} />
        <KpiCard label="Opportunities"    value={(summary.total_opps ?? 0).toLocaleString()} />
        <KpiCard label="Unique Requests"  value={(summary.total_requests ?? 0).toLocaleString()} />
        <KpiCard label="Open"             value={(summary.open_count ?? 0).toLocaleString()}    color="orange" />
        <KpiCard label="Closed"           value={(summary.closed_count ?? 0).toLocaleString()}  color="green" />
        <KpiCard label="Comments"         value={(summary.total_comments ?? 0).toLocaleString()} color="blue" />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-sap-border mb-5 gap-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-sap-blue text-sap-blue font-semibold' : 'border-transparent text-sap-muted hover:text-sap-blue hover:bg-sap-blue-l'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload'   && <UploadTab onRefresh={() => qc.invalidateQueries({ queryKey: ['mr-summary'] })} user={user} />}
      {tab === 'log'      && <LogTab />}
      {tab === 'explorer' && <ExplorerTab />}
    </div>
  )
}

function UploadTab({ onRefresh, user }: { onRefresh: () => void; user: any }) {
  const [mode, setMode] = useState<'merge'|'replace'>('merge')
  const [file, setFile] = useState<File | null>(null)
  const [diff, setDiff] = useState<Record<string,any> | null>(null)
  const [result, setResult] = useState<Record<string,any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const preview = async (f: File) => {
    setFile(f); setResult(null); setDiff(null); setError('')
    setPreviewing(true)
    try {
      const fd = new FormData(); fd.append('file', f)
      const { data } = await api.post('/api/melody-requests/upload/diff', fd)
      setDiff(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Error previewing file')
    } finally { setPreviewing(false) }
  }

  const commit = async () => {
    if (!file) return
    setLoading(true); setError('')
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('mode', mode)
      const { data } = await api.post('/api/melody-requests/upload', fd)
      setResult(data); setDiff(null); setFile(null)
      onRefresh()
      qc.invalidateQueries({ queryKey: ['mr-upload-log'] })
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Upload failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: upload card */}
      <div className="col-span-2 space-y-4">
        <div className="card p-5">
          <p className="text-sm text-sap-muted mb-4">
            Upload the <strong>My Request</strong> Excel export. The file must contain a <strong>Req ID Sub</strong> column.
            <br />
            <span className="text-sap-blue font-medium">Merge</span> adds/updates changed rows only.
            <span className="text-sap-error font-medium ml-2">Replace</span> deletes all rows and reloads — comments are preserved.
          </p>

          {/* Mode selector */}
          <div className="flex gap-4 mb-4">
            {(['merge','replace'] as const).map(m => (
              <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={mode===m} onChange={() => setMode(m)} className="accent-sap-blue" />
                <span className={`font-semibold capitalize ${m === 'replace' ? 'text-sap-error' : 'text-sap-blue'}`}>{m}</span>
                <span className="text-sap-muted text-xs">— {m==='merge' ? 'add/update changed rows' : 'delete all and reload'}</span>
              </label>
            ))}
          </div>

          {/* File selector row — same style as ETLPage SourceCard */}
          <div className="border border-sap-border rounded-xl px-4 py-3 flex items-center gap-3 bg-white hover:border-sap-blue/40 transition">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-sap-text">My Request Export</p>
              <p className="text-[11px] text-sap-muted">MR_MyRequests.xlsx — must contain Req ID Sub column</p>
              {file && !result && (
                <span className="text-[11px] text-sap-success font-medium">
                  📎 {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  {previewing && <span className="ml-2 text-sap-muted animate-pulse">Analyzing…</span>}
                </span>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) preview(f) }} />
            <button onClick={() => { inputRef.current?.click(); setResult(null) }}
              className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition text-sap-muted">
              <Upload size={12} /> Select
            </button>
            <button onClick={commit} disabled={!diff || loading}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition border border-sap-blue text-sap-blue hover:bg-sap-blue-l disabled:opacity-40">
              {loading ? <><Loader size={12} className="animate-spin" /> Uploading…</> : <><Play size={12} /> {mode === 'merge' ? 'Merge' : 'Replace'}</>}
            </button>
          </div>

          {error && <p className="mt-3 text-xs text-sap-error bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>

        {/* Change preview */}
        {diff && !result && (
          <div className="card p-5">
            <SectionLabel>Change Preview</SectionLabel>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <KpiCard label="New" value={(diff.to_insert ?? 0).toLocaleString()} color="green" />
              <KpiCard label="Changed" value={(diff.to_update ?? 0).toLocaleString()} color="orange" />
              <KpiCard label="Unchanged" value={(diff.unchanged ?? 0).toLocaleString()} />
              <KpiCard label="DB only" value={(diff.only_in_db ?? 0).toLocaleString()} />
            </div>
            {(diff.warnings ?? []).map((w: string, i: number) => (
              <p key={i} className="text-xs text-sap-warning bg-orange-50 border border-orange-200 rounded px-3 py-2 mb-1">{w}</p>
            ))}
          </div>
        )}

        {/* Success result */}
        {result && (
          <div className="card p-5 bg-green-50 border-green-200">
            <p className="text-sm font-semibold text-sap-success mb-1">✅ Upload completed successfully</p>
            <p className="text-xs text-sap-muted">
              {mode === 'merge'
                ? `Inserted: ${(result.inserted)?.toLocaleString()}, Updated: ${(result.updated)?.toLocaleString()}, Unchanged: ${(result.unchanged)?.toLocaleString()}`
                : `Removed: ${(result.removed)?.toLocaleString()}, Inserted: ${(result.inserted)?.toLocaleString()}, Comments preserved: ${(result.comments_preserved)?.toLocaleString()}`
              }
            </p>
          </div>
        )}
      </div>

      {/* Right: upload log */}
      <div>
        <UploadLogPanel />
      </div>
    </div>
  )
}

function UploadLogPanel() {
  const qc = useQueryClient()
  const { data: log = [] } = useQuery({
    queryKey: ['mr-upload-log'],
    queryFn: () => api.get('/api/melody-requests/upload-log').then(r => r.data),
    staleTime: 30_000,
  })
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>History de Uploads</SectionLabel>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['mr-upload-log'] })}
          className="text-sap-muted hover:text-sap-blue transition"><RefreshCw size={12} /></button>
      </div>
      {log.length === 0
        ? <p className="text-xs text-sap-muted py-4 text-center">No uploads yet.</p>
        : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
            {log.map((l: any) => (
              <div key={l.id} className="border border-sap-border rounded-lg px-3 py-2 bg-white text-[12px]">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-semibold ${l.mode === 'replace' ? 'text-sap-error' : 'text-sap-blue'}`}>
                    {l.mode === 'replace' ? 'Replace' : 'Merge'}
                  </span>
                  <span className="text-sap-muted text-[11px]">
                    {l.uploaded_at ? new Date(l.uploaded_at).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}
                  </span>
                </div>
                <p className="text-sap-muted truncate text-[11px]">{l.filename || '—'}</p>
                <p className="text-sap-text text-[11px] mt-0.5">
                  ↑ {l.rows_in_file?.toLocaleString()} rows &nbsp;·&nbsp;
                  +{l.rows_inserted?.toLocaleString()} &nbsp;
                  ✎{l.rows_updated?.toLocaleString()} &nbsp;
                  ={l.rows_unchanged?.toLocaleString()}
                  {l.rows_removed > 0 && <span className="text-sap-error"> −{l.rows_removed?.toLocaleString()}</span>}
                </p>
                {l.uploaded_by && <p className="text-[10px] text-sap-subtle mt-0.5">{l.uploaded_by}</p>}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

function CommentsTab() {
  const [search, setSearch] = useState('')
  const [selectedReq, setSelectedReq] = useState<Row | null>(null)
  const [newComment, setNewComment] = useState('')
  const [editId, setEditId]         = useState<number | null>(null)
  const [editBody, setEditBody]     = useState('')
  const qc = useQueryClient()
  const { user } = useAuth()

  const { data: reqs = [] as Row[] } = useQuery({
    queryKey: ['mr-list', search],
    queryFn: () => api.get('/api/melody-requests', { params: { search: search || undefined, limit: 100 } }).then(r => r.data),
    })

  const reqId = selectedReq?.req_id_sub as string | undefined
  const { data: comments = [] as Comment[] } = useQuery({
    queryKey: ['mr-comments', reqId],
    queryFn: () => api.get(`/api/melody-requests/${reqId}/comments`).then(r => r.data),
    enabled: !!reqId,
  })

  const addMut = useMutation({
    mutationFn: (body: string) => api.post(`/api/melody-requests/${reqId}/comments`, { body }),
    onSuccess: () => { setNewComment(''); qc.invalidateQueries({ queryKey: ['mr-comments', reqId] }) },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/melody-requests/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr-comments', reqId] }),
  })
  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.put(`/api/melody-requests/comments/${id}`, { body }),
    onSuccess: () => { setEditId(null); qc.invalidateQueries({ queryKey: ['mr-comments', reqId] }) },
  })

  const cols: ColDef[] = [
    { field: 'req_id_sub',      headerName: 'Req ID Sub',   width: 130 },
    { field: 'req_id_main',     headerName: 'Req ID Main',  width: 130 },
    { field: 'req_type',        headerName: 'Type',         width: 110 },
    { field: 'req_status_main', headerName: 'Status',       width: 100 },
    engStatusCol,
    oppIdCol,
    { field: 'acct_name',       headerName: 'Account',      flex: 1, minWidth: 140 },
    { field: 'requestor',       headerName: 'Requestor',    width: 140 },
    { field: 'comment_count',   headerName: '💬',           width: 60 },
  ]

  return (
    <div>
      <div className="card p-3 mb-4 flex items-center gap-3">
        <Search size={14} className="text-sap-muted flex-shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search any field…"
          className="flex-1 text-sm focus:outline-none bg-transparent" />
      </div>
      <p className="text-xs text-sap-subtle mb-2">{reqs.length.toLocaleString()} requests (max 100)</p>
      <DataTable rows={reqs} cols={cols} height={300} onRowClick={r => setSelectedReq(r)} />

      {selectedReq && (
        <div className="mt-5">
          <SectionLabel>Comments — {selectedReq.req_id_sub as string}</SectionLabel>
          <div className="card p-4 mb-3 text-sm grid grid-cols-3 gap-2">
            <span><strong>Type:</strong> {selectedReq.req_type as string}</span>
            <span><strong>Status:</strong> {selectedReq.req_status_main as string}</span>
            <span><strong>Opp:</strong> {selectedReq.opportunity_id as string}</span>
          </div>

          <div className="space-y-2 mb-4">
            {comments.map(cm => (
              <div key={cm.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="text-xs text-sap-muted font-semibold">{cm.author || 'Unknown'}</span>
                    <span className="text-xs text-sap-subtle ml-2">{new Date(cm.created_at).toLocaleString()}</span>
                    {cm.updated_at !== cm.created_at && <span className="text-xs text-sap-subtle ml-1">(edited)</span>}
                    {editId === cm.id
                      ? <div className="mt-1 flex gap-2">
                          <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={2} className="flex-1 border border-sap-border rounded px-2 py-1 text-sm focus:outline-none focus:border-sap-blue resize-none" />
                          <button onClick={() => editMut.mutate({ id: cm.id, body: editBody })} className="text-sap-success"><Check size={16} /></button>
                        </div>
                      : <p className="text-sm text-sap-text mt-0.5">{cm.body}</p>
                    }
                  </div>
                  {(!cm.author || cm.author === user?.name) && editId !== cm.id && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditId(cm.id); setEditBody(cm.body) }} className="text-sap-muted hover:text-sap-blue"><Edit2 size={13} /></button>
                      <button onClick={() => delMut.mutate(cm.id)} className="text-sap-muted hover:text-sap-error"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sap-subtle text-sm">No comments yet.</p>}
          </div>

          <div className="card p-3 flex gap-2">
            <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows={2}
              placeholder="Write a comment…"
              className="flex-1 border border-sap-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-sap-blue resize-none" />
            <button onClick={() => newComment.trim() && addMut.mutate(newComment.trim())}
              disabled={!newComment.trim() || addMut.isPending}
              className="bg-sap-blue hover:bg-sap-blue-d text-white font-semibold px-4 rounded-lg transition disabled:opacity-50">
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LogTab() {
  const qc = useQueryClient()
  const { data: logs = [] } = useQuery({
    queryKey: ['mr-upload-log'],
    queryFn: () => api.get('/api/melody-requests/upload-log', { params: { limit: 50 } }).then(r => r.data),
    staleTime: 30_000,
  })
  const cols: ColDef[] = [
    { field: 'uploaded_at', headerName: 'Date', width: 160,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleString('pt-BR') : '—' },
    { field: 'filename',     headerName: 'File',      flex: 1, minWidth: 160 },
    { field: 'mode', headerName: 'Mode', width: 90,
      cellRenderer: (p: any) => p.value === 'replace'
        ? `<span style="color:#BB0000;font-weight:600">${p.value}</span>`
        : `<span style="color:#0070f2;font-weight:600">${p.value || ''}</span>` },
    { field: 'rows_in_file',   headerName: 'In File',   width: 90 },
    { field: 'rows_inserted',  headerName: 'Inserted',  width: 90, cellStyle: { color: '#256f3a' } },
    { field: 'rows_updated',   headerName: 'Updated',   width: 90, cellStyle: { color: '#E76500' } },
    { field: 'rows_unchanged', headerName: 'Unchanged', width: 100 },
    { field: 'rows_removed',   headerName: 'Removed',   width: 90, cellStyle: { color: '#BB0000' } },
    { field: 'uploaded_by',    headerName: 'By',        width: 160 },
  ]
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Upload History (last 50)</SectionLabel>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['mr-upload-log'] })}
          className="text-sap-muted hover:text-sap-blue transition flex items-center gap-1 text-xs">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      {logs.length === 0
        ? <p className="text-sm text-sap-muted text-center py-10">No uploads yet.</p>
        : <DataTable rows={logs} cols={cols} height={480} />
      }
    </div>
  )
}

function ExplorerTab() {
  const { user } = useAuth()
  const qc = useQueryClient()

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [mFilters, setMFilters] = useState({
    statuses: [] as string[],
    req_types: [] as string[],
    role_areas: [] as string[],
    requestors: [] as string[],
    resources: [] as string[],
    profit_centers: [] as string[],
    task_owners: [] as string[],
    processors: [] as string[],
    sub_statuses: [] as string[],
    action_takens: [] as string[],
    lob_teams: [] as string[],
    engagement_statuses: [] as string[],
    solutions: [] as string[],
    search: '',
    create_date_from: '',
    create_date_to: '',
    last_action_from: '',
    last_action_to: '',
  })
  const setF = (k: string, v: unknown) => setMFilters(f => ({ ...f, [k]: v }))

  const { data: fOpts = {} } = useQuery({
    queryKey: ['mr-filters'],
    queryFn: () => api.get('/api/melody-requests/filters').then(r => r.data),
    staleTime: 0,
  })

  const params: Record<string, unknown> = {}
  if (mFilters.statuses.length)       params.statuses       = mFilters.statuses
  if (mFilters.req_types.length)      params.req_types      = mFilters.req_types
  if (mFilters.role_areas.length)     params.role_areas     = mFilters.role_areas
  if (mFilters.requestors.length)     params.requestors     = mFilters.requestors
  if (mFilters.resources.length)      params.resources      = mFilters.resources
  if (mFilters.profit_centers.length) params.profit_centers = mFilters.profit_centers
  if (mFilters.task_owners.length)    params.task_owners    = mFilters.task_owners
  if (mFilters.processors.length)     params.processors     = mFilters.processors
  if (mFilters.sub_statuses.length)   params.sub_statuses   = mFilters.sub_statuses
  if (mFilters.action_takens.length)  params.action_takens  = mFilters.action_takens
  if (mFilters.lob_teams.length)      params.lob_teams      = mFilters.lob_teams
  if (mFilters.engagement_statuses.length) params.engagement_statuses = mFilters.engagement_statuses
  if (mFilters.solutions.length)           params.solutions            = mFilters.solutions
  if (mFilters.search)                params.search         = mFilters.search
  if (mFilters.create_date_from)      params.create_date_from = mFilters.create_date_from
  if (mFilters.create_date_to)        params.create_date_to   = mFilters.create_date_to
  if (mFilters.last_action_from)      params.last_action_from = mFilters.last_action_from
  if (mFilters.last_action_to)        params.last_action_to   = mFilters.last_action_to

  const { data: rows = [] as Row[], isLoading } = useQuery({
    queryKey: ['mr-list-all', params],
    queryFn: () => api.get('/api/melody-requests', { params: { ...params, limit: 2000 } }).then(r => r.data),
  })

  const hasFilters = Object.values(mFilters).some(v => Array.isArray(v) ? v.length > 0 : v !== '')

  // ── Selection for email ─────────────────────────────────────────────────────
  const { tokenHeaders, calToken } = useOutlookToken()
  const [selected, setSelected] = useState<string[]>([])
  const toggleSel = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailNote, setEmailNote] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<string | null>(null)

  // ── Sort state ──────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  function handleSort(field: string) {
    if (sortCol === field) setSortAsc(a => !a)
    else { setSortCol(field); setSortAsc(true) }
  }

  const sortedRows = sortCol
    ? [...rows].sort((a, b) => {
        const va = a[sortCol] ?? ''
        const vb = b[sortCol] ?? ''
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { numeric: true })
        return sortAsc ? cmp : -cmp
      })
    : rows

  // ── Comments panel ──────────────────────────────────────────────────────────
  const [activeReq, setActiveReq] = useState<Row | null>(null)
  const [newComment, setNewComment] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')

  const activeId = activeReq?.req_id_sub as string | undefined

  // Engagement status mutation
  const engMut = useMutation({
    mutationFn: (engagement_status: string | null) =>
      api.put(`/api/melody-requests/${activeId}/engagement-status`, { engagement_status }),
    onSuccess: (_, val) => {
      if (activeReq) setActiveReq({ ...activeReq, engagement_status: val })
      qc.invalidateQueries({ queryKey: ['mr-list-all'] })
    },
  })
  const { data: comments = [] as Comment[] } = useQuery({
    queryKey: ['mr-comments', activeId],
    queryFn: () => api.get(`/api/melody-requests/${activeId}/comments`).then(r => r.data),
    enabled: !!activeId,
  })
  const addMut = useMutation({
    mutationFn: (body: string) => api.post(`/api/melody-requests/${activeId}/comments`, { body }),
    onSuccess: () => { setNewComment(''); qc.invalidateQueries({ queryKey: ['mr-comments', activeId] }); qc.invalidateQueries({ queryKey: ['mr-list-all'] }) },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/melody-requests/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr-comments', activeId] }),
  })
  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.put(`/api/melody-requests/comments/${id}`, { body }),
    onSuccess: () => { setEditId(null); qc.invalidateQueries({ queryKey: ['mr-comments', activeId] }) },
  })

  // ── Table cols ──────────────────────────────────────────────────────────────
  const cols: ColDef[] = [
    { field: 'req_id_sub',          headerName: 'Req ID Sub',    width: 130 },
    { field: 'req_id_main',         headerName: 'Req ID Main',   width: 130 },
    { field: 'req_type',            headerName: 'Type',          width: 110 },
    { field: 'req_status_main',     headerName: 'Status',        width: 110 },
    { field: 'sub_status',          headerName: 'Sub-Status',    width: 130 },
    engStatusCol,
    {
      field: 'pre_allocated',
      headerName: 'Pre-Allocated DSA',
      width: 180,
      cellRenderer: (p: any) => {
        if (!p.value || p.value === true || p.value === 'true') return '—'
        return `<span style="color:#1E8449;font-weight:700;background:#D4EDDA;border-radius:4px;padding:2px 8px;font-size:11px">✓ ${p.value}</span>`
      },
    },
    oppIdCol,
    { field: 'acct_name',           headerName: 'Account',       flex: 1, minWidth: 140 },
    { field: 'requestor',           headerName: 'Requestor',     width: 150 },
    { field: 'req_resource',        headerName: 'Resource',      width: 150 },
    { field: 'req_processor',       headerName: 'Processor',     width: 200 },
    { field: 'req_profit_center',   headerName: 'Profit Center', width: 140 },
    { field: 'req_task_owner',      headerName: 'Task Owner',    width: 150 },
    { field: 'req_task_owner_role', headerName: 'Task Owner Role', width: 140 },
    { field: 'req_role_area',       headerName: 'Role Area',     width: 130 },
    { field: 'req_solution',        headerName: 'Solution',      width: 160 },
    { field: 'req_create_date',     headerName: 'Created',       width: 115 },
    { field: 'req_last_action_date', headerName: 'Last Action',  width: 115 },
    { field: 'req_task',            headerName: 'Task',          width: 140 },
    { field: 'req_task_action_taken', headerName: 'Action Taken', flex: 1, minWidth: 180 },
    { field: 'comment_count',       headerName: '💬',            width: 60 },
  ]

  return (
    <div>
      {/* ── Filters ─── */}
      <div className="card p-4 mb-3 space-y-3">
        <div className="grid grid-cols-6 gap-3">
          <MultiSelect label="Status Main"  selected={mFilters.statuses}            options={fOpts.statuses             ?? []} onChange={v => setF('statuses', v)} />
          <MultiSelect label="Sub-Status"   selected={mFilters.sub_statuses}        options={fOpts.sub_statuses         ?? []} onChange={v => setF('sub_statuses', v)} />
          <MultiSelect label="Req Type"     selected={mFilters.req_types}           options={fOpts.req_types            ?? []} onChange={v => setF('req_types', v)} />
          <MultiSelect label="Role Area"    selected={mFilters.role_areas}          options={fOpts.role_areas           ?? []} onChange={v => setF('role_areas', v)} />
          <MultiSelect label="Solution"     selected={mFilters.solutions}           options={fOpts.solutions            ?? []} onChange={v => setF('solutions', v)} />
          <MultiSelect label="LoB Team"     selected={mFilters.lob_teams}           options={fOpts.lob_teams            ?? []} onChange={v => setF('lob_teams', v)} />
        </div>
        <div className="grid grid-cols-6 gap-3">
          <MultiSelect label="Engagement"   selected={mFilters.engagement_statuses} options={fOpts.engagement_statuses  ?? []} onChange={v => setF('engagement_statuses', v)} />
        </div>
        <div className="grid grid-cols-5 gap-3">
          <SearchMultiSelect label="Requestor"  selected={mFilters.requestors}  options={fOpts.requestors  ?? []} onChange={v => setF('requestors', v)} />
          <SearchMultiSelect label="Resource"   selected={mFilters.resources}   options={fOpts.resources   ?? []} onChange={v => setF('resources', v)} />
          <SearchMultiSelect label="Processor"  selected={mFilters.processors}  options={(fOpts.processors ?? []).filter((p: string) => p)} onChange={v => setF('processors', v)} />
          <SearchMultiSelect label="Task Owner" selected={mFilters.task_owners} options={fOpts.task_owners ?? []} onChange={v => setF('task_owners', v)} />
          <SearchMultiSelect label="Action Taken" selected={mFilters.action_takens} options={fOpts.action_takens ?? []} onChange={v => setF('action_takens', v)} />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Search</label>
            <input value={mFilters.search} onChange={e => setF('search', e.target.value)}
              placeholder="Req ID / Opp / Account…"
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Created From</label>
            <input type="date" value={mFilters.create_date_from} onChange={e => setF('create_date_from', e.target.value)}
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Created To</label>
            <input type="date" value={mFilters.create_date_to} onChange={e => setF('create_date_to', e.target.value)}
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Last Action From</label>
            <input type="date" value={mFilters.last_action_from} onChange={e => setF('last_action_from', e.target.value)}
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Last Action To</label>
            <input type="date" value={mFilters.last_action_to} onChange={e => setF('last_action_to', e.target.value)}
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
        </div>
        {hasFilters && (
          <button onClick={() => setMFilters({ statuses:[], req_types:[], role_areas:[], requestors:[], resources:[], profit_centers:[], task_owners:[], processors:[], sub_statuses:[], action_takens:[], lob_teams:[], engagement_statuses:[], solutions:[], search:'', create_date_from:'', create_date_to:'', last_action_from:'', last_action_to:'' })}
            className="text-[11px] text-sap-error hover:underline">
            Clear all filters
          </button>
        )}
      </div>

      {/* ── Toolbar ─── */}
      <div className="flex items-center justify-between mb-2 gap-3">
        <p className="text-xs text-sap-subtle">{rows.length.toLocaleString()} rows
          {selected.length > 0 && <span className="ml-2 font-semibold text-sap-blue">{selected.length} selected</span>}
        </p>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button
              onClick={() => setEmailOpen(o => !o)}
              className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${emailOpen ? 'bg-sap-blue text-white border-sap-blue' : 'border-sap-blue text-sap-blue hover:bg-sap-blue-l'}`}>
              ✉ Review Email ({selected.length})
            </button>
          )}
          <ExcelDownloadButton rows={rows} cols={cols} defaultFilename="melody_requests.xlsx" sheetName="Melody Requests"
            className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
          />
        </div>
      </div>

      {/* ── Email draft panel ─── */}
      {emailOpen && selected.length > 0 && (
        <div className="card p-4 mb-4 border-sap-blue border">
          <p className="text-sm font-semibold text-sap-text mb-2">Review Email — {selected.length} request(s)</p>
          <textarea value={emailNote} onChange={e => setEmailNote(e.target.value)} rows={3}
            placeholder="Additional notes (optional)…"
            className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue resize-none mb-3" />
          <div className="flex items-center gap-3">
            <button
              disabled={emailSending}
              onClick={async () => {
                setEmailSending(true); setEmailResult(null)
                try {
                  const { data } = await api.post('/api/melody-requests/draft/review', { req_ids: selected, extra_note: emailNote })
                  const eml = ['MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8',`Subject: ${data.subject}`,'',data.html_body].join('\r\n')
                  const blob = new Blob([eml], { type: 'message/rfc822' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'mr-review.eml'; a.click()
                  URL.revokeObjectURL(url)
                  setEmailResult('Draft created in Outlook — add recipients and send.')
                  setSelected([]); setEmailOpen(false); setEmailNote('')
                } catch (e: any) {
                  setEmailResult('Error: ' + (e?.response?.data?.detail || e.message))
                } finally { setEmailSending(false) }
              }}
              className="bg-sap-blue text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-sap-blue-d disabled:opacity-50 transition">
              {emailSending ? 'Creating draft…' : 'Create Outlook Draft'}
            </button>
            <button onClick={() => setEmailOpen(false)} className="text-xs text-sap-muted hover:text-sap-text">Cancel</button>
          </div>
          {emailResult && <p className={`mt-2 text-xs ${emailResult.startsWith('Error') ? 'text-sap-error' : 'text-sap-success'}`}>{emailResult}</p>}
        </div>
      )}

      {/* ── Table + Comment panel ─── */}
      <div className={`grid gap-4 ${activeReq ? 'grid-cols-5' : 'grid-cols-1'}`}>
        <div className={activeReq ? 'col-span-3' : ''}>
          {isLoading
            ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
            : (
              <div className="overflow-x-auto rounded-xl border border-sap-border shadow-card">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f8f9fa]">
                      <th className="px-2 py-2 text-center border-b border-sap-border w-8">
                        <input type="checkbox" className="accent-sap-blue"
                          checked={selected.length === rows.length && rows.length > 0}
                          onChange={e => setSelected(e.target.checked ? rows.map((r: Row) => r.req_id_sub as string) : [])} />
                      </th>
                      {cols.map(c => {
                        const field = c.field as string
                        const isActive = sortCol === field
                        return (
                          <th key={field}
                            onClick={() => handleSort(field)}
                            className="px-3 py-2 text-left text-[10px] font-semibold text-sap-muted uppercase tracking-wide border-b border-sap-border whitespace-nowrap select-none cursor-pointer hover:bg-[#eef1f5] hover:text-sap-blue transition-colors">
                            {c.headerName}
                            {isActive && <span className="ml-1 text-sap-blue">{sortAsc ? '↑' : '↓'}</span>}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r: Row) => {
                      const rid = r.req_id_sub as string
                      const isActive = activeReq?.req_id_sub === rid
                      return (
                        <tr key={rid}
                          className={`cursor-pointer transition-colors ${isActive ? 'bg-[#e8f0fe]' : 'hover:bg-sap-bg'}`}
                          onClick={() => setActiveReq(isActive ? null : r)}>
                          <td className="px-2 py-2 text-center border-b border-sap-border" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="accent-sap-blue"
                              checked={selected.includes(rid)}
                              onChange={() => toggleSel(rid)} />
                          </td>
                          {cols.map(c => (
                            <td key={String(c.field)} className="px-3 py-2 border-b border-sap-border whitespace-nowrap max-w-[240px] truncate">
                              {c.cellRenderer
                                ? (() => {
                                    const val = (c.cellRenderer as any)({ value: r[c.field as string] })
                                    return typeof val === 'string'
                                      ? <span dangerouslySetInnerHTML={{ __html: val }} />
                                      : val
                                  })()
                                : String(r[c.field as string] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        {/* ── Comments panel (inline) ─── */}
        {activeReq && (
          <div className="col-span-2">
            <div className="card p-4 sticky top-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-sap-text">{activeReq.req_id_sub as string}</p>
                  <p className="text-xs text-sap-muted">{activeReq.acct_name as string} · {activeReq.req_status_main as string}</p>
                  {activeReq.sub_status && <p className="text-xs text-sap-subtle">{activeReq.sub_status as string}</p>}
                  {activeReq.req_processor && <p className="text-xs text-sap-muted mt-0.5">Processor: {activeReq.req_processor as string}</p>}
                </div>
                <button onClick={() => setActiveReq(null)} className="text-sap-muted hover:text-sap-text text-lg leading-none">×</button>
              </div>

              {/* Engagement status selector */}
              <div className="mb-3">
                <p className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-1.5">Engagement Status</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(ENG_STATUS_META).map(([k, v]) => {
                    const active = (activeReq.engagement_status as string) === k
                    return (
                      <button key={k}
                        onClick={() => engMut.mutate(active ? null : k)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full border transition"
                        style={{
                          background: active ? v.bg : '#fff',
                          color: active ? v.color : '#888',
                          borderColor: active ? v.dot : '#e1e2e6',
                        }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? v.dot : '#ccc',
                          display: 'inline-block', marginRight: 4 }} />
                        {v.label}
                      </button>
                    )
                  })}
                  {activeReq.engagement_status && (
                    <button onClick={() => engMut.mutate(null)}
                      className="text-[10px] text-sap-error hover:underline self-center">Clear</button>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-3 max-h-[320px] overflow-y-auto pr-1">
                {comments.length === 0
                  ? <p className="text-xs text-sap-muted text-center py-4">No comments yet.</p>
                  : comments.map((cm: Comment) => (
                    <div key={cm.id} className="bg-sap-bg rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-sap-blue">{cm.author || 'Unknown'}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-sap-subtle">{new Date(cm.created_at).toLocaleString()}</span>
                          <button onClick={() => { setEditId(cm.id); setEditBody(cm.body) }}
                            className="text-sap-muted hover:text-sap-blue transition"><Edit2 size={11} /></button>
                          <button onClick={() => delMut.mutate(cm.id)}
                            className="text-sap-muted hover:text-sap-error transition"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      {editId === cm.id
                        ? <div className="flex flex-col gap-1.5">
                            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={2}
                              className="border border-sap-border rounded px-2 py-1 text-xs focus:outline-none focus:border-sap-blue resize-none" />
                            <div className="flex gap-1.5">
                              <button onClick={() => editMut.mutate({ id: cm.id, body: editBody })}
                                className="flex items-center gap-1 text-[11px] font-semibold bg-sap-blue text-white px-2 py-0.5 rounded hover:bg-sap-blue-d">
                                <Check size={10} /> Save
                              </button>
                              <button onClick={() => setEditId(null)} className="text-[11px] text-sap-muted hover:text-sap-text">Cancel</button>
                            </div>
                          </div>
                        : <p className="text-xs text-sap-text whitespace-pre-wrap">{cm.body}</p>
                      }
                    </div>
                  ))
                }
              </div>

              <div className="flex flex-col gap-1.5">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows={2}
                  placeholder="Add a comment…"
                  className="border border-sap-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sap-blue resize-none" />
                <button
                  disabled={!newComment.trim() || addMut.isPending}
                  onClick={() => addMut.mutate(newComment.trim())}
                  className="self-end flex items-center gap-1 text-[11px] font-semibold bg-sap-blue text-white px-3 py-1 rounded-lg hover:bg-sap-blue-d disabled:opacity-50 transition">
                  <Check size={10} /> Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
