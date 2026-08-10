// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Plus, ThumbsUp, MessageSquare, Edit2, Trash2, X, Check } from 'lucide-react'

const STATUS_META = {
  open:        { label: 'Open',        bg: '#EBF5FB', color: '#1A5276', dot: '#2E86C1' },
  in_progress: { label: 'In Progress', bg: '#FEF9E7', color: '#935116', dot: '#F0AB00' },
  planned:     { label: 'Planned',     bg: '#E8F8F5', color: '#1E8449', dot: '#27AE60' },
  done:        { label: 'Done',        bg: '#E8F5E9', color: '#1E8449', dot: '#43A047' },
  declined:    { label: 'Declined',    bg: '#FDEDEC', color: '#BB0000', dot: '#E74C3C' },
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.open
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: m.bg, color: m.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, display: 'inline-block', flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

const EMPTY_FORM = { title: '', description: '', indicators: '', data_needed: '' }

function IdeaModal({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!initial
  const [form, setForm] = useState(isEdit ? {
    title: initial.title || '', description: initial.description || '',
    indicators: initial.indicators || '', data_needed: initial.data_needed || '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) {
        await api.put(`/api/idea-zone/${initial.id}`, form)
      } else {
        await api.post('/api/idea-zone', form)
      }
      onSaved(); onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Error saving')
    } finally { setSaving(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[580px] max-h-[92vh] overflow-y-auto border border-sap-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border">
          <h3 className="text-[16px] font-bold text-sap-text flex items-center gap-2">
            💡 {isEdit ? 'Edit Idea' : 'New Idea'}
          </h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="What feature do you need?"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={4} placeholder="Describe the functionality in detail. What problem does it solve? Who benefits?"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">KPIs / Indicators</label>
            <textarea value={form.indicators} onChange={e => set('indicators', e.target.value)}
              rows={2} placeholder="What metrics would we track? e.g. Deal win rate, SA coverage, Pipeline conversion…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Data Needed</label>
            <textarea value={form.data_needed} onChange={e => set('data_needed', e.target.value)}
              rows={2} placeholder="What data sources are required? e.g. Pipeline CSV, Melody API, CRM export…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>
          {error && <p className="text-xs text-sap-error bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-sap-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-sap-border rounded-lg hover:bg-sap-bg transition">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-sap-blue text-white rounded-lg hover:bg-sap-blue-d disabled:opacity-60 transition flex items-center gap-1.5">
            {saving && <span style={{ display:'inline-block', width:11, height:11, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit Idea'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CommentPanel({ idea, onClose, user }: { idea: any; onClose: () => void; user: any }) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')

  const { data: comments = [] } = useQuery({
    queryKey: ['idea-comments', idea.id],
    queryFn: () => api.get(`/api/idea-zone/${idea.id}/comments`).then(r => r.data),
    staleTime: 30_000,
  })

  const addMut = useMutation({
    mutationFn: (b: string) => api.post(`/api/idea-zone/${idea.id}/comments`, { body: b }),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['idea-comments', idea.id] }); qc.invalidateQueries({ queryKey: ['idea-zone'] }) },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/idea-zone/comments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['idea-comments', idea.id] }); qc.invalidateQueries({ queryKey: ['idea-zone'] }) },
  })

  return (
    <div className="border-t border-sap-border mt-3 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-sap-muted uppercase tracking-wide">Comments ({comments.length})</span>
        <button onClick={onClose} className="text-sap-muted hover:text-sap-text"><X size={13} /></button>
      </div>
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 mb-2">
        {comments.length === 0 && <p className="text-[12px] text-sap-muted text-center py-3">No comments yet.</p>}
        {comments.map((c: any) => (
          <div key={c.id} className="bg-sap-bg rounded-lg px-2.5 py-2 text-[12px]">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-semibold text-sap-blue text-[11px]">{c.author}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-sap-subtle">{c.created_at}</span>
                {(user?.role === 'admin' || user?.name === c.author) && (
                  <button onClick={() => delMut.mutate(c.id)} className="text-sap-muted hover:text-sap-error transition"><Trash2 size={10} /></button>
                )}
              </div>
            </div>
            <p className="text-sap-text whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={2}
          placeholder="Add a comment…"
          className="flex-1 border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue resize-none" />
        <button onClick={() => body.trim() && addMut.mutate(body.trim())}
          disabled={!body.trim() || addMut.isPending}
          className="self-end px-3 py-1.5 text-[12px] font-semibold bg-sap-blue text-white rounded-lg hover:bg-sap-blue-d disabled:opacity-50 transition flex items-center gap-1">
          <Check size={11} /> Add
        </button>
      </div>
    </div>
  )
}

export function IdeaZonePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editIdea, setEditIdea] = useState<any>(null)
  const [openComments, setOpenComments] = useState<number | null>(null)

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ['idea-zone'],
    queryFn: () => api.get('/api/idea-zone').then(r => r.data),
    staleTime: 30_000,
  })

  const voteMut = useMutation({
    mutationFn: (id: number) => api.post(`/api/idea-zone/${id}/vote`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-zone'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/idea-zone/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-zone'] }),
  })

  const filtered = statusFilter === 'all' ? ideas : ideas.filter((i: any) => i.status === statusFilter)

  const total = ideas.length
  const open = ideas.filter((i: any) => i.status === 'open').length
  const mine = ideas.filter((i: any) => i.author_email === user?.email).length
  const topVotes = ideas.length > 0 ? Math.max(...ideas.map((i: any) => i.vote_count)) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-sap-text flex items-center gap-2">💡 IdeaZone</h2>
          <p className="text-[12px] text-sap-muted mt-0.5">Submit feature ideas, describe the value, and vote to prioritize</p>
        </div>
        <button onClick={() => { setEditIdea(null); setShowModal(true) }}
          className="flex items-center gap-1.5 text-[13px] font-semibold bg-[#F0AB00] text-white rounded-lg px-4 py-2 hover:bg-[#d4900a] transition">
          <Plus size={14} /> New Idea
        </button>
      </div>
      <hr className="border-sap-border mb-5" />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Ideas', value: total, color: '#0070B8' },
          { label: 'Open', value: open, color: '#2E86C1' },
          { label: 'My Ideas', value: mine, color: '#935116' },
          { label: 'Top Votes', value: topVotes, color: '#1E8449' },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-sap-muted mb-1">{k.label}</div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-sap-border">
        {['all', 'open', 'in_progress', 'planned', 'done', 'declined'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              statusFilter === s ? 'border-[#F0AB00] text-[#935116] font-semibold' : 'border-transparent text-sap-muted hover:text-sap-text'
            }`}>
            {s === 'all' ? 'All' : STATUS_META[s]?.label ?? s}
            {s !== 'all' && <span className="ml-1 text-[11px] text-sap-subtle">({ideas.filter((i: any) => i.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* Ideas grid */}
      {isLoading ? (
        <div className="text-center text-sap-muted py-16 text-sm">Loading ideas…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">💡</div>
          <p className="text-sap-muted text-[14px]">No ideas yet. Be the first to submit one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((idea: any) => (
            <div key={idea.id} className="card p-4 flex flex-col">
              {/* Top bar */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <StatusBadge status={idea.status} />
                {(user?.role === 'admin' || user?.email === idea.author_email) && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => { setEditIdea(idea); setShowModal(true) }}
                      className="p-1 rounded text-sap-muted hover:text-sap-blue transition"><Edit2 size={12} /></button>
                    <button onClick={() => { if (confirm('Delete this idea?')) deleteMut.mutate(idea.id) }}
                      className="p-1 rounded text-sap-muted hover:text-sap-error transition"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="text-[14px] font-bold text-sap-text mb-1.5 leading-snug">{idea.title}</h3>

              {/* Description */}
              {idea.description && (
                <p className="text-[12px] text-sap-muted mb-2.5 line-clamp-3 leading-relaxed">{idea.description}</p>
              )}

              {/* Indicators */}
              {idea.indicators && (
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-1">KPIs</div>
                  <p className="text-[11px] text-sap-text bg-sap-bg rounded px-2 py-1">{idea.indicators}</p>
                </div>
              )}

              {/* Data needed */}
              {idea.data_needed && (
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-1">Data Needed</div>
                  <p className="text-[11px] text-sap-text bg-sap-bg rounded px-2 py-1">{idea.data_needed}</p>
                </div>
              )}

              <div className="flex-1" />

              {/* Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-sap-border mt-2">
                <div className="flex items-center gap-3">
                  {/* Vote button */}
                  <button
                    onClick={() => voteMut.mutate(idea.id)}
                    disabled={voteMut.isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition border ${
                      idea.user_voted
                        ? 'bg-[#F0AB00] text-white border-[#F0AB00]'
                        : 'border-sap-border text-sap-muted hover:border-[#F0AB00] hover:text-[#935116]'
                    }`}>
                    <ThumbsUp size={12} />
                    {idea.vote_count}
                  </button>
                  {/* Comments */}
                  <button
                    onClick={() => setOpenComments(openComments === idea.id ? null : idea.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition border ${
                      openComments === idea.id
                        ? 'bg-sap-blue text-white border-sap-blue'
                        : 'border-sap-border text-sap-muted hover:border-sap-blue hover:text-sap-blue'
                    }`}>
                    <MessageSquare size={12} />
                    {idea.comment_count}
                  </button>
                </div>
                <div className="text-[10px] text-sap-subtle text-right">
                  <div className="font-medium">{idea.author}</div>
                  <div>{idea.created_at?.slice(0, 10)}</div>
                </div>
              </div>

              {/* Comments panel */}
              {openComments === idea.id && (
                <CommentPanel idea={idea} user={user} onClose={() => setOpenComments(null)} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <IdeaModal
          initial={editIdea}
          onClose={() => { setShowModal(false); setEditIdea(null) }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['idea-zone'] })}
        />
      )}
    </div>
  )
}
