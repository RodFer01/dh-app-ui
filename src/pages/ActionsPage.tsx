// @ts-nocheck
import { useState, useMemo, createPortal } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Plus, Pencil, Trash2, CalendarDays, LayoutList, Search, X, ChevronLeft, ChevronRight, Mail } from 'lucide-react'
import { PeopleSearchField } from '../components/PeopleSearchField'
import { createPortal as rdomPortal } from 'react-dom'
import { useOutlookToken } from '../lib/useOutlookToken'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  not_started: { label: 'Not Started', color: '#BB0000', bg: '#FFEBEE', dot: '#BB0000' },
  in_progress:  { label: 'In Progress', color: '#7A5800', bg: '#FFF8E1', dot: '#F0AB00' },
  completed:    { label: 'Completed',   color: '#1B5E20', bg: '#E8F5E9', dot: '#43A047' },
}

const REGIONS = ['Brazil','Mexico','Multi-Country LAC','Argentina','Chile','Colombia','Peru','Other LAC']

const EMPTY_FORM = {
  title: '', description: '', region: '', requester: '', requester_email: '', objective: '',
  comments: '', status: 'not_started', opp_id: '', account_name: '',
  extra_activities: [], due_date: '', tags: [], is_account_action: false,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'xs'|'sm' }) {
  const m = STATUS_META[status] || STATUS_META.not_started
  const cls = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  return (
    <span className={`rounded-full font-bold ${cls} inline-flex items-center gap-1`}
      style={{ background: m.bg, color: m.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, display: 'inline-block', flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

// ── Opp search dropdown ───────────────────────────────────────────────────────

function OppSearchField({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [q, setQ] = useState(value || '')
  const [open, setOpen] = useState(false)

  const { data: results = [] } = useQuery({
    queryKey: ['opp-search-actions', q],
    queryFn: () => q.length >= 3
      ? api.get('/api/pipeline', { params: { search: q, deduplicate: true, limit: 10 } }).then(r => r.data)
      : Promise.resolve([]),
    staleTime: 30_000,
    enabled: q.length >= 3,
  })

  return (
    <div className="relative">
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Type Opp ID or account name…"
        className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-sap-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map((r: any) => (
            <button key={r.opportunity_id}
              onClick={() => { setQ(r.opportunity_id); onChange(r.opportunity_id, r.account_name); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-sap-bg text-[12px] border-b border-sap-border last:border-b-0">
              <div className="font-semibold text-sap-text">{r.opportunity_id} — {r.account_name}</div>
              <div className="text-sap-muted">{r.solution_area_l1} · {r.drm_category} · {r.closing_qtr}</div>
            </button>
          ))}
        </div>
      )}
      {open && q.length >= 3 && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-sap-border rounded-xl shadow p-3 text-[12px] text-sap-muted">
          No opportunities found
        </div>
      )}
    </div>
  )
}

// ── Action Modal (create / edit) ──────────────────────────────────────────────

function ActionModal({ initial, onClose, onSaved, calToken }: { initial?: any; onClose: () => void; onSaved: () => void; calToken?: string }) {
  const isEdit = !!initial
  const [form, setForm] = useState<any>(isEdit ? {
    ...initial,
    is_account_action: !!(initial.opp_id || initial.account_name),
    extra_activities: initial.extra_activities || [],
    tags: initial.tags || [],
    due_date: initial.due_date || '',
    opp_id: initial.opp_id || '',
    account_name: initial.account_name || '',
    requester_email: initial.requester_email || '',
  } : { ...EMPTY_FORM })
  const [newActivity, setNewActivity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const addActivity = () => {
    if (!newActivity.trim()) return
    set('extra_activities', [...(form.extra_activities || []), { text: newActivity.trim(), done: false }])
    setNewActivity('')
  }
  const toggleActivity = (i: number) => {
    const arr = [...form.extra_activities]
    arr[i] = { ...arr[i], done: !arr[i].done }
    set('extra_activities', arr)
  }
  const removeActivity = (i: number) => {
    set('extra_activities', form.extra_activities.filter((_: any, idx: number) => idx !== i))
  }

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        title: form.title, description: form.description, region: form.region,
        requester: form.requester, objective: form.objective, comments: form.comments,
        status: form.status, extra_activities: form.extra_activities,
        due_date: form.due_date || null, tags: form.tags,
        opp_id: form.is_account_action ? (form.opp_id || null) : null,
        account_name: form.is_account_action ? (form.account_name || null) : null,
      }
      if (isEdit) {
        const headers: any = {}
        if (calToken) headers['X-Cal-Auth'] = calToken
        await api.put(`/api/actions/${initial.id}`, payload, { headers })
      } else {
        await api.post('/api/actions', payload)
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return rdomPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[620px] max-h-[92vh] overflow-y-auto border border-sap-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border flex-shrink-0">
          <h3 className="text-[16px] font-bold text-sap-text">{isEdit ? 'Edit Action' : 'New Action'}</h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          {/* Title + Status row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label-xs">Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Action title…"
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
            <div className="w-44">
              <label className="label-xs">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue bg-white"
                style={{ color: STATUS_META[form.status]?.color }}>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k} style={{ color: v.color }}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Region + Requester + Due date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-xs">Region</label>
              <select value={form.region} onChange={e => set('region', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue bg-white">
                <option value="">— Select —</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs">Requester</label>
              <PeopleSearchField
                value={form.requester}
                onChange={(name, email) => { set('requester', name); if (email) set('requester_email', email) }}
                placeholder="Name or team — type to search SAP directory…"
              />
              {form.requester_email && (
                <p className="text-[10px] text-sap-muted mt-1">📧 {form.requester_email}</p>
              )}
            </div>
            <div>
              <label className="label-xs">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="label-xs">Objective</label>
            <textarea value={form.objective} onChange={e => set('objective', e.target.value)}
              rows={2} placeholder="What is the goal of this action?"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>

          {/* Description */}
          <div>
            <label className="label-xs">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Additional context…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>

          {/* Account / Opp toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
              <div onClick={() => set('is_account_action', !form.is_account_action)}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.is_account_action ? 'bg-sap-blue' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_account_action ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-[12px] font-medium text-sap-text">Account / Opportunity action</span>
            </label>
            {form.is_account_action && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="label-xs">Opportunity (search)</label>
                  <OppSearchField
                    value={form.opp_id}
                    onChange={(id, name) => { set('opp_id', id); set('account_name', name) }}
                  />
                </div>
                <div>
                  <label className="label-xs">Account Name</label>
                  <input value={form.account_name} onChange={e => set('account_name', e.target.value)}
                    placeholder="Auto-filled from opp search…"
                    className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
                </div>
              </div>
            )}
          </div>

          {/* Extra activities checklist */}
          <div>
            <label className="label-xs">Extra Activities</label>
            <div className="border border-sap-border rounded-xl overflow-hidden">
              {(form.extra_activities || []).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-sap-border last:border-b-0 hover:bg-sap-bg">
                  <input type="checkbox" checked={a.done} onChange={() => toggleActivity(i)}
                    className="w-4 h-4 accent-sap-blue flex-shrink-0" />
                  <span className={`flex-1 text-[13px] ${a.done ? 'line-through text-sap-muted' : 'text-sap-text'}`}>{a.text}</span>
                  <button onClick={() => removeActivity(i)} className="text-sap-muted hover:text-sap-error">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 p-2">
                <input value={newActivity} onChange={e => setNewActivity(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addActivity()}
                  placeholder="Add activity… (Enter)"
                  className="flex-1 border border-sap-border rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
                <button onClick={addActivity}
                  className="px-3 py-1.5 bg-sap-blue text-white rounded-lg text-[12px] font-semibold hover:bg-sap-blue-d transition">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="label-xs">Comments</label>
            <textarea value={form.comments} onChange={e => set('comments', e.target.value)}
              rows={2} placeholder="Notes, blockers, follow-ups…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>

          {error && <p className="text-[12px] text-sap-error bg-[#FDE8E8] rounded-lg px-3 py-2">⚠ {error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sap-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg border border-sap-border text-sap-muted hover:bg-sap-bg transition">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-5 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d transition disabled:opacity-60 flex items-center gap-1.5">
            {saving && <span style={{ display:'inline-block', width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />}
            {isEdit ? 'Save Changes' : 'Create Action'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Email Modal ───────────────────────────────────────────────────────────────
function EmailModal({ action, onClose }: { action: any; onClose: () => void }) {
  const [to, setTo]       = useState(action.requester_email || '')
  const [subject, setSubj] = useState(`Action: ${action.title}`)

  // Plain text body — shown in textarea, converted to clean HTML on send
  const [body, setBody] = useState(
    `Hi,\n\n` +
    `I wanted to follow up on the following action item:\n\n` +
    `${action.title}\n\n` +
    (action.objective ? `Objective:\n${action.objective}\n\n` : '') +
    (action.due_date  ? `Due date: ${action.due_date}\n\n` : '') +
    `Status: ${STATUS_META[action.status]?.label || action.status}\n\n` +
    (action.comments  ? `Notes:\n${action.comments}\n\n` : '') +
    `Best regards`
  )
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<'ok'|'error'|null>(null)
  const [errMsg, setErrMsg]   = useState('')

  // Convert plain text to clean HTML for rendering
  function toHtml(text: string): string {
    return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6">` +
      text
        .split('\n\n')
        .map(para => {
          const lines = para.split('\n').map(l => l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')).join('<br/>')
          return `<p style="margin:0 0 12px 0">${lines}</p>`
        })
        .join('') +
      `</div>`
  }

  const send = async () => {
    if (!to.trim()) return
    setSending(true); setResult(null)
    try {
      const { data } = await api.post('/api/email/send', {
        to,
        subject,
        body_html: toHtml(body),
      })
      const eml = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        `To: ${data.to_email || to}`,
        `Subject: ${data.subject}`,
        '',
        data.html_body,
      ].join('\r\n')
      const blob = new Blob([eml], { type: 'message/rfc822' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'action-email.eml'; a.click()
      URL.revokeObjectURL(url)
      setResult('ok')
      setTimeout(onClose, 2000)
    } catch (e: any) {
      setResult('error')
      setErrMsg(e?.response?.data?.detail || e.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return rdomPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[540px] border border-sap-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border">
          <h3 className="text-[15px] font-bold text-sap-text flex items-center gap-2">
            <Mail size={15} className="text-sap-blue" /> Send Email
          </h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text text-lg">✕</button>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <label className="label-xs">To</label>
            <PeopleSearchField value={to} onChange={(name, email) => setTo(email || name)}
              placeholder="Recipient email or search by name…" />
          </div>
          <div>
            <label className="label-xs">Subject</label>
            <input value={subject} onChange={e => setSubj(e.target.value)}
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
          <div>
            <label className="label-xs">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none font-mono" />
          </div>
          {result === 'ok' && <p className="text-[12px] text-[#1B5E20] bg-[#E8F5E9] rounded-lg px-3 py-2">✓ Email file downloaded — open to send from Outlook</p>}
          {result === 'error' && <p className="text-[12px] text-sap-error bg-[#FDE8E8] rounded-lg px-3 py-2">⚠ {errMsg}</p>}
        </div>
        <div className="px-6 py-4 border-t border-sap-border flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg border border-sap-border text-sap-muted hover:bg-sap-bg transition">
            Cancel
          </button>
          <button onClick={send} disabled={sending || result === 'ok' || !to.trim()}
            className="px-5 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d transition disabled:opacity-60 flex items-center gap-1.5">
            {sending && <span style={{ display:'inline-block', width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />}
            {sending ? 'Creating…' : 'Download .eml'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Card view (list) ──────────────────────────────────────────────────────────

function ActionCard({ action, onEdit, onDelete, onStatusChange, onEmail }: {
  action: any; onEdit: () => void; onDelete: () => void; onStatusChange: (s: string) => void; onEmail: () => void
}) {
  const m = STATUS_META[action.status] || STATUS_META.not_started
  const done = (action.extra_activities || []).filter((a: any) => a.done).length
  const total = (action.extra_activities || []).length
  const overdue = action.due_date && action.status !== 'completed' && new Date(action.due_date) < new Date()

  return (
    <div className="bg-white rounded-xl border border-sap-border p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${m.dot}` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={action.status} size="xs" />
            {action.region && (
              <span className="text-[9px] font-semibold text-sap-muted bg-sap-bg px-1.5 py-0.5 rounded">{action.region}</span>
            )}
            {action.opp_id && (
              <span className="text-[9px] font-semibold text-sap-blue bg-[#E3F2FD] px-1.5 py-0.5 rounded">📋 {action.opp_id}</span>
            )}
            {action.outlook_message_id && (
              <span className="text-[9px] font-semibold text-[#0072C6] bg-[#E3F2FD] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Mail size={8} className="inline" /> Email
              </span>
            )}
          </div>
          <h4 className="text-[14px] font-bold text-sap-text mt-1 leading-tight">{action.title}</h4>
          {action.account_name && (
            <p className="text-[11px] text-sap-muted mt-0.5">{action.account_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-sap-bg text-sap-muted hover:text-sap-blue transition">
            <Pencil size={12} />
          </button>
          <button onClick={onEmail} title="Send email"
            className="p-1.5 rounded-lg hover:bg-[#E3F2FD] text-sap-muted hover:text-sap-blue transition">
            <Mail size={12} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-[#FDE8E8] text-sap-muted hover:text-sap-error transition">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Objective */}
      {action.objective && (
        <p className="text-[11px] text-sap-muted mb-2 line-clamp-2">{action.objective}</p>
      )}

      {/* Activities progress */}
      {total > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-sap-muted">Activities</span>
            <span className="text-[10px] font-semibold text-sap-muted">{done}/{total}</span>
          </div>
          <div className="h-1.5 bg-sap-bg rounded-full overflow-hidden">
            <div className="h-full bg-sap-blue rounded-full transition-all"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-sap-border">
        <div className="flex items-center gap-3">
          {action.requester && (
            <span className="text-[10px] text-sap-muted">by <span className="font-semibold">{action.requester}</span></span>
          )}
          {action.due_date && (
            <span className={`text-[10px] font-semibold ${overdue ? 'text-sap-error' : 'text-sap-muted'}`}>
              {overdue ? '⚠ ' : ''}Due {action.due_date}
            </span>
          )}
        </div>
        {/* Quick status toggle */}
        <div className="flex gap-1">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <button key={k} onClick={() => onStatusChange(k)} title={v.label}
              className={`w-5 h-5 rounded-full border-2 transition ${
                action.status === k ? 'scale-110' : 'opacity-40 hover:opacity-80'}`}
              style={{ background: v.bg, borderColor: v.dot }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Calendar / Agenda view ─────────────────────────────────────────────────────

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function AgendaView({ actions, onEdit, cursor, view }: { actions: any[]; onEdit: (a: any) => void; cursor: Date; view: 'week'|'month' }) {
  const today = isoDate(new Date())

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const a of actions) {
      if (a.due_date) {
        if (!map[a.due_date]) map[a.due_date] = []
        map[a.due_date].push(a)
      }
    }
    return map
  }, [actions])

  if (view === 'week') {
    const ws = startOfWeek(cursor)
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
    return (
      <div style={{ minWidth: 700 }}>
        {/* Header */}
        <div className="grid border-b border-sap-border bg-white sticky top-0 z-10"
          style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map(d => {
            const isToday = isoDate(d) === today
            return (
              <div key={isoDate(d)} className={`px-2 py-2 text-center border-r border-sap-border last:border-r-0 ${isToday ? 'bg-[#E3F2FD]' : ''}`}>
                <div className="text-[10px] font-semibold text-sap-muted uppercase">{DAY_LABELS[d.getDay()]}</div>
                <div className={`text-[18px] font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${
                  isToday ? 'bg-sap-blue text-white' : 'text-sap-text'}`}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>
        {/* Cells */}
        <div className="grid min-h-[200px]" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map(d => {
            const dayStr = isoDate(d)
            const isToday = dayStr === today
            const dayActions = byDate[dayStr] || []
            return (
              <div key={dayStr}
                className={`px-1 py-1 border-r border-sap-border last:border-r-0 min-h-[120px] overflow-hidden ${
                  isToday ? 'bg-[#F0F8FF]' : ''} ${[0,6].includes(d.getDay()) ? 'bg-[#F5F6F7]' : ''}`}>
                {dayActions.map(a => {
                  const m = STATUS_META[a.status] || STATUS_META.not_started
                  return (
                    <div key={a.id}
                      onClick={() => onEdit(a)}
                      className="mb-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: m.bg, border: `1px solid ${m.dot}`, color: m.color }}
                      title={`${a.title}${a.region ? ' · ' + a.region : ''}${a.requester ? ' · ' + a.requester : ''}`}>
                      {a.title}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Month view
  const ms = startOfMonth(cursor)
  const wsm = startOfWeek(ms)
  const me = endOfMonth(cursor)
  const weeks: Date[][] = []
  let cur = new Date(wsm)
  while (cur <= me || weeks.length < 5) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)))
    cur = addDays(cur, 7)
    if (weeks.length >= 6) break
  }

  return (
    <div style={{ minWidth: 700 }}>
      <div className="grid border-b border-sap-border bg-white sticky top-0 z-10"
        style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {DAY_LABELS.map(d => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold text-sap-muted uppercase border-r border-sap-border last:border-r-0">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid border-b border-sap-border last:border-b-0" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', minHeight: 80 }}>
          {week.map(d => {
            const dayStr = isoDate(d)
            const inMonth = d.getMonth() === ms.getMonth()
            const isToday = dayStr === today
            const dayActions = byDate[dayStr] || []
            return (
              <div key={dayStr}
                className={`px-1 py-1 border-r border-sap-border last:border-r-0 overflow-hidden ${
                  !inMonth ? 'opacity-30' : ''} ${isToday ? 'bg-[#E3F2FD]' : ''} ${[0,6].includes(d.getDay()) ? 'bg-[#F5F6F7]' : ''}`}>
                <div className={`text-[10px] text-right pr-0.5 mb-0.5 ${isToday ? 'font-bold text-sap-blue' : 'text-sap-muted'}`}>
                  {d.getDate()}
                </div>
                {dayActions.slice(0, 3).map(a => {
                  const m = STATUS_META[a.status] || STATUS_META.not_started
                  return (
                    <div key={a.id}
                      onClick={() => onEdit(a)}
                      className="mb-0.5 rounded px-1 py-0.5 text-[9px] truncate cursor-pointer hover:opacity-80"
                      style={{ background: m.bg, border: `1px solid ${m.dot}`, color: m.color }}>
                      {a.title}
                    </div>
                  )
                })}
                {dayActions.length > 3 && (
                  <div className="text-[9px] text-sap-muted text-right">+{dayActions.length - 3}</div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Grouped list with show/hide per status ────────────────────────────────────
const STATUS_ORDER = ['not_started', 'in_progress', 'completed'] as const

function GroupedActionList({ actions, onEdit, onDelete, onEmail, onStatusChange }: {
  actions: any[]
  onEdit: (a: any) => void
  onDelete: (a: any) => void
  onEmail: (a: any) => void
  onStatusChange: (a: any, s: string) => void
}) {
  // Persist collapsed state per group
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('actions_group_collapsed') || '{}')
    } catch { return {} }
  })

  const toggle = (key: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('actions_group_collapsed', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of STATUS_ORDER) map[s] = []
    for (const a of actions) {
      const key = a.status in map ? a.status : 'not_started'
      map[key].push(a)
    }
    return map
  }, [actions])

  return (
    <div className="flex flex-col gap-4">
      {STATUS_ORDER.map(status => {
        const group = grouped[status] || []
        const m = STATUS_META[status]
        const isCollapsed = !!collapsed[status]

        return (
          <div key={status} className="rounded-xl border border-sap-border overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggle(status)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-sap-bg transition"
              style={{ background: m.bg }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.dot, display: 'inline-block' }} />
                <span className="text-[13px] font-bold" style={{ color: m.color }}>{m.label}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/60"
                  style={{ color: m.color }}>
                  {group.length}
                </span>
              </div>
              <span className="text-[12px] font-medium" style={{ color: m.color }}>
                {isCollapsed ? '▼ Show' : '▲ Hide'}
              </span>
            </button>

            {/* Cards */}
            {!isCollapsed && (
              <div className="p-3 bg-white">
                {group.length === 0 ? (
                  <p className="text-[12px] text-sap-muted text-center py-4">No {m.label} actions</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.map(a => (
                      <ActionCard key={a.id} action={a}
                        onEdit={() => onEdit(a)}
                        onDelete={() => onDelete(a)}
                        onEmail={() => onEmail(a)}
                        onStatusChange={s => onStatusChange(a, s)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ActionsPage() {
  const qc = useQueryClient()
  const outlook = useOutlookToken()
  const today = new Date(); today.setHours(0,0,0,0)

  const [viewMode, setViewMode] = useState<'list'|'agenda'>('list')
  const [agendaView, setAgendaView] = useState<'week'|'month'>('week')
  const [cursor, setCursor] = useState(new Date(today))
  const [modal, setModal] = useState<null|'create'|any>(null)
  const [emailAction, setEmailAction] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [filterRegion, setFilterRegion] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<number|null>(null)

  // Build query params
  const params: any = {}
  if (filterStatus.length) params.status = filterStatus
  if (filterRegion.length) params.region = filterRegion
  if (search)             params.search = search

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['actions', params],
    queryFn: () => api.get('/api/actions', { params }).then(r => r.data),
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['actions'] })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/actions/${id}`),
    onSuccess: () => { invalidate(); setConfirmDelete(null) },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status, outlook_message_id }: { id: number; status: string; outlook_message_id?: string }) => {
      const calToken = outlook.calToken()
      const headers: any = {}
      if (calToken) headers['X-Cal-Auth'] = calToken
      return api.put(`/api/actions/${id}`, { status }, { headers })
    },
    onSuccess: invalidate,
  })

  // Nav label
  const navLabel = useMemo(() => {
    if (agendaView === 'week') {
      const ws = startOfWeek(cursor)
      const we = addDays(ws, 6)
      return `${ws.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${we.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
    }
    return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [cursor, agendaView])

  function navigate(dir: 1|-1) {
    const n = new Date(cursor)
    if (agendaView === 'week') n.setDate(n.getDate() + dir * 7)
    else n.setMonth(n.getMonth() + dir)
    setCursor(n)
  }

  // KPIs
  const kpis = useMemo(() => ({
    total:       actions.length,
    not_started: actions.filter((a:any) => a.status === 'not_started').length,
    in_progress: actions.filter((a:any) => a.status === 'in_progress').length,
    completed:   actions.filter((a:any) => a.status === 'completed').length,
    overdue:     actions.filter((a:any) => a.due_date && a.status !== 'completed' && new Date(a.due_date) < today).length,
  }), [actions])

  return (
    <div className="flex flex-col h-full bg-sap-bg">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-sap-border flex-shrink-0 flex-wrap">
        <h2 className="text-[15px] font-bold text-sap-text">Actions</h2>

        {/* Search */}
        <div className="flex items-center gap-1.5 border border-sap-border rounded-lg px-2.5 py-1.5 bg-white w-52">
          <Search size={12} className="text-sap-muted flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="text-[13px] focus:outline-none flex-1 min-w-0" />
          {search && <button onClick={() => setSearch('')}><X size={11} className="text-sap-muted" /></button>}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <button key={k}
              onClick={() => setFilterStatus(p => p.includes(k) ? p.filter(x=>x!==k) : [...p, k])}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition ${
                filterStatus.includes(k)
                  ? `border-[${v.dot}] text-[${v.color}]`
                  : 'border-sap-border text-sap-muted'}`}
              style={{
                background: filterStatus.includes(k) ? v.bg : '#fff',
                color: filterStatus.includes(k) ? v.color : '#888',
                borderColor: filterStatus.includes(k) ? v.dot : '#e1e2e6',
              }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background: filterStatus.includes(k)?v.dot:'#ccc', display:'inline-block', marginRight:4 }} />
              {v.label}
            </button>
          ))}
        </div>

        {/* Region filter */}
        <select value={filterRegion[0] || ''} onChange={e => setFilterRegion(e.target.value ? [e.target.value] : [])}
          className="border border-sap-border rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none bg-white text-sap-text">
          <option value="">All Regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="flex-1" />

        {/* View toggle */}
        {viewMode === 'agenda' && (
          <>
            <button onClick={() => setCursor(new Date(today))}
              className="text-[12px] font-semibold text-sap-blue border border-sap-blue rounded-lg px-3 py-1 hover:bg-[#E3F2FD] transition">
              Today
            </button>
            <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-sap-bg border border-sap-border">
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-semibold text-sap-blue">{navLabel}</span>
            <button onClick={() => navigate(1)} className="p-1 rounded-lg hover:bg-sap-bg border border-sap-border">
              <ChevronRight size={15} />
            </button>
            <div className="flex rounded-lg border border-sap-border overflow-hidden">
              {(['week','month'] as const).map(v => (
                <button key={v} onClick={() => setAgendaView(v)}
                  className={`px-3 py-1.5 text-[12px] font-medium transition ${agendaView===v?'bg-sap-blue text-white':'bg-white text-sap-text hover:bg-sap-bg'}`}>
                  {v === 'week' ? '1 Week' : '1 Month'}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-sap-border" />
          </>
        )}

        {/* List / Agenda toggle */}
        <div className="flex rounded-lg border border-sap-border overflow-hidden">
          <button onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-medium transition ${viewMode==='list'?'bg-sap-blue text-white':'bg-white text-sap-text hover:bg-sap-bg'}`}>
            <LayoutList size={13} /> List
          </button>
          <button onClick={() => setViewMode('agenda')}
            className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-medium transition ${viewMode==='agenda'?'bg-sap-blue text-white':'bg-white text-sap-text hover:bg-sap-bg'}`}>
            <CalendarDays size={13} /> Agenda
          </button>
        </div>

        <button onClick={() => setModal('create')}
          className="flex items-center gap-1.5 text-[12px] font-semibold bg-sap-blue text-white rounded-lg px-3 py-1.5 hover:bg-sap-blue-d transition">
          <Plus size={13} /> New Action
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="flex gap-3 px-5 py-3 bg-white border-b border-sap-border flex-shrink-0">
        {[
          { label: 'Total', value: kpis.total, color: '#0070F2', bg: '#E3F2FD' },
          { label: 'Not Started', value: kpis.not_started, color: '#BB0000', bg: '#FFEBEE' },
          { label: 'In Progress', value: kpis.in_progress, color: '#7A5800', bg: '#FFF8E1' },
          { label: 'Completed', value: kpis.completed, color: '#1B5E20', bg: '#E8F5E9' },
          { label: 'Overdue', value: kpis.overdue, color: '#BB0000', bg: '#FFEBEE' },
        ].map(k => (
          <div key={k.label} className="rounded-xl px-4 py-2 flex flex-col items-center" style={{ background: k.bg }}>
            <div className="text-[18px] font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] font-semibold" style={{ color: k.color }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-sap-muted text-sm">Loading…</div>
        ) : viewMode === 'list' ? (
          <div className="p-5">
            {actions.length === 0 ? (
              <div className="text-center py-16 text-sap-muted">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-[14px] font-semibold mb-1">No actions yet</div>
                <div className="text-[12px]">Click "New Action" to create your first action item.</div>
              </div>
            ) : (
              <GroupedActionList
                actions={actions}
                onEdit={a => setModal(a)}
                onDelete={a => setConfirmDelete(a.id)}
                onEmail={a => setEmailAction(a)}
                onStatusChange={(a, s) => statusMut.mutate({ id: a.id, status: s })}
              />
            )}
          </div>
        ) : (
          <AgendaView actions={actions} onEdit={a => setModal(a)} cursor={cursor} view={agendaView} />
        )}
      </div>

      {/* ── Modals ── */}
      {modal && (
        <ActionModal
          initial={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={invalidate}
          calToken={outlook.calToken()}
        />
      )}

      {emailAction && (
        <EmailModal action={emailAction} onClose={() => setEmailAction(null)} />
      )}

      {confirmDelete !== null && rdomPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[360px] p-6 border border-sap-border">
            <h3 className="text-[15px] font-bold text-sap-text mb-2">Delete Action</h3>
            <p className="text-[13px] text-sap-muted mb-5">Are you sure? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-1.5 text-[13px] border border-sap-border rounded-lg text-sap-muted hover:bg-sap-bg transition">
                Cancel
              </button>
              <button onClick={() => deleteMut.mutate(confirmDelete!)}
                className="px-4 py-1.5 text-[13px] font-semibold bg-sap-error text-white rounded-lg hover:opacity-90 transition">
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
