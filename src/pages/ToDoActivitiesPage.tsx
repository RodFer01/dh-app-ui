// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Search, X } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['', 'Em Processo', 'Concluído', 'Cancelado']

const TODO_STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  '':            { label: 'Pendente',    color: '#616161', bg: '#F5F5F5', dot: '#9E9E9E' },
  'Em Processo': { label: 'Em Processo', color: '#7A5800', bg: '#FFF8E1', dot: '#F0AB00' },
  'Concluído':   { label: 'Concluído',   color: '#1B5E20', bg: '#E8F5E9', dot: '#43A047' },
  'Cancelado':   { label: 'Cancelado',   color: '#616161', bg: '#FAFAFA', dot: '#BDBDBD' },
}
const TODO_STATUS_ORDER = ['', 'Em Processo', 'Concluído', 'Cancelado']

const DOW_LABELS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTH_NAMES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysDiff(dateStr: string): number {
  if (!dateStr) return Infinity
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((d.getTime() - today.getTime()) / (1000*60*60*24))
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return 'No date'
  return new Date(dateStr+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function buildCalDays(year: number, month: number): (Date|null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month+1, 0)
  const days: (Date|null)[] = []
  for (let i = 0; i < first.getDay(); i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

function urgencyBorderColor(dateStr: string, isDone: boolean): string {
  if (isDone) return '#9E9E9E'
  const diff = daysDiff(dateStr)
  if (diff < 0)   return '#BB0000'
  if (diff === 0) return '#E65100'
  if (diff <= 7)  return '#F0AB00'
  return '#43A047'
}

// ── Small badges ───────────────────────────────────────────────────────────────

function ExpiryBadge({ dateStr }: { dateStr: string }) {
  const diff = daysDiff(dateStr)
  if (diff < 0)   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Vencida</span>
  if (diff === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">Hoje</span>
  if (diff <= 7)  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{diff}d</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">{diff}d</span>
}

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'xs'|'sm' }) {
  if (!status) return null
  const cls = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
  const m = TODO_STATUS_META[status] || TODO_STATUS_META['']
  return (
    <span className={`rounded-full font-bold ${cls} inline-flex items-center gap-1`}
      style={{ background: m.bg, color: m.color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:m.dot, display:'inline-block', flexShrink:0 }} />
      {m.label}
    </span>
  )
}

// ── Shared save mutation builder ───────────────────────────────────────────────

function useTodoSave(item: any, todoStatus: string, todoComments: string, onStatusSaved?: (s: string) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (statusOverride?: string) => {
      const effectiveStatus = statusOverride !== undefined ? statusOverride : todoStatus
      const { data: base = {} } = await api.get(`/api/notes/${item.opportunity_id}`).catch(() => ({ data: {} }))
      return api.put(`/api/notes/${item.opportunity_id}`, {
        stage:                    base.stage || '',
        risk:                     base.risk || '',
        next_step:                base.next_step || '',
        next_step_date:           base.next_step_date || '',
        blockers:                 base.blockers || '',
        notes:                    base.notes || '',
        deal_qual_status:         base.deal_qual_status || '',
        presales_status_override: base.presales_status_override || '',
        presales_comments:        base.presales_comments || '',
        next_actions:             base.next_actions || '',
        next_actions_date:        base.next_actions_date || '',
        digital_asset:            base.digital_asset || '',
        melody_engagement:        base.melody_engagement || '',
        pre_allocated_dsa:        base.pre_allocated_dsa || '',
        melody_comments:          base.melody_comments || '',
        todo_status:              effectiveStatus,
        todo_completion_comments: todoComments,
      })
    },
    onSuccess: (_, statusOverride) => {
      if (statusOverride !== undefined) onStatusSaved?.(statusOverride)
      qc.invalidateQueries({ queryKey: ['todo-activities'] })
    },
  })
}

// ── TodoCard — list / calendar view ───────────────────────────────────────────

function TodoCard({ item }: { item: any }) {
  const [open, setOpen]             = useState(false)
  const [todoStatus, setTodoStatus] = useState(item.todo_status || '')
  const [todoComments, setTodoComments] = useState(item.todo_completion_comments || '')
  const saveMut = useTodoSave(item, todoStatus, todoComments)

  const diff     = daysDiff(item.next_actions_date)
  const isDone   = item.todo_status === 'Concluído' || item.todo_status === 'Cancelado'
  const isOverdue = diff < 0 && !isDone
  const isUrgent  = diff >= 0 && diff <= 7

  const cardCls = isDone    ? 'bg-gray-50 border-gray-200 opacity-60'
    : isOverdue ? 'bg-red-50 border-red-200'
    : isUrgent  ? 'bg-amber-50 border-amber-200'
    : 'bg-white border-sap-border'

  return (
    <div className={`border rounded-xl p-3 text-[12px] transition ${cardCls}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sap-text truncate max-w-[260px]">{item.account_name || item.opportunity_id}</span>
            <ExpiryBadge dateStr={item.next_actions_date} />
            <StatusBadge status={item.todo_status} />
          </div>
          {item.opp_description && <p className="text-sap-muted mt-0.5 truncate text-[11px]">{item.opp_description}</p>}
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-sap-muted hover:text-sap-blue shrink-0 text-[11px] px-1 pt-0.5">
          {open ? '▲' : '▼'}
        </button>
      </div>

      <div className="mt-1.5 px-2.5 py-1.5 bg-sap-bg rounded-lg text-[11px]">
        <span className="text-sap-muted">Next Action: </span>
        <span className="font-semibold text-sap-text">{item.next_actions || '—'}</span>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-sap-bg rounded-lg p-2">
            {item.opp_phase    && <div><span className="text-sap-muted">Phase: </span><span>{item.opp_phase}</span></div>}
            {item.drm_category && <div><span className="text-sap-muted">DRM: </span><span className="font-semibold">{item.drm_category}</span></div>}
            {item.closing_qtr  && <div><span className="text-sap-muted">Qtr: </span><span>{item.closing_qtr}</span></div>}
            {item.solution_area_l1 && <div className="col-span-2"><span className="text-sap-muted">Solution: </span><span>{item.solution_area_l1}</span></div>}
            {item.acv_total_opp != null && <div><span className="text-sap-muted">ACV: </span><span className="font-semibold">${(item.acv_total_opp/1000).toFixed(0)}K</span></div>}
          </div>
          {item.presales_comments && <div className="text-[11px] px-2 py-1 border-l-2 border-sap-blue bg-blue-50 rounded"><span className="text-sap-muted font-medium">Presales: </span><span>{item.presales_comments}</span></div>}
          {item.notes && <div className="text-[11px] px-2 py-1 border-l-2 border-sap-border bg-sap-bg rounded"><span className="text-sap-muted font-medium">Notes: </span><span>{item.notes}</span></div>}
          {item.todo_completion_comments && <div className="text-[11px] px-2 py-1 border-l-2 border-green-400 bg-green-50 rounded"><span className="text-sap-muted font-medium">Completion: </span><span>{item.todo_completion_comments}</span></div>}
          <div className="border-t border-sap-border pt-2 space-y-1.5">
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Status</label>
              <select value={todoStatus} onChange={e => setTodoStatus(e.target.value)}
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue bg-white">
                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Completion Notes</label>
              <textarea value={todoComments} onChange={e => setTodoComments(e.target.value)}
                rows={2} placeholder="What was done, outcome, next steps…"
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue resize-none" />
            </div>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="w-full bg-sap-blue hover:bg-sap-blue-d text-white font-semibold py-1.5 rounded-lg transition disabled:opacity-60 text-[12px]">
              {saveMut.isPending ? 'Saving…' : '✓ Save'}
            </button>
            {saveMut.isSuccess && <p className="text-sap-success text-[11px] text-center">✓ Saved</p>}
            {saveMut.isError   && <p className="text-sap-error   text-[11px] text-center">⚠ Error saving</p>}
          </div>
          <div className="text-[10px] text-sap-muted text-right pt-1">
            {item.opp_owner_name && <>Owner: {item.opp_owner_name} · </>}Author: {item.author}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TodoKanbanCard — kanban view (ActionCard style) ────────────────────────────

function TodoKanbanCard({ item }: { item: any }) {
  const [open, setOpen]             = useState(false)
  const [todoStatus, setTodoStatus] = useState(item.todo_status || '')
  const [todoComments, setTodoComments] = useState(item.todo_completion_comments || '')

  const saveMut = useTodoSave(item, todoStatus, todoComments, s => setTodoStatus(s))

  const isDone      = item.todo_status === 'Concluído' || item.todo_status === 'Cancelado'
  const borderColor = urgencyBorderColor(item.next_actions_date, isDone)
  const overdue     = !isDone && daysDiff(item.next_actions_date) < 0

  return (
    <div className="bg-white rounded-xl border border-sap-border shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={item.todo_status} size="xs" />
              {!item.todo_status && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: TODO_STATUS_META[''].bg, color: TODO_STATUS_META[''].color }}>
                  <span style={{ width:6,height:6,borderRadius:'50%',background:TODO_STATUS_META[''].dot,display:'inline-block',marginRight:3 }} />
                  Pendente
                </span>
              )}
              {item.author && (
                <span className="text-[9px] font-semibold text-sap-muted bg-sap-bg px-1.5 py-0.5 rounded">{item.author}</span>
              )}
            </div>
            <h4 className="text-[13px] font-bold text-sap-text mt-1 leading-tight">{item.account_name || item.opportunity_id}</h4>
            {item.opp_description && <p className="text-[11px] text-sap-muted mt-0.5 line-clamp-2">{item.opp_description}</p>}
          </div>
          <button onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded-lg hover:bg-sap-bg text-sap-muted hover:text-sap-blue transition flex-shrink-0 text-[11px]">
            {open ? '▲' : '▼'}
          </button>
        </div>

        {item.next_actions && (
          <p className="text-[11px] text-sap-muted line-clamp-2 mb-2">{item.next_actions}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-sap-border">
          <div className="flex items-center gap-2">
            {item.next_actions_date && (
              <span className={`text-[10px] font-semibold ${overdue ? 'text-red-600' : 'text-sap-muted'}`}>
                {overdue ? '⚠ ' : ''}Due {item.next_actions_date}
              </span>
            )}
          </div>
          {/* Quick status circles */}
          <div className="flex gap-1">
            {TODO_STATUS_ORDER.map(s => {
              const m = TODO_STATUS_META[s]
              return (
                <button key={s} title={m.label}
                  onClick={() => saveMut.mutate(s)}
                  disabled={saveMut.isPending}
                  className={`w-5 h-5 rounded-full border-2 transition ${todoStatus === s ? 'scale-110' : 'opacity-40 hover:opacity-80'}`}
                  style={{ background: m.bg, borderColor: m.dot }} />
              )
            })}
          </div>
        </div>
      </div>

      {/* Expanded edit */}
      {open && (
        <div className="border-t border-sap-border px-4 pb-4 pt-3 space-y-2 bg-sap-bg/30">
          <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-white rounded-lg p-2 border border-sap-border">
            {item.opp_phase    && <div><span className="text-sap-muted">Phase: </span><span>{item.opp_phase}</span></div>}
            {item.drm_category && <div><span className="text-sap-muted">DRM: </span><span className="font-semibold">{item.drm_category}</span></div>}
            {item.closing_qtr  && <div><span className="text-sap-muted">Qtr: </span><span>{item.closing_qtr}</span></div>}
            {item.solution_area_l1 && <div className="col-span-2"><span className="text-sap-muted">Solution: </span><span>{item.solution_area_l1}</span></div>}
            {item.acv_total_opp != null && <div><span className="text-sap-muted">ACV: </span><span className="font-semibold">${(item.acv_total_opp/1000).toFixed(0)}K</span></div>}
          </div>
          {item.presales_comments && <div className="text-[11px] px-2 py-1 border-l-2 border-sap-blue bg-blue-50 rounded"><span className="text-sap-muted font-medium">Presales: </span><span>{item.presales_comments}</span></div>}
          {item.notes && <div className="text-[11px] px-2 py-1 border-l-2 border-sap-border bg-white rounded"><span className="text-sap-muted font-medium">Notes: </span><span>{item.notes}</span></div>}
          <div className="space-y-1.5">
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Status</label>
              <select value={todoStatus} onChange={e => setTodoStatus(e.target.value)}
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue bg-white">
                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Completion Notes</label>
              <textarea value={todoComments} onChange={e => setTodoComments(e.target.value)}
                rows={2} placeholder="What was done, outcome, next steps…"
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue resize-none" />
            </div>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="w-full bg-sap-blue hover:bg-sap-blue-d text-white font-semibold py-1.5 rounded-lg transition disabled:opacity-60 text-[12px]">
              {saveMut.isPending ? 'Saving…' : '✓ Save'}
            </button>
            {saveMut.isSuccess && <p className="text-sap-success text-[11px] text-center">✓ Saved</p>}
            {saveMut.isError   && <p className="text-sap-error   text-[11px] text-center">⚠ Error saving</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── GroupedTodoKanban ──────────────────────────────────────────────────────────

function GroupedTodoKanban({ activities }: { activities: any[] }) {
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('todo_kanban_collapsed') || '{}') } catch { return {} }
  })

  const toggle = (key: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('todo_kanban_collapsed', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const s of TODO_STATUS_ORDER) map[s] = []
    for (const a of activities) {
      const k = a.todo_status || ''
      if (map[k] !== undefined) map[k].push(a)
    }
    return map
  }, [activities])

  return (
    <div className="flex flex-col gap-4">
      {TODO_STATUS_ORDER.map(status => {
        const group = grouped[status] || []
        const m = TODO_STATUS_META[status]
        const isCollapsed = !!collapsed[status]
        const overdueCount = group.filter(a => daysDiff(a.next_actions_date) < 0).length

        return (
          <div key={status} className="rounded-xl border border-sap-border overflow-hidden">
            <button onClick={() => toggle(status)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-95 transition"
              style={{ background: m.bg }}>
              <div className="flex items-center gap-2.5">
                <span style={{ width:9, height:9, borderRadius:'50%', background:m.dot, display:'inline-block' }} />
                <span className="text-[13px] font-bold" style={{ color: m.color }}>{m.label}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70" style={{ color: m.color }}>
                  {group.length}
                </span>
                {overdueCount > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    ⚠ {overdueCount} overdue
                  </span>
                )}
              </div>
              <span className="text-[12px] font-medium" style={{ color: m.color }}>
                {isCollapsed ? '▼ Show' : '▲ Hide'}
              </span>
            </button>

            {!isCollapsed && (
              <div className="p-3 bg-white">
                {group.length === 0 ? (
                  <p className="text-[12px] text-sap-muted text-center py-4">Sem atividades</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.map((item: any) => (
                      <TodoKanbanCard key={item.opportunity_id} item={item} />
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ToDoActivitiesPage() {
  const [selectedUser, setSelectedUser] = useState('')
  const [showDone, setShowDone]         = useState(false)
  const [search, setSearch]             = useState('')
  const [view, setView]                 = useState<'list'|'calendar'|'kanban'>('list')
  const [calMonth, setCalMonth]         = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selectedDate, setSelectedDate] = useState<string|null>(null)

  const { data: users = [] } = useQuery({
    queryKey: ['todo-users'],
    queryFn: () => api.get('/api/todo-activities/users').then(r => r.data),
    staleTime: 5*60_000,
  })

  const { data: allActivities = [], isLoading } = useQuery({
    queryKey: ['todo-activities', selectedUser],
    queryFn: () => api.get('/api/todo-activities', { params: selectedUser ? { user_name: selectedUser } : {} }).then(r => r.data),
  })

  // Filtered (hide/show done + search)
  const activities = useMemo(() => {
    let list = showDone ? allActivities : allActivities.filter((a: any) => a.todo_status !== 'Concluído' && a.todo_status !== 'Cancelado')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a: any) =>
        (a.account_name||'').toLowerCase().includes(q) ||
        (a.next_actions||'').toLowerCase().includes(q) ||
        (a.opp_description||'').toLowerCase().includes(q)
      )
    }
    return list
  }, [allActivities, showDone, search])

  // List view grouping
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const item of activities) {
      const d = item.next_actions_date || ''
      if (!map[d]) map[d] = []
      map[d].push(item)
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
  }, [activities])

  // Calendar byDate map (all activities, unfiltered)
  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const a of allActivities) {
      const d = a.next_actions_date || ''
      if (d) { if (!map[d]) map[d] = []; map[d].push(a) }
    }
    return map
  }, [allActivities])

  // KPIs
  const overdueCount  = allActivities.filter((a: any) => daysDiff(a.next_actions_date) < 0 && a.todo_status !== 'Concluído' && a.todo_status !== 'Cancelado').length
  const todayCount    = allActivities.filter((a: any) => daysDiff(a.next_actions_date) === 0).length
  const doneCount     = allActivities.filter((a: any) => a.todo_status === 'Concluído' || a.todo_status === 'Cancelado').length
  const pendingCount  = allActivities.filter((a: any) => !a.todo_status || a.todo_status === 'Em Processo').length

  // Calendar state
  const calYear  = calMonth.getFullYear()
  const calMon   = calMonth.getMonth()
  const calDays  = buildCalDays(calYear, calMon)
  const todayStr = toDateStr(new Date())

  const selectedDateItems = useMemo(() => selectedDate ? (byDate[selectedDate] || []) : [], [selectedDate, byDate])

  function dayCellUrg(dateStr: string): string {
    const items = byDate[dateStr]; if (!items?.length) return ''
    const active = items.filter(a => a.todo_status !== 'Concluído' && a.todo_status !== 'Cancelado')
    if (!active.length) return 'done'
    const diff = daysDiff(dateStr)
    if (diff < 0)   return 'overdue'
    if (diff === 0) return 'today'
    if (diff <= 7)  return 'urgent'
    return 'normal'
  }

  return (
    <div className="flex flex-col h-full bg-sap-bg">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-sap-border flex-shrink-0 flex-wrap">
        <h2 className="text-[15px] font-bold text-sap-text">To Do Activities</h2>

        {/* Search */}
        <div className="flex items-center gap-1.5 border border-sap-border rounded-lg px-2.5 py-1.5 bg-white w-52">
          <Search size={12} className="text-sap-muted flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="text-[13px] focus:outline-none flex-1 min-w-0" />
          {search && <button onClick={() => setSearch('')}><X size={11} className="text-sap-muted" /></button>}
        </div>

        {/* User filter */}
        <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
          className="border border-sap-border rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none bg-white text-sap-text min-w-[190px]">
          <option value="">— All users —</option>
          {(users as string[]).map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <div className="flex-1" />

        {/* Show done toggle (list + kanban) */}
        {(view === 'list' || view === 'kanban') && (
          <button onClick={() => setShowDone(v => !v)}
            className={`px-3 py-1.5 rounded-lg border text-[12px] transition ${
              showDone ? 'bg-sap-blue text-white border-sap-blue' : 'bg-white text-sap-muted border-sap-border hover:border-sap-blue hover:text-sap-blue'
            }`}>
            {showDone ? 'Hide done' : 'Show done'}
          </button>
        )}

        {/* View toggle */}
        <div className="flex rounded-lg border border-sap-border overflow-hidden">
          {(['list','kanban','calendar'] as const).map(v => {
            const labels = { list: '☰ Lista', kanban: '⬛ Kanban', calendar: '📅 Calendário' }
            return (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-[12px] font-medium transition border-r border-sap-border last:border-r-0 ${
                  view === v ? 'bg-sap-blue text-white' : 'bg-white text-sap-text hover:bg-sap-bg'}`}>
                {labels[v]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── KPI row ── */}
      {allActivities.length > 0 && (
        <div className="flex gap-3 px-5 py-3 bg-white border-b border-sap-border flex-shrink-0 flex-wrap">
          {[
            { label: 'Total',    value: allActivities.length, color: '#0070F2', bg: '#E3F2FD' },
            { label: 'Overdue',  value: overdueCount,         color: '#BB0000', bg: '#FFEBEE' },
            { label: 'Hoje',     value: todayCount,           color: '#E65100', bg: '#FFF3E0' },
            { label: 'Pendente', value: pendingCount,         color: '#7A5800', bg: '#FFF8E1' },
            { label: 'Concluído',value: doneCount,            color: '#1B5E20', bg: '#E8F5E9' },
          ].map(k => (
            <div key={k.label} className="rounded-xl px-4 py-2 flex flex-col items-center" style={{ background: k.bg }}>
              <div className="text-[18px] font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[10px] font-semibold" style={{ color: k.color }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-sap-muted text-sm">Loading…</div>
        )}

        {!isLoading && allActivities.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-sap-muted">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-[14px] font-semibold mb-1">Sem atividades</div>
            <div className="text-[12px]">{selectedUser ? `${selectedUser} sem Next Action Dates.` : 'Selecione um usuário ou adicione Next Action Dates.'}</div>
          </div>
        )}

        {/* ── KANBAN ── */}
        {!isLoading && view === 'kanban' && allActivities.length > 0 && (
          <div className="p-5">
            <GroupedTodoKanban activities={activities} />
          </div>
        )}

        {/* ── LIST ── */}
        {!isLoading && view === 'list' && (
          <div className="p-5">
            {grouped.map(([date, items]) => {
              const diff     = daysDiff(date)
              const isOverdue = diff < 0
              const isToday   = diff === 0
              const isUrgent  = diff > 0 && diff <= 7
              const dotCls   = isOverdue ? 'bg-red-400' : isToday ? 'bg-orange-400' : isUrgent ? 'bg-amber-400' : 'bg-sap-border'
              const labelCls = isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : isUrgent ? 'text-amber-600' : 'text-sap-muted'
              return (
                <div key={date}>
                  <div className={`flex items-center gap-2 mb-2 ${labelCls}`}>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotCls}`} />
                    <span className="text-[13px] font-semibold capitalize">
                      {isOverdue && '⚠ '}{isToday && '● '}{fmtDate(date)}
                    </span>
                    <span className="text-[11px] font-normal text-sap-muted">({items.length})</span>
                    <div className="flex-1 h-px bg-sap-border" />
                  </div>
                  <div className="space-y-2 pl-5 mb-4">
                    {items.map((item: any) => <TodoCard key={item.opportunity_id} item={item} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {!isLoading && view === 'calendar' && allActivities.length > 0 && (
          <div className="p-5 space-y-4">
            {/* Month nav */}
            <div className="flex items-center justify-between bg-white border border-sap-border rounded-xl px-4 py-3">
              <button onClick={() => { setCalMonth(new Date(calYear, calMon-1, 1)); setSelectedDate(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sap-bg text-sap-muted hover:text-sap-blue transition text-lg">‹</button>
              <span className="text-[15px] font-semibold text-sap-text">{MONTH_NAMES[calMon]} {calYear}</span>
              <button onClick={() => { setCalMonth(new Date(calYear, calMon+1, 1)); setSelectedDate(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sap-bg text-sap-muted hover:text-sap-blue transition text-lg">›</button>
            </div>

            {/* Grid */}
            <div className="bg-white border border-sap-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-7 border-b border-sap-border">
                {DOW_LABELS.map(d => (
                  <div key={d} className="py-2 text-center text-[11px] font-semibold text-sap-muted uppercase tracking-wide">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calDays.map((day, idx) => {
                  if (!day) return <div key={`e${idx}`} className="h-16 border-r border-b border-sap-border/40 bg-gray-50/50" />
                  const ds      = toDateStr(day)
                  const items   = byDate[ds] || []
                  const active  = items.filter(a => a.todo_status !== 'Concluído' && a.todo_status !== 'Cancelado')
                  const done    = items.filter(a => a.todo_status === 'Concluído' || a.todo_status === 'Cancelado')
                  const urg     = dayCellUrg(ds)
                  const isSel   = selectedDate === ds
                  const isToday = ds === todayStr

                  const cellBg = isSel ? 'bg-sap-blue/10 ring-2 ring-inset ring-sap-blue'
                    : urg==='overdue' ? 'bg-red-50 hover:bg-red-100'
                    : urg==='today'   ? 'bg-orange-50 hover:bg-orange-100'
                    : urg==='urgent'  ? 'bg-amber-50 hover:bg-amber-100'
                    : urg==='normal'  ? 'bg-green-50/50 hover:bg-green-50'
                    : urg==='done'    ? 'bg-gray-50 hover:bg-gray-100'
                    : 'hover:bg-sap-bg'

                  const dayNumCls = isToday
                    ? 'w-6 h-6 rounded-full bg-sap-blue text-white flex items-center justify-center text-[12px] font-bold'
                    : 'text-[12px] font-medium text-sap-text'

                  const badgeCls = urg==='overdue' ? 'bg-red-200 text-red-700'
                    : urg==='today' ? 'bg-orange-200 text-orange-700'
                    : urg==='urgent' ? 'bg-amber-200 text-amber-700'
                    : 'bg-green-100 text-green-700'

                  return (
                    <div key={ds}
                      onClick={() => items.length ? setSelectedDate(d => d===ds ? null : ds) : undefined}
                      className={`h-16 border-r border-b border-sap-border/40 p-1.5 flex flex-col transition ${cellBg} ${items.length ? 'cursor-pointer' : ''}`}>
                      <div className={dayNumCls}>{day.getDate()}</div>
                      {active.length > 0 && (
                        <div className="mt-auto flex items-center gap-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${badgeCls}`}>{active.length}</span>
                          {done.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-gray-100 text-gray-500">{done.length}✓</span>}
                        </div>
                      )}
                      {active.length === 0 && done.length > 0 && (
                        <div className="mt-auto"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{done.length}✓</span></div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-3 flex-wrap text-[11px] text-sap-muted px-1">
              {[['bg-red-200','Vencida'],['bg-orange-200','Hoje'],['bg-amber-200','Urgente (≤7d)'],['bg-green-100','Normal'],['bg-gray-100','Concluída']].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${c} inline-block`} />{l}</span>
              ))}
            </div>

            {/* Selected day */}
            {selectedDate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-sap-text capitalize border-b border-sap-border pb-2">
                  <span>{fmtDate(selectedDate)}</span>
                  <span className="text-[11px] font-normal text-sap-muted">({selectedDateItems.length} atividade{selectedDateItems.length!==1?'s':''})</span>
                </div>
                {selectedDateItems.map((item: any) => <TodoCard key={item.opportunity_id} item={item} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
