// @ts-nocheck
import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { FilterBar, FilterGrid } from '../components/FilterBar'
import { PipelineFilterBar } from '../components/PipelineFilterBar'
import { DataTable } from '../components/DataTable'
import { EChart } from '../components/EChart'
import { useAuth } from '../context/AuthContext'
import { formatAcvK, acvCol } from '../lib/utils'
import { OutlookTokenBanner } from '../components/OutlookTokenBanner'
import { useOutlookToken } from '../lib/useOutlookToken'
import { usePipelineFilters } from '../lib/usePipelineFilters'
import { X, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
import { oppIdCol } from '../components/OppIdCol'
import { presalesStatusCol, qualDecisionCol } from '../lib/presalesHelpers'
import { OppDetailPanel, BLANK_NOTE_FORM } from '../components/OppDetailPanel'
import { BuildingBlockChart } from '../components/BuildingBlockChart'

export function OpportunityListPage() {
  const { currency, fxRate } = useAuth()
  const qc = useQueryClient()
  const { tokenHeaders, calToken } = useOutlookToken()

  const { filters, params: apiParams, debouncedParams, toggle, set: setFilter, clear: clearFilters } = usePipelineFilters()

  const [selected, setSelected] = useState(null)
  const [noteForm, setNoteForm] = useState(BLANK_NOTE_FORM)

  // Filter options
  const { data: opts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => api.get('/api/pipeline/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // Server-side KPIs
  const { data: kpis = {} } = useQuery({
    queryKey: ['pipeline-kpis', debouncedParams],
    queryFn: () => api.get('/api/pipeline/kpis', { params: debouncedParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['pipeline', apiParams],
    queryFn: () => api.get('/api/pipeline', { params: apiParams }).then(r => r.data),
  })

  // Reset form when a new opportunity is selected, then load saved notes
  const handleSelectOpp = (row) => {
    setSelected(row)
    // Reset to blank — will be overwritten by onSuccess if notes exist
    setNoteForm(BLANK_NOTE_FORM)
  }

  const { data: notes = null } = useQuery({
    queryKey: ['notes', selected?.opportunity_id],
    queryFn: () => api.get(`/api/notes/${selected.opportunity_id}`).then(r => r.data),
    enabled: !!selected?.opportunity_id,
    onSuccess: (d) => {
      if (d) setNoteForm({
        deal_qual_status: d.deal_qual_status || '',
        presales_status_override: d.presales_status_override || '',
        presales_comments: d.presales_comments || '',
        next_actions: d.next_actions || '',
        next_actions_date: d.next_actions_date || '',
        stage: d.stage || '', risk: d.risk || '',
        next_step: d.next_step || '', next_step_date: d.next_step_date || '',
        blockers: d.blockers || '', notes: d.notes || '',
        digital_asset: d.digital_asset || '',
        melody_engagement: d.melody_engagement || '',
        pre_allocated_dsa: d.pre_allocated_dsa || '',
        melody_comments: d.melody_comments || '',
        todo_status: d.todo_status || '',
        todo_completion_comments: d.todo_completion_comments || '',
        author: d.author || '',
        updated_at: d.updated_at || '',
      })
    },
  })

  const saveMut = useMutation({
    mutationFn: (data) => api.put(`/api/notes/${selected.opportunity_id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({queryKey:['notes', selected?.opportunity_id]})
      qc.invalidateQueries({queryKey:['notes-history', selected?.opportunity_id]})
      setEditedOpps(prev => {
        const exists = prev.find(o => o.opportunity_id === selected.opportunity_id)
        if (exists) return prev
        return [...prev, selected]
      })
    },
  })

  // Pipeline review email state
  const [editedOpps, setEditedOpps] = useState([])
  const [oppSessions, setOppSessions] = useState({})
  const [reviewEmailOpen, setReviewEmailOpen] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [selReviewOpps, setSelReviewOpps] = useState([])

  // AE Reminder state
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderNote, setReminderNote] = useState('')
  const [reminderAeEmail, setReminderAeEmail] = useState('')
  const [selectedOppIds, setSelectedOppIds] = useState<Set<string>>(new Set())
  const toggleOppSelect = (id: string) => setSelectedOppIds(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const clearOppSelection = () => setSelectedOppIds(new Set())
  const reminderMut = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/api/draft/ae-reminder', payload)
      // Create .eml file — Outlook opens it with full HTML formatting
      const eml = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        `To: ${data.to_email || ''}`,
        `Subject: ${data.subject}`,
        '',
        data.html_body,
      ].join('\r\n')
      const blob = new Blob([eml], { type: 'message/rfc822' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'pipeline-reminder.eml'
      a.click()
      URL.revokeObjectURL(url)
      return { ok: true }
    },
    onSuccess: () => {
      setReminderOpen(false)
      setReminderNote('')
      setReminderAeEmail('')
    },
  })
  const reviewEmailMut = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/draft/pipeline-review', payload)
      const eml = ['MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8',`Subject: ${data.subject}`,'',data.html_body].join('\r\n')
      const blob = new Blob([eml], { type: 'message/rfc822' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'pipeline-review.eml'; a.click()
      URL.revokeObjectURL(url)
      return { ok: true }
    },
    onSuccess: (res) => {
      // Uncheck opps that were just drafted
      const drafted = selReviewOpps.slice()
      setEditedOpps(prev => prev.filter(o => !drafted.includes(o.opportunity_id)))
      setSelReviewOpps([])
      setReviewNote('')
    },
  })

  const toggleReviewOpp = (id) => setSelReviewOpps(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])

  const fx = fxRate

  // ── LoB badge logic (defined early — used by bagFilter useMemo below) ──────
  const LOB_NON_TF_FIELDS = [
    'acv_l1_baip_dai','acv_l1_btm','acv_l1_cloud_erp',
    'acv_l1_cx','acv_l1_finance','acv_l1_hcm','acv_l1_scm','acv_l1_other',
  ]
  function getLobBadge(data: any): { label: string; bg: string; color: string } | null {
    if (!data) return null
    const nonTFActive = LOB_NON_TF_FIELDS.filter(f => Number(data[f] || 0) > 0)
    const hasTF = Number(data.acv_l1_baip_tf || 0) > 0
    const totalActive = nonTFActive.length + (hasTF ? 1 : 0)
    if (totalActive === 0) return null
    if (nonTFActive.length > 1)
      return { label: '🧺 Basket Deal', bg: '#EDE7F6', color: '#5E35B1' }
    return { label: '🎯 Single Bag', bg: '#E3F2FD', color: '#1565C0' }
  }

  // Bag type filter — 'all' | 'single' | 'basket'
  const [bagFilter, setBagFilter] = useState<'all' | 'single' | 'basket'>('all')
  // SDE filter: 'all' | 'with_sde' | 'handover_done' | 'handover_pending' | 'no_sde'
  const [sdeFilter, setSdeFilter] = useState<string>('all')

  // Apply bag + SDE filters on top of the rows already fetched from the API
  const filteredByBag = useMemo(() => {
    let filtered = rows
    // Bag filter
    if (bagFilter !== 'all') {
      filtered = filtered.filter(r => {
        const badge = getLobBadge(r)
        if (bagFilter === 'single')  return badge?.label.includes('Single')
        if (bagFilter === 'basket')  return badge?.label.includes('Basket')
        return true
      })
    }
    // SDE filter
    if (sdeFilter !== 'all') {
      filtered = filtered.filter((r:any) => {
        const hasSde     = !!r.sde_primary_engagement_name
        const hasHandover = !!(r.sde_handover_date || r.sde_handover_name)
        if (sdeFilter === 'with_sde')        return hasSde
        if (sdeFilter === 'handover_done')   return hasSde && hasHandover
        if (sdeFilter === 'handover_pending') return hasSde && !hasHandover
        if (sdeFilter === 'no_sde')          return !hasSde
        return true
      })
    }
    return filtered
  }, [rows, bagFilter, sdeFilter])

  const nOpps     = filteredByBag.length
  const acvTot    = filteredByBag.reduce((s,r) => s+(r.acv_total_opp||0),0)*fx
  const nScored   = filteredByBag.filter(r => r.deal_qualification_score).length
  const scores    = filteredByBag.map(r => r.deal_qualification_score).filter(Boolean)
  const avgScore  = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '—'

  // Engagement Type chart data — derived from rows
  const [chartsOpen, setChartsOpen] = useState(false)
  const engagementData = useMemo(() => {
    const byType: Record<string, { n: number; acv: number }> = {}
    for (const r of filteredByBag) {
      const t = r.engagement_type || 'Not Set'
      if (!byType[t]) byType[t] = { n: 0, acv: 0 }
      byType[t].n   += 1
      byType[t].acv += (r.acv_total_opp || 0) * fx
    }
    return Object.entries(byType)
      .sort((a, b) => b[1].acv - a[1].acv)
      .map(([label, v]) => ({ label, n: v.n, acv: +(v.acv / 1000).toFixed(1) }))
  }, [filteredByBag, fx])

  const acvLabel = `ACV K (${currency})`

  // LoB ACV column definitions — hidden by default, toggled via show/hide panel
  const LOB_COLS = [
    { field: 'acv_l1_baip_dai',  label: 'BAIP – Data & AI' },
    { field: 'acv_l1_baip_tf',   label: 'BAIP – Tech Foundation' },
    { field: 'acv_l1_btm',       label: 'BTM' },
    { field: 'acv_l1_cloud_erp', label: 'Cloud ERP Private' },
    { field: 'acv_l1_cx',        label: 'Customer Experience' },
    { field: 'acv_l1_finance',   label: 'Finance & Spend' },
    { field: 'acv_l1_hcm',       label: 'HCM' },
    { field: 'acv_l1_scm',       label: 'Supply Chain' },
    { field: 'acv_l1_other',     label: 'Other' },
  ]

  const BASE_COL_KEYS = [
    'oppId','opp_owner_name','account_name','sde_badge','opp_description',
    'solution_area_l1','sub_solution_area_l2','drm_category','engagement_type','opp_phase',
    'deal_qualification_score','deal_qualification_decision','acv_total_opp',
    'closing_qtr','fc_qualification','iss_group_text','account_planned_archetype_text',
    'local_acct_owner','channel_partner','channel_manager','flsm','vat_dh','vat_full','vat_size',
    'dda_status','range_aging','aging_up_today',
    'iae',
  ]

  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(BASE_COL_KEYS))
  const [colPanelOpen, setColPanelOpen] = useState(false)
  const toggleCol = (k: string) => setVisibleCols(p => {
    const n = new Set(p)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })

  // Selection handled via AG Grid native row selection + separate selected set
  const selectCol = null

  const ALL_COL_DEFS = [
    { key: 'oppId',             def: oppIdCol },
    { key: 'opp_owner_name',    def: { field:'opp_owner_name',      headerName:'Owner',         width:140 } },
    { key: 'account_name',      def: { field:'account_name',        headerName:'Account',       flex:1, minWidth:160 } },
    { key: 'sde_badge',         def: {
        field: 'sde_primary_engagement_name',
        headerName: 'SDE',
        width: 90,
        cellRenderer: (p: any) => {
          const name = p.data?.sde_primary_engagement_name
          const handover = p.data?.sde_handover_date || p.data?.sde_handover_name
          if (!name) return <span style={{color:'#9E9E9E',fontSize:11}}>—</span>
          const color = handover ? '#1B5E20' : '#BB0000'
          const bg    = handover ? '#E8F5E9' : '#FFEBEE'
          const title = handover
            ? `SDE: ${name}\nHandover: ${handover}`
            : `SDE: ${name}\nPending handover`
          return (
            <span title={title}
              style={{display:'inline-flex',alignItems:'center',gap:3,
                background:bg,color,fontWeight:700,fontSize:10,
                padding:'2px 6px',borderRadius:10,whiteSpace:'nowrap'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:color,display:'inline-block'}}/>
              SDE
            </span>
          )
        },
      }
    },
    { key: 'opp_description',   def: {
        field: 'opp_description',
        headerName: 'Description',
        flex: 1,
        minWidth: 220,
        valueGetter: (p: any) => {
          const badge = getLobBadge(p.data)
          const desc = p.data?.opp_description || ''
          return badge ? `${badge.label}  ${desc}` : desc
        },
        cellStyle: (p: any) => {
          const badge = getLobBadge(p.data)
          if (!badge) return {}
          return { color: badge.color, fontWeight: 600 }
        },
      }
    },
    { key: 'solution_area_l1',  def: { field:'solution_area_l1',    headerName:'Solution L1',   width:160 } },
    { key: 'sub_solution_area_l2', def: { field:'sub_solution_area_l2', headerName:'Solution L2', width:160 } },
    { key: 'drm_category',      def: { field:'drm_category',        headerName:'DRM Category',  width:120 } },
    { key: 'engagement_type',   def: {
        field: 'engagement_type',
        headerName: 'Engagement',
        width: 110,
        cellStyle: (p: any) => {
          const v = (p.value || '').toLowerCase()
          if (v.includes('digital'))      return { color: '#256f3a', fontWeight: 700 }
          if (v.includes('field'))        return { color: '#BB0000', fontWeight: 700 }
          if (v.includes('no engagement') || v === 'no engagement')
                                          return { color: '#856404', fontWeight: 700 }
          return {}
        },
      }
    },
    { key: 'opp_phase',         def: { field:'opp_phase',           headerName:'Opp Phase',     width:130 } },
    { key: 'deal_qualification_score', def: { field:'deal_qualification_score', headerName:'Score', width:75 } },
    { key: 'presales_status', def: presalesStatusCol(110) },
    { key: 'deal_qualification_decision', def: qualDecisionCol(130) },
    { key: 'acv_total_opp',     def: acvCol('acv_total_opp', fx, currency, acvLabel, 140) },
    // LoB ACV columns
    ...LOB_COLS.map(l => ({
      key: l.field,
      def: {
        ...acvCol(l.field, fx, currency, l.label, 130),
        hide: !visibleCols.has(l.field),
        columnGroupShow: 'open',
      },
    })),
    { key: 'closing_qtr',       def: { field:'closing_qtr',         headerName:'Closing Qtr',   width:110 } },
    { key: 'fc_qualification',  def: { field:'fc_qualification',    headerName:'FC',            width:100 } },
    { key: 'iss_group_text',    def: { field:'iss_group_text',      headerName:'Segment',       width:110 } },
    { key: 'account_planned_archetype_text', def: { field:'account_planned_archetype_text', headerName:'Sub Segment', width:130 } },
    { key: 'local_acct_owner',  def: { field:'local_acct_owner',    headerName:'Local Owner',   width:140 } },
    { key: 'channel_partner',   def: { field:'channel_partner',     headerName:'Channel Partner', width:180 } },
    { key: 'channel_manager',   def: { field:'channel_manager',     headerName:'Channel Manager', width:160 } },
    { key: 'flsm',              def: { field:'flsm',                headerName:'Sales Manager', width:150 } },
    { key: 'vat_dh',            def: { field:'vat_dh',              headerName:'VAT_DH',        flex:1, minWidth:150 } },
    { key: 'vat_full',          def: { field:'vat_full',            headerName:'VAT_Full',      flex:1, minWidth:150 } },
    { key: 'vat_size',          def: { field:'vat_size',            headerName:'VAT_Size',      width:90 } },
    { key: 'dda_status',        def: { field:'dda_status',          headerName:'DDA Status',    width:130 } },
    { key: 'range_aging',       def: { field:'range_aging',         headerName:'Range Aging',   width:120 } },
    { key: 'aging_up_today',    def: { field:'aging_up_today',      headerName:'Aging (days)',  width:100 } },
    // SPEC / IAE columns — from account_specs via account_bp
    { key: 'iae',              def: { field:'iae',              headerName:'IAE',              width:150 } },
    { key: 'spec_cx',          def: { field:'spec_cx',          headerName:'SPEC CX',          width:140 } },
    { key: 'spec_hxm',         def: { field:'spec_hxm',         headerName:'SPEC HXM',         width:140 } },
    { key: 'spec_btp',         def: { field:'spec_btp',         headerName:'SPEC BTP',         width:140 } },
    { key: 'spec_procurement', def: { field:'spec_procurement', headerName:'SPEC Procurement', width:160 } },
    { key: 'spec_dsc',         def: { field:'spec_dsc',         headerName:'SPEC DSC',         width:140 } },
    { key: 'spec_bdc',         def: { field:'spec_bdc',         headerName:'SPEC BDC',         width:140 } },
    { key: 'spec_fin',         def: { field:'spec_fin',         headerName:'SPEC FIN',         width:140 } },
    { key: 'spec_pro',         def: { field:'spec_pro',         headerName:'SPEC PRO',         width:140 } },
  ]

  const cols = ALL_COL_DEFS
    .filter(({ key }) => visibleCols.has(key))
    .map(({ def }) => def)

  const QUAL = ['','GO','No-Go','Re-Qualify','In Qualification','Qualified','De-qualified']
  const PS   = ['','Engaged','Not Engaged','Monitoring','Escalated','Closed']

  // Multi-select dropdown component
  const MultiSel = ({ k, label, options }) => {
    const selected = filters[k] || []
    const [open, setOpen] = useState(false)
    return (
      <div className="flex flex-col gap-1 relative">
        <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">{label}</label>
        <button
          onClick={() => setOpen(o => !o)}
          className={`border rounded-lg px-2 py-1.5 text-[13px] text-left flex items-center justify-between transition focus:outline-none ${
            selected.length ? 'border-sap-blue bg-sap-blue-l text-sap-blue' : 'border-sap-border bg-white text-sap-muted'
          }`}
        >
          <span className="truncate">
            {selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
          </span>
          <span className="ml-1 text-[10px]">▾</span>
        </button>
        {open && (
          <div className="absolute top-full left-0 z-50 bg-white border border-sap-border rounded-xl shadow-hover mt-1 min-w-[200px] max-h-[280px] overflow-y-auto">
            <div className="px-2 py-1.5 border-b border-sap-border flex items-center justify-between">
              <span className="text-[10px] font-semibold text-sap-muted uppercase">Select {label}</span>
              {selected.length > 0 && (
                <button onClick={() => setFilters(f => ({...f,[k]:[]}))}
                  className="text-[10px] text-sap-blue hover:underline">Clear</button>
              )}
            </div>
            {(options||[]).map(opt => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-sap-bg cursor-pointer text-[13px]">
                <input type="checkbox" checked={selected.includes(opt)}
                  onChange={() => toggleValue(k, opt)}
                  className="accent-sap-blue flex-shrink-0" />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        )}
        {/* Close on outside click */}
        {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      </div>
    )
  }

  // Multi-select WITH search — for high-cardinality lists (owners, managers)
  const SearchMultiSel = ({ k, label, options }) => {
    const selected = filters[k] || []
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const filtered = (options||[]).filter(o => !query || o.toLowerCase().includes(query.toLowerCase()))
    return (
      <div className="flex flex-col gap-1 relative">
        <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">{label}</label>
        <button
          onClick={() => { setOpen(o => !o); setQuery('') }}
          className={`border rounded-lg px-2 py-1.5 text-[13px] text-left flex items-center justify-between transition focus:outline-none ${
            selected.length ? 'border-sap-blue bg-sap-blue-l text-sap-blue' : 'border-sap-border bg-white text-sap-muted'
          }`}
        >
          <span className="truncate">
            {selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
          </span>
          <span className="ml-1 text-[10px]">▾</span>
        </button>
        {open && (
          <div className="absolute top-full left-0 z-50 bg-white border border-sap-border rounded-xl shadow-hover mt-1 min-w-[240px]" style={{maxHeight:'320px',display:'flex',flexDirection:'column'}}>
            {/* Search input */}
            <div className="px-2 pt-2 pb-1.5 border-b border-sap-border flex-shrink-0">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${label}…`}
                onClick={e => e.stopPropagation()}
                className="w-full border border-sap-border rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:border-sap-blue"
              />
            </div>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="px-2 pt-1 pb-1 border-b border-sap-border flex-shrink-0 flex flex-wrap gap-1">
                {selected.map(s => (
                  <span key={s} className="flex items-center gap-0.5 bg-sap-blue-l text-sap-blue text-[11px] px-1.5 py-0.5 rounded-full font-medium">
                    <span className="max-w-[100px] truncate">{s}</span>
                    <button onClick={e => { e.stopPropagation(); toggleValue(k, s) }} className="text-sap-blue hover:text-sap-error ml-0.5 font-bold">×</button>
                  </span>
                ))}
                <button onClick={() => setFilters(f => ({...f,[k]:[]}))}
                  className="text-[10px] text-sap-error hover:underline self-center ml-auto">Clear all</button>
              </div>
            )}
            {/* Options list */}
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-[12px] text-sap-muted text-center">No results for "{query}"</div>
              ) : (
                filtered.map(opt => (
                  <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-sap-bg cursor-pointer text-[13px]">
                    <input type="checkbox" checked={selected.includes(opt)}
                      onChange={() => toggleValue(k, opt)}
                      className="accent-sap-blue flex-shrink-0" />
                    <span className="truncate">{opt}</span>
                  </label>
                ))
              )}
            </div>
            {/* Count */}
            <div className="px-3 py-1.5 border-t border-sap-border bg-[#fafbfc] flex-shrink-0">
              <span className="text-[10px] text-sap-subtle">
                {filtered.length} of {(options||[]).length} options
                {selected.length > 0 && ` · ${selected.length} selected`}
              </span>
            </div>
          </div>
        )}
        {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      </div>
    )
  }

  return (
    <div className="p-6">

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold text-sap-text">Opportunity List</h2>
        <div className="flex items-center gap-2">
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition text-sap-muted">
            <X size={12} /> Clean Filters
          </button>
        </div>
      </div>
      <hr className="border-sap-border mb-4" />

      {/* Filters */}
      <PipelineFilterBar filters={filters} opts={opts} toggle={toggle} set={setFilter} clear={clearFilters} />

      {/* KPIs */}
      <SectionLabel>Pipeline Summary</SectionLabel>
      <div className="grid grid-cols-6 gap-3 mb-3">
        <KpiCard label="ACV Booked"    value={formatAcvK(Number(kpis.acv_booked   ||0)*fxRate,currency)} color="green"  sub={`${Number(kpis.n_booked   ||0).toLocaleString()} opps`} />
        <KpiCard label="ACV Committed" value={formatAcvK(Number(kpis.acv_committed||0)*fxRate,currency)}                sub={`${Number(kpis.n_committed||0).toLocaleString()} opps`} />
        <KpiCard label="ACV Probable"  value={formatAcvK(Number(kpis.acv_probable ||0)*fxRate,currency)} color="orange" sub={`${Number(kpis.n_probable ||0).toLocaleString()} opps`} />
        <KpiCard label="ACV Upside"    value={formatAcvK(Number(kpis.acv_upside   ||0)*fxRate,currency)}                sub={`${Number(kpis.n_upside   ||0).toLocaleString()} opps`} />
        <KpiCard label="ACV Excluded"  value={formatAcvK(Number(kpis.acv_excluded ||0)*fxRate,currency)} color="red"   sub={`${Number(kpis.n_excluded ||0).toLocaleString()} opps`} />
        <KpiCard label="ACV Disc/Lost" value={formatAcvK(Number(kpis.acv_lost     ||0)*fxRate,currency)} color="grey"  sub={`${Number(kpis.n_lost     ||0).toLocaleString()} opps`} />
      </div>
      <SectionLabel>Summary</SectionLabel>
      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard label="# Opportunities"    value={filteredByBag.length.toLocaleString()} />
        <KpiCard label={acvLabel}           value={formatAcvK(acvTot, currency)} />
        <KpiCard label="# Presales Active"  value={rows.filter(r=>r.presales_status).length.toLocaleString()} color="green" />
        <KpiCard label="# Scored"           value={nScored.toLocaleString()} />
        <KpiCard label="Avg Qual Score"     value={avgScore} />
      </div>

      {/* ── Bag type filter ── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Deal Type:</span>
        {([
          { k: 'all',    label: 'All',              bg: '', active: 'bg-sap-blue text-white border-sap-blue' },
          { k: 'single', label: '🎯 Single Bag',    bg: '#E3F2FD', active: 'bg-[#1565C0] text-white border-[#1565C0]' },
          { k: 'basket', label: '🧺 Basket Deal',   bg: '#EDE7F6', active: 'bg-[#5E35B1] text-white border-[#5E35B1]' },
        ] as const).map(opt => (
          <button
            key={opt.k}
            onClick={() => setBagFilter(opt.k)}
            className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition ${
              bagFilter === opt.k
                ? opt.active
                : 'border-sap-border text-sap-muted hover:bg-sap-bg'
            }`}
          >
            {opt.label}
            {opt.k !== 'all' && (
              <span className="text-[10px] font-normal opacity-80">
                ({rows.filter(r => {
                  const b = getLobBadge(r)
                  return opt.k === 'single' ? b?.label.includes('Single') : b?.label.includes('Basket')
                }).length})
              </span>
            )}
          </button>
        ))}
        {bagFilter !== 'all' && (
          <button onClick={() => setBagFilter('all')} className="text-[11px] text-sap-blue hover:underline ml-1">
            Clear
          </button>
        )}
      </div>

      {/* ── SDE filter ── */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">SDE:</span>
        {([
          { k: 'all',              label: 'All' },
          { k: 'with_sde',        label: '👤 With SDE',         color: '#0D47A1', bg: '#E3F2FD' },
          { k: 'handover_done',   label: '✅ Handover Done',    color: '#1B5E20', bg: '#E8F5E9' },
          { k: 'handover_pending',label: '⏳ Handover Pending', color: '#7A5800', bg: '#FFF8E1' },
          { k: 'no_sde',          label: '⬜ No SDE',           color: '#616161', bg: '#F5F5F5' },
        ] as const).map(opt => {
          const isActive = sdeFilter === opt.k
          const count = opt.k === 'all' ? null : rows.filter((r:any) => {
            const hasSde = !!r.sde_primary_engagement_name
            const hasH   = !!(r.sde_handover_date || r.sde_handover_name)
            if (opt.k === 'with_sde') return hasSde
            if (opt.k === 'handover_done') return hasSde && hasH
            if (opt.k === 'handover_pending') return hasSde && !hasH
            if (opt.k === 'no_sde') return !hasSde
            return true
          }).length
          return (
            <button key={opt.k} onClick={() => setSdeFilter(opt.k)}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition"
              style={isActive && opt.k !== 'all'
                ? { background: (opt as any).bg, color: (opt as any).color, borderColor: (opt as any).color }
                : isActive
                  ? { background: '#0070F2', color: '#fff', borderColor: '#0070F2' }
                  : { background: '#fff', color: '#888', borderColor: '#E1E2E6' }
              }>
              {opt.label}
              {count !== null && <span className="text-[10px] font-normal opacity-80">({count})</span>}
            </button>
          )
        })}
        {sdeFilter !== 'all' && (
          <button onClick={() => setSdeFilter('all')} className="text-[11px] text-sap-blue hover:underline ml-1">Clear</button>
        )}
      </div>

      {/* ── Engagement Type Charts — collapsible ── */}
      <div className="card mb-5 overflow-hidden">
        <button
          onClick={() => setChartsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-sap-bg transition select-none"
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-sap-blue" />
            <span className="text-[12px] font-semibold text-sap-muted uppercase tracking-wide">
              Engagement Type Analysis
            </span>
            {engagementData.length > 0 && (
              <span className="text-[11px] text-sap-muted">— {rows.length.toLocaleString()} opps</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sap-muted text-[11px]">
            {chartsOpen ? <><ChevronUp size={14}/> Hide</> : <><ChevronDown size={14}/> Show</>}
          </div>
        </button>
        {chartsOpen && (
          <div className="border-t border-sap-border px-4 pb-4 pt-2 grid grid-cols-2 gap-4">
            <EChart
              height={260}
              option={{
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { left: 16, right: 16, top: 32, bottom: 16, containLabel: true },
                title: { text: '# Opportunities by Engagement Type', textStyle: { fontSize: 12, fontWeight: 600, color: '#32363A' } },
                xAxis: { type: 'category', data: engagementData.map(d => d.label), axisLabel: { fontSize: 11, rotate: engagementData.length > 4 ? 20 : 0 } },
                yAxis: { type: 'value', name: '# Opps', nameTextStyle: { fontSize: 10 } },
                series: [{
                  type: 'bar',
                  data: engagementData.map(d => d.n),
                  itemStyle: { color: '#0070B8', borderRadius: [4, 4, 0, 0] },
                  label: { show: true, position: 'top', fontSize: 11, fontWeight: 600, formatter: '{c}' },
                }],
              }}
            />
            <EChart
              height={260}
              option={{
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}<br/>${p[0].marker} ACV K: <b>${p[0].value.toLocaleString()}</b>` },
                grid: { left: 16, right: 16, top: 32, bottom: 16, containLabel: true },
                title: { text: `ACV K (${currency}) by Engagement Type`, textStyle: { fontSize: 12, fontWeight: 600, color: '#32363A' } },
                xAxis: { type: 'category', data: engagementData.map(d => d.label), axisLabel: { fontSize: 11, rotate: engagementData.length > 4 ? 20 : 0 } },
                yAxis: { type: 'value', name: `K (${currency})`, nameTextStyle: { fontSize: 10 } },
                series: [{
                  type: 'bar',
                  data: engagementData.map(d => d.acv),
                  itemStyle: { color: '#256f3a', borderRadius: [4, 4, 0, 0] },
                  label: { show: true, position: 'top', fontSize: 11, fontWeight: 600, formatter: (p) => p.value >= 1000 ? `${(p.value/1000).toFixed(1)}M` : `${p.value}K` },
                }],
              }}
            />
          </div>
        )}
      </div>

      {/* ── Building Block — pipeline breakdown by DRM category ── */}
      <div>
        <SectionLabel>Pipeline Building Block — by DRM Category</SectionLabel>
        <BuildingBlockChart
          rows={filteredByBag}
          groupBy="drm_category"
          solL1s={filters.sol_l1s}
          currency={currency}
          fx={fxRate}
          title={`Pipeline Building Block (${currency})`}
        />
      </div>

      {/* ── Table + Detail side-by-side ── */}
      <div className={`flex gap-4 items-start ${selected ? '' : ''}`}>
        {/* Table — shrinks more when panel is open to give panel more space */}
        <div className={`flex-1 min-w-0 transition-all duration-200 ${selected ? 'max-w-[35%]' : 'w-full'}`}>
          {/* Table header — with action buttons and column toggle */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <SectionLabel>Opportunities</SectionLabel>
              <p className="text-xs text-sap-subtle">{filteredByBag.length.toLocaleString()} opportunities — click a row to view details</p>
            </div>
            <div className="flex items-center gap-2">
              {/* AE Reminder — visible when opps are selected */}
              {selectedOppIds.size > 0 && (
                <>
                  <button onClick={() => setReminderOpen(o => !o)}
                    className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition border ${
                      reminderOpen ? 'bg-[#256f3a] text-white border-[#256f3a]' : 'border-[#256f3a] text-[#256f3a] hover:bg-[#e8f5e9]'
                    }`}>
                    📧 AE Reminder
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${reminderOpen ? 'bg-white text-[#256f3a]' : 'bg-[#256f3a] text-white'}`}>
                      {selectedOppIds.size}
                    </span>
                  </button>
                  <button onClick={clearOppSelection}
                    className="text-[11px] text-sap-muted hover:text-sap-error transition">
                    ✕ Clear
                  </button>
                </>
              )}
              {/* Pipeline Review Email */}
              <button
                onClick={() => { setReviewEmailOpen(o => !o); if (!selReviewOpps.length) setSelReviewOpps(editedOpps.map(o=>o.opportunity_id)) }}
                className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition ${
                  reviewEmailOpen ? 'bg-sap-blue text-white border border-sap-blue' : 'border border-sap-blue text-sap-blue hover:bg-sap-blue-l'
                }`}>
                ✉ Pipeline Review Email
                {editedOpps.length > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${reviewEmailOpen ? 'bg-white text-sap-blue' : 'bg-sap-blue text-white'}`}>
                    {editedOpps.length}
                  </span>
                )}
              </button>
              {/* Column visibility toggle */}
              <div className="relative">
              <button
                onClick={() => setColPanelOpen(o => !o)}
                className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
                  colPanelOpen ? 'bg-sap-blue text-white border-sap-blue' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                Columns
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colPanelOpen ? 'bg-white text-sap-blue' : 'bg-sap-blue text-white'}`}>
                  {visibleCols.size}
                </span>
              </button>
          {colPanelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setColPanelOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-sap-border rounded-xl shadow-lg w-72 overflow-hidden">
                <div className="px-3 py-2 border-b border-sap-border bg-[#fafbfc] flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Show / Hide Columns</span>
                  <div className="flex gap-2">
                    <button onClick={() => setVisibleCols(new Set(ALL_COL_DEFS.map(c => c.key)))}
                      className="text-[10px] text-sap-blue hover:underline">All</button>
                    <button onClick={() => setVisibleCols(new Set(BASE_COL_KEYS))}
                      className="text-[10px] text-sap-muted hover:underline">Reset</button>
                  </div>
                </div>
                {/* LoB columns section */}
                <div className="px-3 pt-2 pb-1 border-b border-sap-border">
                  <div className="text-[10px] font-semibold text-sap-blue uppercase tracking-wide mb-1.5">ACV by Solution L1</div>
                  <div className="grid grid-cols-2 gap-1">
                    {LOB_COLS.map(l => (
                      <label key={l.field} className="flex items-center gap-1.5 cursor-pointer text-[12px] py-0.5 hover:text-sap-blue">
                        <input type="checkbox" checked={visibleCols.has(l.field)}
                          onChange={() => toggleCol(l.field)}
                          className="accent-sap-blue flex-shrink-0 w-3 h-3" />
                        <span className="truncate">{l.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Other columns section */}
                <div className="px-3 pt-2 pb-2 max-h-64 overflow-y-auto">
                  <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Other Columns</div>
                  <div className="grid grid-cols-2 gap-1">
                    {ALL_COL_DEFS.filter(c => !LOB_COLS.some(l => l.field === c.key) && c.key !== 'oppId' && c.key !== 'account_name').map(({ key, def }) => (
                      <label key={key} className="flex items-center gap-1.5 cursor-pointer text-[12px] py-0.5 hover:text-sap-blue">
                        <input type="checkbox" checked={visibleCols.has(key)}
                          onChange={() => toggleCol(key)}
                          className="accent-sap-blue flex-shrink-0 w-3 h-3" />
                        <span className="truncate">{(def as any).headerName || key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
            </div>{/* end buttons */}
          </div>{/* end table header flex */}

      {/* Selection info bar */}
      {selectedOppIds.size > 0 && (
        <div className="flex items-center gap-3 mb-2 px-1">
          <span className="text-[12px] font-semibold text-sap-blue">
            {selectedOppIds.size} opportunit{selectedOppIds.size === 1 ? 'y' : 'ies'} selected for AE Reminder
          </span>
          <button onClick={clearOppSelection} className="text-[11px] text-sap-error hover:underline">✕ Clear</button>
        </div>
      )}

      {isLoading
        ? <div className="text-sap-muted text-sm py-12 text-center">Loading…</div>
        : <DataTable
            rows={filteredByBag}
            cols={cols}
            height={selected ? 560 : 560}
            onRowClick={handleSelectOpp}
            checkboxCol={true}
            onSelectionChanged={(selectedRows) => {
              setSelectedOppIds(new Set(selectedRows.map((r: any) => r.opportunity_id)))
            }}
          />
      }
        </div>{/* end table col */}

        {/* ── DETAIL PANEL — right column ── */}
        {selected && (
          <div className="w-[65%] flex-shrink-0 sticky top-4">
            <OppDetailPanel
              opp={selected}
              noteForm={noteForm}
              setNoteForm={setNoteForm}
              saveMut={saveMut}
              onClose={() => setSelected(null)}
              currency={currency}
              fx={fx}
              QUAL={QUAL}
              PS={PS}
              onSessionsChange={(opp_id, sessions) => setOppSessions(prev => ({...prev, [opp_id]: sessions}))}
            />
          </div>
        )}
      </div>{/* end flex row */}

      {/* ── AE REMINDER PANEL ── */}
      {reminderOpen && selectedOppIds.size > 0 && (
        <div className="card p-5 mb-4 border-[#256f3a] border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-semibold text-sap-text">📧 AE Reminder Email</div>
              <div className="text-[11px] text-sap-muted mt-0.5">{selectedOppIds.size} opportunit{selectedOppIds.size === 1 ? 'y' : 'ies'} selected</div>
            </div>
            <button onClick={() => setReminderOpen(false)} className="text-sap-muted text-xs hover:text-sap-text">✕ Close</button>
          </div>

          {/* Selected opps summary */}
          <div className="mb-4 rounded-xl border border-sap-border overflow-hidden">
            <div className="px-3 py-2 bg-[#fafbfc] border-b border-sap-border text-[10px] font-semibold text-sap-muted uppercase tracking-wide flex items-center justify-between">
              Selected Opportunities
              <button onClick={clearOppSelection} className="text-[10px] text-sap-error hover:underline normal-case">Clear all</button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredByBag.filter(r => selectedOppIds.has(r.opportunity_id)).map((r: any) => (
                <div key={r.opportunity_id} className="flex items-center gap-3 px-3 py-2 border-b border-sap-border last:border-0 text-[12px]">
                  <button onClick={() => toggleOppSelect(r.opportunity_id)} className="text-sap-error hover:opacity-70 flex-shrink-0">✕</button>
                  <span className="font-mono text-[11px] text-sap-muted flex-shrink-0">{r.opportunity_id}</span>
                  <span className="font-semibold flex-shrink-0">{r.account_name}</span>
                  <span className="text-sap-muted flex-1 truncate">{r.opp_description}</span>
                  <span className="text-sap-muted flex-shrink-0">{r.opp_owner_name}</span>
                  <span className="text-sap-muted flex-shrink-0">{r.closing_qtr}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AE email */}
          <div className="mb-3">
            <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1.5">AE Email (To) — optional, you can add in Outlook</label>
            <input type="email" value={reminderAeEmail} onChange={e => setReminderAeEmail(e.target.value)}
              placeholder="ae@sap.com"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue transition" />
          </div>

          {/* Note */}
          <div className="mb-4">
            <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1.5">Additional Note (optional)</label>
            <textarea value={reminderNote} onChange={e => setReminderNote(e.target.value)}
              rows={2} placeholder="e.g. I'd like to discuss these opportunities in our next sync…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue resize-none transition" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => reminderMut.mutate({
                opp_ids: Array.from(selectedOppIds),
                note: reminderNote,
                ae_email: reminderAeEmail,
              })}
              disabled={selectedOppIds.size === 0 || reminderMut.isPending}
              className="flex-1 bg-[#256f3a] hover:bg-[#1e5a2f] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 text-[13px]">
              {reminderMut.isPending ? 'Creating draft…' : `📧 Create Draft in Outlook (${selectedOppIds.size} opp${selectedOppIds.size !== 1 ? 's' : ''})`}
            </button>
            <button onClick={() => setReminderOpen(false)}
              className="px-5 border border-sap-border rounded-lg text-sm font-semibold text-sap-muted hover:bg-sap-bg transition">
              Cancel
            </button>
          </div>
          {reminderMut.isSuccess && <p className="text-[#256f3a] text-sm text-center mt-2">✓ Draft created — check your Outlook Drafts folder</p>}
          {reminderMut.isError && <p className="text-sap-error text-sm text-center mt-2">⚠ Failed — check Outlook connection</p>}
        </div>
      )}

      {reviewEmailOpen && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-semibold text-sap-text">✉ Pipeline Review Email</div>
            <button onClick={() => setReviewEmailOpen(false)} className="text-sap-muted text-xs hover:text-sap-text">✕ Close</button>
          </div>
          <div className="mb-3 p-3 bg-[#e8f0fe] rounded-xl text-[12px] text-sap-blue">
            📬 A draft will be created in your Outlook <strong>Drafts</strong> folder — open it there to add recipients and send.
          </div>

          {editedOpps.length === 0 ? (
            <div className="p-4 bg-sap-bg rounded-xl text-sm text-sap-muted text-center mb-4">
              No edited opportunities yet — open an opportunity, fill in the presales fields and click Save.
            </div>
          ) : (
            <div className="mb-4">
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-2">
                Select opportunities to include ({selReviewOpps.length} of {editedOpps.length})
              </label>
              <div className="rounded-xl border border-sap-border overflow-hidden">
                {editedOpps.map(o => (
                  <label key={o.opportunity_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sap-bg cursor-pointer border-b border-sap-border last:border-0">
                    <input type="checkbox" checked={selReviewOpps.includes(o.opportunity_id)}
                      onChange={() => toggleReviewOpp(o.opportunity_id)}
                      className="accent-sap-blue flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-[13px]">
                      <span className="font-medium">{o.account_name}</span>
                      <span className="text-sap-muted ml-2 font-mono text-[11px]">{o.opportunity_id}</span>
                      <span className="text-sap-muted ml-2">{o.closing_qtr}</span>
                    </div>
                    <span className="text-sap-muted text-[12px] flex-shrink-0">{o.opp_owner_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1.5">Additional Notes (optional)</label>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              rows={2} placeholder="Any general notes for the AE…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue resize-none transition" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                  // Collect unique sessions across all selected opps
                  const allSessions = []
                  const seenIds = new Set()
                  selReviewOpps.forEach(opp_id => {
                    (oppSessions[opp_id] || []).forEach(s => {
                      if (!seenIds.has(s.id)) { seenIds.add(s.id); allSessions.push(s) }
                    })
                  })
                  reviewEmailMut.mutate({ opp_ids: selReviewOpps, extra_note: reviewNote, spark_sessions: allSessions })
                }}
              disabled={selReviewOpps.length === 0 || reviewEmailMut.isPending}
              className="flex-1 bg-sap-blue hover:bg-sap-blue-d text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60">
              {reviewEmailMut.isPending ? 'Creating draft…' : `📬 Create Draft in Outlook (${selReviewOpps.length} opp${selReviewOpps.length !== 1 ? 's' : ''})`}
            </button>
            <button onClick={() => setReviewEmailOpen(false)}
              className="px-5 border border-sap-border rounded-lg text-sm font-semibold text-sap-muted hover:bg-sap-bg transition">
              Cancel
            </button>
          </div>
          {reviewEmailMut.isSuccess && <p className="text-sap-success text-sm text-center mt-2">✓ Draft created — check your Outlook Drafts folder</p>}
          {reviewEmailMut.isError && <p className="text-sap-error text-sm text-center mt-2">⚠ Failed — check Outlook connection</p>}
        </div>
      )}
    </div>
  )
}
