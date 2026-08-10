// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { SectionLabel } from '../components/SectionLabel'
import { OutlookTokenBanner } from '../components/OutlookTokenBanner'
import { useAuth } from '../context/AuthContext'
import { formatAcvK } from '../lib/utils'
import { Plus, Trash2, Mail, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react'

interface Member { inumber: string; name: string; area: string }
interface Session {
  id: number
  member_name: string
  member_area: string
  meeting_date: string
  discussion: string
  feedback: string
  action_plan: string
  next_steps: string
  next_date: string | null
  created_at: string
}

const EMPTY_FORM = {
  member_name: '', member_area: '', meeting_date: '', discussion: '',
  feedback: '', action_plan: '', next_steps: '', next_date: '',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: color + '22', color }}>{label}</span>
  )
}

function Textarea({ label, value, onChange, rows = 4, placeholder = '' }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none transition"
      />
    </div>
  )
}

function SessionCard({ s, onEdit, onDelete, onDraft, drafting }: any) {
  const [expanded, setExpanded] = useState(false)
  const has = (v: string) => v && v.trim() !== ''

  return (
    <div className="card overflow-hidden mb-3">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-sap-bg select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[14px] text-sap-text">{s.member_name}</span>
            {s.member_area && <Badge label={s.member_area} color="#0070B8" />}
          </div>
          <div className="text-[12px] text-sap-muted mt-0.5">
            {s.meeting_date && <span>📅 {new Date(s.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>}
            {s.next_date && <span className="ml-3 text-sap-blue">→ Next: {new Date(s.next_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onDraft(s.id) }} disabled={drafting}
            title="Create Outlook draft"
            className="flex items-center gap-1 text-[11px] font-semibold border border-sap-border rounded-lg px-2.5 py-1.5 hover:bg-sap-blue hover:text-white hover:border-sap-blue transition">
            <Mail size={12} /> {drafting ? 'Creating…' : 'Draft Email'}
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(s) }}
            className="p-1.5 rounded-lg border border-sap-border text-sap-muted hover:text-sap-blue hover:border-sap-blue transition">
            <Edit2 size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(s.id) }}
            className="p-1.5 rounded-lg border border-sap-border text-sap-muted hover:text-sap-error hover:border-sap-error transition">
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-sap-muted" /> : <ChevronDown size={14} className="text-sap-muted" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sap-border px-4 py-4 grid grid-cols-2 gap-4 text-[13px]">
          {has(s.discussion) && (
            <div className="col-span-2">
              <div className="text-[11px] font-bold text-[#0070B8] uppercase tracking-wide mb-1">Discussion Notes</div>
              <p className="whitespace-pre-wrap text-sap-text bg-[#EBF5FB] rounded-lg px-3 py-2">{s.discussion}</p>
            </div>
          )}
          {has(s.feedback) && (
            <div>
              <div className="text-[11px] font-bold text-[#256F3A] uppercase tracking-wide mb-1">Feedback</div>
              <p className="whitespace-pre-wrap text-sap-text bg-[#E9F7EF] rounded-lg px-3 py-2">{s.feedback}</p>
            </div>
          )}
          {has(s.action_plan) && (
            <div>
              <div className="text-[11px] font-bold text-[#E76500] uppercase tracking-wide mb-1">Action Plan</div>
              <p className="whitespace-pre-wrap text-sap-text bg-[#FFF3E0] rounded-lg px-3 py-2">{s.action_plan}</p>
            </div>
          )}
          {has(s.next_steps) && (
            <div className="col-span-2">
              <div className="text-[11px] font-bold text-[#AA0808] uppercase tracking-wide mb-1">Next Steps</div>
              <p className="whitespace-pre-wrap text-sap-text bg-[#FDECEA] rounded-lg px-3 py-2">{s.next_steps}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FeedbackSessionPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editId, setEditId] = useState<number | null>(null)
  const [filterMember, setFilterMember] = useState('')
  const [draftingId, setDraftingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showForm, setShowForm] = useState(false)

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: members = [] as Member[] } = useQuery({
    queryKey: ['feedback-members'],
    queryFn:  () => api.get('/api/feedback-sessions/members').then(r => r.data),
    staleTime: 10 * 60_000,
  })

  const { data: sessions = [] as Session[], refetch } = useQuery({
    queryKey: ['feedback-sessions'],
    queryFn:  () => api.get('/api/feedback-sessions').then(r => r.data),
    staleTime: 60_000,
  })

  const filteredSessions = useMemo(() =>
    filterMember ? sessions.filter(s => s.member_name === filterMember) : sessions,
    [sessions, filterMember]
  )

  // Group members by area for the dropdown
  const membersByArea = useMemo(() => {
    const groups: Record<string, Member[]> = {}
    for (const m of members) {
      const a = m.area || 'Other'
      if (!groups[a]) groups[a] = []
      groups[a].push(m)
    }
    return groups
  }, [members])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (data: any) => editId
      ? api.patch(`/api/feedback-sessions/${editId}`, data)
      : api.post('/api/feedback-sessions', data),
    onSuccess: () => {
      refetch()
      setForm({ ...EMPTY_FORM })
      setEditId(null)
      setShowForm(false)
      showToast(editId ? 'Session updated' : 'Session saved')
    },
    onError: (e: any) => showToast(e?.response?.data?.detail || 'Error saving', false),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/feedback-sessions/${id}`),
    onSuccess: () => { refetch(); showToast('Session deleted') },
  })

  const draftMut = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/api/feedback-sessions/${id}/draft-email`)
      const eml = ['MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', `Subject: ${data.subject}`, '', data.html_body].join('\r\n')
      const blob = new Blob([eml], { type: 'message/rfc822' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'feedback-session.eml'; a.click()
      URL.revokeObjectURL(url)
      return data
    },
    onSuccess: () => {
      setDraftingId(null)
      showToast('Email file downloaded — open to send from Outlook')
    },
    onError: (e: any) => { setDraftingId(null); showToast(e?.response?.data?.detail || 'Error creating draft', false) },
  })

  function handleEdit(s: Session) {
    setEditId(s.id)
    setForm({
      member_name: s.member_name, member_area: s.member_area,
      meeting_date: s.meeting_date, discussion: s.discussion || '',
      feedback: s.feedback || '', action_plan: s.action_plan || '',
      next_steps: s.next_steps || '', next_date: s.next_date || '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleMemberSelect(name: string) {
    const m = members.find(x => x.name === name)
    setForm(f => ({ ...f, member_name: name, member_area: m?.area || f.member_area }))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-sap-text">1:1 Feedback Sessions</h2>
          <p className="text-[12px] text-sap-muted mt-0.5">Record meeting notes, feedback and action plans for your team</p>
        </div>
        <button
          onClick={() => { setShowForm(o => !o); setEditId(null); setForm({ ...EMPTY_FORM }) }}
          className={`flex items-center gap-1.5 text-[13px] font-semibold rounded-lg px-4 py-2 transition ${
            showForm ? 'bg-sap-error text-white' : 'bg-sap-blue text-white hover:bg-sap-blue-d'
          }`}
        >
          {showForm ? <><X size={14}/> Cancel</> : <><Plus size={14}/> New Session</>}
        </button>
      </div>
      <hr className="border-sap-border mb-5" />

      {/* ── Form ── */}
      {showForm && (
        <div className="card p-5 mb-6">
          <div className="text-[13px] font-semibold text-sap-text mb-4">
            {editId ? '✏ Edit Session' : '➕ New Session'}
          </div>

          {/* Member + Date */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Team Member *</label>
              <select value={form.member_name} onChange={e => handleMemberSelect(e.target.value)}
                className="border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue">
                <option value="">— Select team member —</option>
                {Object.entries(membersByArea).map(([area, mbs]) => (
                  <optgroup key={area} label={area}>
                    {mbs.map(m => <option key={m.inumber} value={m.name}>{m.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Area / Team</label>
              <input value={form.member_area} onChange={e => setF('member_area', e.target.value)}
                placeholder="Auto-filled or type manually"
                className="border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Meeting Date *</label>
              <input type="date" value={form.meeting_date} onChange={e => setF('meeting_date', e.target.value)}
                className="border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
          </div>

          {/* Text fields */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Textarea label="Discussion Notes" value={form.discussion} onChange={(v: string) => setF('discussion', v)}
              placeholder="Topics discussed, context, key points raised…" rows={5} />
            <Textarea label="Feedback" value={form.feedback} onChange={(v: string) => setF('feedback', v)}
              placeholder="Strengths observed, areas for improvement, specific examples…" rows={5} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Textarea label="Action Plan" value={form.action_plan} onChange={(v: string) => setF('action_plan', v)}
              placeholder="Agreed actions, owner, timeline…" rows={4} />
            <Textarea label="Next Steps" value={form.next_steps} onChange={(v: string) => setF('next_steps', v)}
              placeholder="Follow-up items, commitments, escalations…" rows={4} />
          </div>

          {/* Next check-in date */}
          <div className="flex items-end gap-4 mb-5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Next Check-in Date</label>
              <input type="date" value={form.next_date} onChange={e => setF('next_date', e.target.value)}
                className="border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-sap-border">
            <button
              onClick={() => saveMut.mutate(form)}
              disabled={!form.member_name || !form.meeting_date || saveMut.isPending}
              className="flex items-center gap-1.5 bg-sap-blue text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-sap-blue-d transition disabled:opacity-60 text-[13px]">
              <Check size={14} /> {saveMut.isPending ? 'Saving…' : editId ? 'Update Session' : 'Save Session'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm({ ...EMPTY_FORM }) }}
              className="border border-sap-border text-sap-muted font-semibold px-5 py-2.5 rounded-lg hover:bg-sap-bg transition text-[13px]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Filter ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Filter by Team Member</label>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
            className="border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue min-w-[220px]">
            <option value="">— All team members —</option>
            {Object.entries(membersByArea).map(([area, mbs]) => (
              <optgroup key={area} label={area}>
                {mbs.map(m => <option key={m.inumber} value={m.name}>{m.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="text-[12px] text-sap-muted mt-5">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          {filterMember ? ` for ${filterMember}` : ''}
        </div>
        {filterMember && (
          <button onClick={() => setFilterMember('')}
            className="mt-5 text-[11px] text-sap-blue hover:underline">Clear</button>
        )}
      </div>

      {/* ── Sessions list ── */}
      {filteredSessions.length === 0 ? (
        <div className="card p-10 text-center text-sap-muted">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-[14px]">No sessions yet. Click <b>New Session</b> to record your first 1:1.</p>
        </div>
      ) : (
        filteredSessions.map(s => (
          <SessionCard
            key={s.id}
            s={s}
            onEdit={handleEdit}
            onDelete={(id: number) => { if (confirm(`Delete session with ${s.member_name}?`)) deleteMut.mutate(id) }}
            onDraft={(id: number) => { setDraftingId(id); draftMut.mutate(id) }}
            drafting={draftingId === s.id && draftMut.isPending}
          />
        ))
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: toast.ok ? '#256f3a' : '#BB0000',
          color: '#fff', padding: '.75rem 1.25rem',
          borderRadius: '.625rem', fontSize: '.8125rem', zIndex: 2000,
          maxWidth: 380,
        }} dangerouslySetInnerHTML={{ __html: toast.msg }} />
      )}
    </div>
  )
}
