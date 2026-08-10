// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { RefreshCw, Plus, Mail, ExternalLink, X } from 'lucide-react'
import api from '../lib/api'
import { useOutlookToken } from '../lib/useOutlookToken'

// ── Inline ActionModal (same schema as ActionsPage) ───────────────────────────

const STATUS_META = {
  not_started: { label: 'Not Started', color: '#BB0000', bg: '#FFEBEE', dot: '#BB0000' },
  in_progress:  { label: 'In Progress', color: '#7A5800', bg: '#FFF8E1', dot: '#F0AB00' },
  completed:    { label: 'Completed',   color: '#1B5E20', bg: '#E8F5E9', dot: '#43A047' },
}

function ActionModal({ initial, onClose, onSaved }: { initial: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSaving(true); setError('')
    try {
      await api.post('/api/actions', {
        title:               form.title,
        description:         form.description,
        objective:           form.objective,
        comments:            form.comments,
        status:              form.status,
        due_date:            form.due_date || null,
        tags:                [],
        extra_activities:    [],
        outlook_message_id:  form._outlook_message_id || null,
      })
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[90vh] overflow-y-auto border border-sap-border flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border flex-shrink-0">
          <h3 className="text-[15px] font-bold text-sap-text flex items-center gap-2">
            <Plus size={14} className="text-sap-blue" /> Create Action
          </h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text text-lg">✕</button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 flex-1">
          {/* Source email badge */}
          {form._source_subject && (
            <div className="flex items-center gap-2 bg-[#E3F2FD] rounded-xl px-3 py-2">
              <Mail size={12} className="text-sap-blue flex-shrink-0" />
              <span className="text-[11px] text-sap-blue font-medium truncate">{form._source_subject}</span>
            </div>
          )}

          <div>
            <label className="label-xs">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue bg-white"
                style={{ color: STATUS_META[form.status]?.color }}>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k} style={{ color: v.color }}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-xs">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
          </div>

          <div>
            <label className="label-xs">Objective</label>
            <textarea value={form.objective} onChange={e => set('objective', e.target.value)}
              rows={2} placeholder="What is the goal of this action?"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>

          <div>
            <label className="label-xs">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3}
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>

          <div>
            <label className="label-xs">Comments</label>
            <textarea value={form.comments} onChange={e => set('comments', e.target.value)}
              rows={2} placeholder="Notes, blockers, follow-ups…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>

          {error && <p className="text-[12px] text-sap-error bg-[#FDE8E8] rounded-lg px-3 py-2">⚠ {error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-sap-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg border border-sap-border text-sap-muted hover:bg-sap-bg transition">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-5 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d transition disabled:opacity-60 flex items-center gap-1.5">
            {saving && <span style={{ display:'inline-block', width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />}
            Create Action
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Email card ────────────────────────────────────────────────────────────────

function EmailCard({ msg, onCreateAction }: { msg: any; onCreateAction: (m: any) => void }) {
  const dt = msg.received ? new Date(msg.received) : null
  const dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className={`bg-white rounded-xl border border-sap-border p-4 shadow-sm hover:shadow-md transition-shadow ${!msg.is_read ? 'border-l-4 border-l-sap-blue' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {!msg.is_read && (
              <span className="w-2 h-2 rounded-full bg-sap-blue flex-shrink-0" />
            )}
            {msg.importance === 'high' && (
              <span className="text-[9px] font-bold text-[#BB0000] bg-[#FFEBEE] px-1.5 py-0.5 rounded">HIGH</span>
            )}
            {msg.has_attachments && (
              <span className="text-[9px] text-sap-muted">📎</span>
            )}
            <span className="text-[10px] text-sap-muted ml-auto">{dateStr} {timeStr}</span>
          </div>
          <p className={`text-[13px] leading-snug mb-1 ${!msg.is_read ? 'font-bold text-sap-text' : 'font-semibold text-sap-text'}`}>
            {msg.subject || '(no subject)'}
          </p>
          <p className="text-[11px] text-sap-blue font-medium">{msg.from_name || msg.from_email}</p>
          {msg.folder && (
            <p className="text-[10px] text-sap-muted mt-0.5">📁 {msg.folder}</p>
          )}
          {msg.preview && (
            <p className="text-[11px] text-sap-muted mt-1 line-clamp-2">{msg.preview}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-sap-border">
        <button
          onClick={() => onCreateAction(msg)}
          className="flex items-center gap-1.5 text-[11px] font-semibold bg-sap-blue text-white rounded-lg px-3 py-1.5 hover:bg-sap-blue-d transition">
          <Plus size={11} /> Create Action
        </button>
        {msg.web_link && (
          <a href={msg.web_link} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-medium text-sap-muted border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition">
            <ExternalLink size={11} /> Open in Outlook
          </a>
        )}
      </div>
    </div>
  )
}

// ── Connect banner (same pattern as TeamAgendaPage) ───────────────────────────

function ConnectBanner({ outlook }: { outlook: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-14 h-14 rounded-full bg-[#E3F2FD] flex items-center justify-center">
        <Mail size={28} className="text-sap-blue" />
      </div>
      <div className="text-center">
        <h3 className="text-[15px] font-bold text-sap-text mb-1">Connect Outlook</h3>
        <p className="text-[12px] text-sap-muted max-w-xs">
          Authenticate with your SAP Outlook to see emails flagged for follow-up.
        </p>
      </div>
      {outlook.errorMsg && (
        <p className="text-[12px] text-sap-error bg-[#FDE8E8] rounded-lg px-4 py-2 max-w-xs text-center">{outlook.errorMsg}</p>
      )}
      <button
        onClick={outlook.openRelay}
        disabled={outlook.isWaiting}
        className="flex items-center gap-2 text-[13px] font-semibold bg-sap-blue text-white rounded-xl px-5 py-2.5 hover:bg-sap-blue-d transition disabled:opacity-60">
        {outlook.isWaiting
          ? <><span style={{ display:'inline-block', width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> Connecting…</>
          : <><Mail size={14} /> Connect Outlook</>}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function OutlookFlaggedPage() {
  const qc = useQueryClient()
  const outlook = useOutlookToken()
  const [actionModal, setActionModal] = useState<any>(null)

  const calToken = outlook.calToken()
  const connected = outlook.tokenValid

  const { data, isLoading, isFetching, refetch, error: queryError } = useQuery({
    queryKey: ['outlook-flagged', connected],
    queryFn: () =>
      api.get('/api/outlook/flagged', {
        headers: calToken ? { 'X-Cal-Auth': calToken } : {},
      }).then(r => r.data),
    enabled: connected,
    staleTime: 60_000,
    retry: 1,
  })

  const messages: any[] = data?.messages || []

  function openCreateAction(msg: any) {
    setActionModal({
      _source_subject:      msg.subject,
      _outlook_message_id:  msg.id,
      title:       msg.subject || '',
      description: `From: ${msg.from_name} <${msg.from_email}>\n\n${msg.preview || ''}`,
      objective:   '',
      comments:    msg.web_link ? `Outlook: ${msg.web_link}` : '',
      status:      'not_started',
      due_date:    '',
    })
  }

  return (
    <div className="flex flex-col h-full bg-sap-bg">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-sap-border flex-shrink-0 flex-wrap">
        <h2 className="text-[15px] font-bold text-sap-text flex items-center gap-2">
          <Mail size={15} className="text-sap-blue" /> Outlook — Flagged
        </h2>

        <div className="flex-1" />

        {connected && (
          <>
            <span className="text-[11px] text-[#1B5E20] bg-[#E8F5E9] px-2.5 py-1 rounded-full font-semibold">
              ● Connected {outlook.expiresIn ? `· ${outlook.expiresIn}m` : ''}
            </span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-[12px] font-medium text-sap-muted border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition disabled:opacity-50">
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </>
        )}

        {!connected && (
          <button
            onClick={outlook.openRelay}
            disabled={outlook.isWaiting}
            className="flex items-center gap-1.5 text-[12px] font-semibold bg-sap-blue text-white rounded-lg px-3 py-1.5 hover:bg-sap-blue-d transition disabled:opacity-60">
            {outlook.isWaiting
              ? <><span style={{ display:'inline-block', width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> Connecting…</>
              : <><Mail size={12} /> Connect Outlook</>}
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-5">
        {!connected ? (
          <ConnectBanner outlook={outlook} />
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full text-sap-muted text-sm">Loading…</div>
        ) : queryError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="text-4xl">⚠️</div>
            <p className="text-[14px] font-semibold text-sap-text">Error loading emails</p>
            <p className="text-[12px] text-sap-error bg-[#FDE8E8] rounded-lg px-4 py-2 max-w-md">
              {(queryError as any)?.response?.data?.detail || (queryError as any)?.message || String(queryError)}
            </p>
            <button onClick={() => refetch()} className="text-[12px] text-sap-blue underline mt-1">Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="text-4xl">🎉</div>
            <p className="text-[14px] font-semibold text-sap-text">No flagged emails</p>
            <p className="text-[12px] text-sap-muted">Your Outlook inbox has no messages flagged for follow-up.</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-sap-muted mb-4 font-semibold">
              {messages.length} flagged email{messages.length !== 1 ? 's' : ''}
              {data?.folders_searched ? ` · ${data.folders_searched} folders searched` : ''}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {messages.map(msg => (
                <EmailCard key={msg.id} msg={msg} onCreateAction={openCreateAction} />
              ))}
            </div>
          </>
        )}
      </div>

      {actionModal && (
        <ActionModal
          initial={actionModal}
          onClose={() => setActionModal(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['actions'] })}
        />
      )}
    </div>
  )
}
