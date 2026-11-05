// @ts-nocheck
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { PipelineFilterBar } from '../components/PipelineFilterBar'
import { MultiSelect } from '../components/MultiSelect'
import { DataTable } from '../components/DataTable'
import { usePipelineFilters } from '../lib/usePipelineFilters'
import { EChart } from '../components/EChart'
import { PptxExportButton } from '../components/PptxExportButton'
import { ColVisibilityPanel } from '../components/PipelineTableExtras'
import { useColVisibility, buildLobAcvCols, engagementCellStyle, LOB_COL_DEFS } from '../lib/pipelineTableHelpers'
import { useAuth } from '../context/AuthContext'
import { formatAcvK, acvCol } from '../lib/utils'
import { exportToExcel } from '../lib/exportExcel'
import { presalesStatusCol, qualDecisionCol } from '../lib/presalesHelpers'
import { ExcelDownloadButton } from '../components/ExcelDownloadButton'
import type { ColDef } from 'ag-grid-community'
import type { EChartsOption } from 'echarts'
import { Download } from 'lucide-react'
import { oppIdCol } from '../components/OppIdCol'
import { OppDetailPanel, BLANK_NOTE_FORM } from '../components/OppDetailPanel'

const FC_COLORS: Record<string,string> = {
  'Committed':'#0070f2','Probable':'#4cb1ff','Upside':'#c4d9f0',
  'Partner Upside':'#eaecee','Partner Forecasted':'#d9dbdd',
  'Booked/Won':'#256f3a','Disc/Lost':'#aa0808','Excluded from Pipeline':'#eaecee',
}

type Row = Record<string, unknown>
type ChartRow = { label: string; n_opps: number; acv: number }

function fmtM(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

const AXIS_LABEL_M = { fontSize: 10, color: '#788fa6', formatter: (v: number) => fmtM(v) }
const SPLIT_LINE   = { lineStyle: { color: '#f0f1f2', type: 'dashed' as const } }

function barOpt(title: string, xData: string[], current: number[], prev: number[]): EChartsOption {
  return {
    title: { text: title, textStyle: { fontSize: 13, fontWeight: 600, color: '#32363A' }, top: 8, left: 12 },
    legend: { data: ['Current Week', 'Prior Week'], bottom: 0, textStyle: { fontSize: 11, color: '#556b82' } },
    grid: { top: 48, bottom: 36, left: 16, right: 16, containLabel: true },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p: any) => `<b>${p[0]?.axisValue}</b><br/>${p.map((s: any) => `${s.marker}${s.seriesName}: <b>${fmtM(s.value)}</b>`).join('<br/>')}`,
    },
    xAxis: { type: 'category', data: xData, axisLabel: { fontSize: 11, color: '#32363A', fontWeight: 600 }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e1e2e6' } } },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL_M, splitLine: SPLIT_LINE },
    series: [
      { name: 'Prior Week',   type: 'bar', data: prev,    itemStyle: { color: '#c8d8f0', borderRadius: [3,3,0,0] },
        label: { show: true, position: 'top', fontSize: 10, fontWeight: 600, color: '#556b82', formatter: (p: any) => Math.abs(p.value||0) > 0 ? fmtM(p.value) : '' } },
      { name: 'Current Week', type: 'bar', data: current, itemStyle: { color: '#0070f2', borderRadius: [3,3,0,0] },
        label: { show: true, position: 'top', fontSize: 10, fontWeight: 700, color: '#0070f2', formatter: (p: any) => Math.abs(p.value||0) > 0 ? fmtM(p.value) : '' } },
    ],
  }
}

function hbarOpt(title: string, labels: string[], values: number[], color = '#0070f2'): EChartsOption {
  return {
    title: { text: title, textStyle: { fontSize: 13, fontWeight: 600, color: '#32363A' }, top: 8, left: 12 },
    grid: { left: 16, right: 70, top: 40, bottom: 16, containLabel: true },
    tooltip: { trigger: 'axis', formatter: (p: any) => `<b>${p[0]?.axisValue}</b>: <b>${fmtM(p[0]?.value)}</b>` },
    xAxis: { type: 'value', axisLabel: AXIS_LABEL_M, splitLine: SPLIT_LINE },
    yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11, color: '#32363A' } },
    series: [{ type: 'bar', data: values, itemStyle: { color, borderRadius: [0,3,3,0] },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700, color: '#32363A', formatter: (p: any) => fmtM(p.value) } }],
  }
}

function chartTopN(data: ChartRow[], valueKey: 'acv'|'n_opps', top = 12, asc = true) {
  const sorted = [...data].sort((a, b) => a[valueKey] - b[valueKey])
  const slice = asc ? sorted.slice(-top) : sorted.slice(0, top)
  return {
    labels: slice.map(r => r.label ?? '—'),
    values: slice.map(r => r[valueKey]),
  }
}


// ── Collapsible chart section ─────────────────────────────────────────────────
function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(() => {
    try { const v = localStorage.getItem(`adrm_sec_${title}`); return v === null ? defaultOpen : v === 'true' } catch { return defaultOpen }
  })
  const toggle = () => setOpen(o => {
    const next = !o
    try { localStorage.setItem(`adrm_sec_${title}`, String(next)) } catch {}
    return next
  })
  return (
    <div className="mb-4">
      <button onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2 bg-white rounded-xl border border-sap-border hover:bg-sap-bg transition mb-2">
        <span className="text-[12px] font-bold text-sap-text uppercase tracking-wide">{title}</span>
        <span className="text-[11px] text-sap-muted font-medium">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {open && children}
    </div>
  )
}

export function ADRMPipelinePage() {
  const { currency, fxRate } = useAuth()
  const fx = fxRate

  const { filters, params, debouncedParams, toggle, set: setFilter, clear: clearFilters } = usePipelineFilters()
  const [excludeNeg, setExcludeNeg] = useState(false)
  const [includePurchase, setIncludePurchase] = useState(false)
  const [ddaStatusFilter, setDdaStatusFilter] = useState<string[]>([])
  const [rangeAgingFilter, setRangeAgingFilter] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'pipeline' | 'booked'>('pipeline')
  const [bookedView, setBookedView] = useState<'all' | 'new'>('new')
  const [selectedOpp, setSelectedOpp] = useState<any>(null)
  const [noteForm, setNoteForm] = useState(BLANK_NOTE_FORM)
  const qc = useQueryClient()

  const { data: opts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => api.get('/api/pipeline/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: ddaOpts = { dda_statuses: [], range_agings: [] } } = useQuery({
    queryKey: ['dda-filters'],
    queryFn: () => api.get('/api/pipeline/dda-filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const debouncedKpiParams = {
    ...debouncedParams,
    ...(excludeNeg ? { exclude_neg: true } : {}),
    ...(includePurchase ? { include_purchase: true } : {}),
    ...(ddaStatusFilter.length ? { dda_statuses: ddaStatusFilter } : {}),
    ...(rangeAgingFilter.length ? { range_agings: rangeAgingFilter } : {}),
  }

  // Table rows — still limited to 20k for display
  const { data: rows = [] as Row[], isLoading } = useQuery({
    queryKey: ['pipeline', debouncedKpiParams],
    queryFn: () => api.get('/api/pipeline', { params: { ...debouncedKpiParams, deduplicate: true, limit: 20000 } }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  // Server-side KPIs — complete, no row limit
  const { data: kpis = {} } = useQuery({
    queryKey: ['pipeline-kpis', debouncedKpiParams],
    queryFn: () => api.get('/api/pipeline/kpis', { params: debouncedKpiParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  // Server-side chart aggregations — complete, no row limit
  const { data: charts = {} } = useQuery({
    queryKey: ['pipeline-charts', debouncedKpiParams],
    queryFn: () => api.get('/api/pipeline/charts', { params: debouncedKpiParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  // DDA charts — only fetched when DDA table has data or filters are active
  const ddaChartsParams = {
    ...debouncedKpiParams,
    ...(ddaStatusFilter.length ? { dda_statuses: ddaStatusFilter } : {}),
    ...(rangeAgingFilter.length ? { range_agings: rangeAgingFilter } : {}),
  }
  const { data: ddaCharts = { by_dda_status: [], by_range_aging: [] } } = useQuery({
    queryKey: ['dda-charts', ddaChartsParams],
    queryFn: () => api.get('/api/pipeline/dda-charts', { params: ddaChartsParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: prevRows = [] as Row[] } = useQuery({
    queryKey: ['pipeline-prev', debouncedParams],
    queryFn: () => api.get('/api/pipeline/prev', { params: debouncedParams }).then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // New wins since last snapshot
  const newBookingsParams = {
    ...(debouncedParams.closing_qtrs  ? { closing_qtrs:     debouncedParams.closing_qtrs }     : {}),
    ...(debouncedParams.regions       ? { regions:          debouncedParams.regions }           : {}),
    ...(debouncedParams.sol_l1s       ? { sol_l1s:          debouncedParams.sol_l1s }           : {}),
    // usePipelineFilters emits single-value `engagement_type` / `digital_sa`;
    // /new-bookings only accepts the list forms, so map them here.
    ...(debouncedParams.engagement_type ? { engagement_types: [debouncedParams.engagement_type] } : {}),
    ...(debouncedParams.digital_sa    ? { digital_sas:      [debouncedParams.digital_sa] }      : {}),
  }
  const { data: newBookings = [] as Row[] } = useQuery({
    queryKey: ['pipeline-new-bookings', newBookingsParams],
    queryFn: () => api.get('/api/pipeline/new-bookings', { params: newBookingsParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const handleSelectOpp = (row: any) => {
    setSelectedOpp(row)
    setNoteForm(BLANK_NOTE_FORM)
  }

  useQuery({
    queryKey: ['notes', selectedOpp?.opportunity_id],
    queryFn: () => api.get(`/api/notes/${selectedOpp.opportunity_id}`).then(r => r.data),
    enabled: !!selectedOpp?.opportunity_id,
    onSuccess: (d: any) => {
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
    mutationFn: (data: any) => api.put(`/api/notes/${selectedOpp.opportunity_id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', selectedOpp?.opportunity_id] })
      qc.invalidateQueries({ queryKey: ['notes-history', selectedOpp?.opportunity_id] })
    },
  })

  const [sdeFilter, setSdeFilter] = useState<string>('all')

  const filteredRows = useMemo(() => {
    let r = excludeNeg ? rows.filter(r => (Number(r.acv_total_opp) || 0) > 0) : rows
    if (sdeFilter !== 'all') {
      r = r.filter((row:any) => {
        const hasSde = !!row.sde_primary_engagement_name
        const hasH   = !!(row.sde_handover_date || row.sde_handover_name)
        if (sdeFilter === 'with_sde')         return hasSde
        if (sdeFilter === 'handover_done')    return hasSde && hasH
        if (sdeFilter === 'handover_pending') return hasSde && !hasH
        if (sdeFilter === 'no_sde')           return !hasSde
        return true
      })
    }
    return r
  }, [rows, excludeNeg, sdeFilter])

  // KPI values from server
  const nBooked    = Number(kpis.n_booked    || 0)
  const nCommit    = Number(kpis.n_committed  || 0)
  const nProbable  = Number(kpis.n_probable   || 0)
  const nUpside    = Number(kpis.n_upside     || 0)
  const nExcluded  = Number(kpis.n_excluded   || 0)
  const nLost      = Number(kpis.n_lost       || 0)
  const acvBooked  = Number(kpis.acv_booked   || 0) * fx
  const acvCommit  = Number(kpis.acv_committed|| 0) * fx
  const acvProb    = Number(kpis.acv_probable  || 0) * fx
  const acvUpside  = Number(kpis.acv_upside   || 0) * fx
  const acvExcl    = Number(kpis.acv_excluded || 0) * fx
  const acvLost    = Number(kpis.acv_lost     || 0) * fx

  // Prior week aggregation by field — returns both acv and n_opps per label
  function prevMapBy(field: string): Record<string, { acv: number; n: number }> {
    return prevRows.reduce((acc, r) => {
      const k = String(r[field] ?? '—')
      if (!acc[k]) acc[k] = { acv: 0, n: 0 }
      acc[k].acv += (Number(r.acv_usd) || 0) * fx
      acc[k].n   += 1
      return acc
    }, {} as Record<string, { acv: number; n: number }>)
  }

  // Build current vs prior bar chart from server chart data
  function wowBar(chartData: ChartRow[], field: string, title: string, valueKey: 'acv'|'n_opps', top = 10) {
    if (!chartData?.length) return { title: { text: title }, series: [] }
    const prevMap = prevMapBy(field)
    const sorted = [...chartData].sort((a, b) => b[valueKey] - a[valueKey]).slice(0, top)
    const labels = sorted.map(r => r.label ?? '—')
    const curr = sorted.map(r => valueKey === 'acv' ? r.acv * fx : r.n_opps)
    const prev = labels.map(lbl =>
      valueKey === 'acv' ? (prevMap[lbl]?.acv ?? 0) : (prevMap[lbl]?.n ?? 0)
    )
    return barOpt(title, labels, curr, prev)
  }

  // Stacked bar: Quarter × FC from by_qtr_fc
  const qtrFcData: { label: string; category: string; acv: number }[] = charts.by_qtr_fc ?? []
  const qtrs = [...new Set(qtrFcData.map(r => r.label))].sort()
  const fcKeys = ['Committed','Probable','Upside','Partner Forecasted','Partner Upside']
  const qtrSeriesMap = Object.fromEntries(
    fcKeys.map(fc => [fc, qtrs.map(q => {
      const hit = qtrFcData.find(r => r.label === q && r.category === fc)
      return (hit?.acv ?? 0) * fx
    })])
  )

  const fmtM = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
    return String(Math.round(v))
  }

  const stackedOpt: EChartsOption = {
    title: {
      text: `ACV by Quarter + FC (${currency})`,
      textStyle: { fontSize: 13, fontWeight: 600, color: '#32363A' },
      top: 8, left: 12,
    },
    legend: {
      bottom: 0,
      itemWidth: 12, itemHeight: 12,
      textStyle: { fontSize: 11, color: '#556b82' },
    },
    grid: { top: 48, bottom: 44, left: 16, right: 16, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const qtr = params[0]?.axisValue ?? ''
        const total = params.reduce((s: number, p: any) => s + Math.max(p.value || 0, 0), 0)
        const lines = params
          .filter((p: any) => (p.value || 0) > 0)
          .map((p: any) => `${p.marker}${p.seriesName}: <b>${fmtM(p.value)}</b>`)
          .join('<br/>')
        return `<b>${qtr}</b><br/>${lines}<br/><span style="color:#556b82;font-size:11px">Total: <b>${fmtM(total)}</b></span>`
      },
    },
    xAxis: {
      type: 'category',
      data: qtrs,
      axisLabel: { fontSize: 11, fontWeight: 600, color: '#32363A' },
      axisLine: { lineStyle: { color: '#e1e2e6' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { fontSize: 10, color: '#788fa6', formatter: (v: number) => fmtM(v) },
      splitLine: { lineStyle: { color: '#f0f1f2', type: 'dashed' } },
    },
    series: fcKeys.map((fc, idx) => ({
      name: fc,
      type: 'bar',
      stack: 'total',
      // Clamp negative values to 0 so they don't pull the bar below zero
      data: qtrSeriesMap[fc].map((v: number) => Math.max(v, 0)),
      itemStyle: {
        color: FC_COLORS[fc] ?? '#788fa6',
        borderRadius: idx === fcKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0],
      },
      label: {
        show: true,
        position: 'inside',
        fontSize: 10,
        fontWeight: 700,
        color: ['Committed', 'Probable'].includes(fc) ? '#fff' : '#32363A',
        // Only show label if segment is large enough (≥ 10M) to avoid overlaps
        formatter: (p: any) => (p.value || 0) >= 10_000_000 ? fmtM(p.value) : '',
      },
    })),
  }

  // Age range chart
  const ageOrder = ['0-30d','31-60d','61-90d','91-180d','181-365d','>365d']
  const ageData: ChartRow[] = charts.by_age_range ?? []
  const ageMap = Object.fromEntries(ageData.map(r => [r.label, r.acv * fx]))

  // Table cols
  const cols: ColDef[] = [
    oppIdCol,
    { field: 'account_name',          headerName: 'Account',      flex: 1, minWidth: 150 },
    { field: 'opp_description', headerName: 'Description', flex: 1, minWidth: 160,
      valueGetter: (p: any) => {
        const d = p.data; if (!d) return p.data?.opp_description || ''
        const nonTF = ['acv_l1_baip_dai','acv_l1_btm','acv_l1_cloud_erp','acv_l1_cx','acv_l1_finance','acv_l1_hcm','acv_l1_scm','acv_l1_other']
        const active = nonTF.filter(f => Number(d[f]||0)>0).length
        const label = active > 1 ? '🧺 Basket  ' : (active===1 || Number(d.acv_l1_baip_tf||0)>0) ? '🎯 Single  ' : ''
        return label + (d.opp_description||'')
      },
      cellStyle: (p: any) => {
        const v = p.value || ''
        if (v.startsWith('🧺')) return { color: '#5E35B1', fontWeight: 600 }
        if (v.startsWith('🎯')) return { color: '#1565C0', fontWeight: 600 }
        return {}
      },
    },
    { field: 'closing_qtr',           headerName: 'Closing Qtr',  width: 110 },
    { field: 'drm_category',          headerName: 'DRM Cat',      width: 110 },
    { field: 'region_lvl3',           headerName: 'Region',       width: 130 },
    { field: 'solution_area_l1',      headerName: 'Solution L1',  width: 160 },
    { field: 'sub_solution_area_l2',  headerName: 'Sub-Solution', width: 160 },
    { ...presalesStatusCol(110) },
    { ...qualDecisionCol(120) },
    {
      field: 'sde_primary_engagement_name',
      headerName: 'SDE',
      width: 90,
      cellRenderer: (p: any): any => {
        const name = p.data?.sde_primary_engagement_name
        const handover = p.data?.sde_handover_date || p.data?.sde_handover_name
        if (!name) return null
        const color = handover ? '#1B5E20' : '#BB0000'
        const bg    = handover ? '#E8F5E9' : '#FFEBEE'
        return (
          <span title={handover ? `SDE: ${name} · Handover: ${handover}` : `SDE: ${name} · Pending handover`}
            style={{display:'inline-flex',alignItems:'center',gap:3,
              background:bg,color,fontWeight:700,fontSize:10,
              padding:'2px 6px',borderRadius:10,whiteSpace:'nowrap'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:color,display:'inline-block'}}/>
            SDE
          </span>
        )
      },
    },
    { field: 'deal_qualification_score',    headerName: 'Score',  width: 75 },
    { field: 'engagement_type',       headerName: 'Engagement',   width: 110, cellStyle: engagementCellStyle },
    acvCol('acv_total_opp', fx, currency, `ACV K (${currency})`, 140),
    { field: 'opp_owner_name',        headerName: 'Opp Owner',    width: 140 },
    { field: 'local_acct_owner',      headerName: 'Local Owner',  width: 140 },
    { field: 'fc_qualification',      headerName: 'FC',           width: 110 },
    { field: 'opp_phase',             headerName: 'Opp Phase',    width: 140 },
    { field: 'account_sales_group_text', headerName: 'Sales Group', width: 180 },
    { field: 'iss_group_text',        headerName: 'ISS Group',    width: 130 },
    { field: 'iac',                   headerName: 'IAC',          width: 130 },
    { field: 'vat_dh',                headerName: 'Digital SA',   width: 160 },
    { field: 'dda_status',            headerName: 'DDA Status',   width: 130 },
    { field: 'range_aging',           headerName: 'Range Aging',  width: 120 },
    { field: 'aging_up_today',        headerName: 'Aging (days)', width: 100 },
    ...buildLobAcvCols(fx, currency),
  ]

  const ALL_COL_KEYS = cols.map(c => (c as any).field === 'opportunity_id' ? 'oppId' : (c as any).field).filter(Boolean)
  const DEFAULT_KEYS = ALL_COL_KEYS.filter(k => !k.startsWith('acv_l1_'))

  const { visibleCols, panelOpen, setPanelOpen, toggleCol, showAll, resetCols } =
    useColVisibility(ALL_COL_KEYS, DEFAULT_KEYS)

  const visibleColDefs = cols.filter(c => {
    const k = (c as any).field === 'opportunity_id' ? 'oppId' : (c as any).field
    return visibleCols.has(k)
  })

  // Booked & A-Purchase tab — filter + dedicated columns with VAT focus
  const bookedRows = useMemo(() =>
    rows.filter(r =>
      r.drm_category === 'Booked/Won' ||
      r.opp_phase === 'A - Purchase'
    ),
    [rows]
  )

  const bookedCols: ColDef[] = [
    oppIdCol,
    { field: 'account_name',         headerName: 'Account',      flex: 1, minWidth: 160 },
    { field: 'opp_description',      headerName: 'Description',  flex: 1, minWidth: 180 },
    { field: 'drm_category',         headerName: 'DRM Cat',      width: 120,
      cellStyle: (p: any) => p.value === 'Booked/Won' ? { color: '#256f3a', fontWeight: 700 } : { color: '#E76500', fontWeight: 700 } },
    { field: 'opp_phase',            headerName: 'Opp Phase',    width: 140,
      cellStyle: (p: any) => p.value === 'A - Purchase' ? { color: '#E76500', fontWeight: 700 } : {} },
    { field: 'solution_area_l1',     headerName: 'Solution L1',  width: 170 },
    { field: 'sub_solution_area_l2', headerName: 'Sub-Solution', width: 170 },
    { field: 'closing_qtr',          headerName: 'Closing Qtr',  width: 110 },
    { field: 'region_lvl3',          headerName: 'Region',       width: 130 },
    acvCol('acv_usd', fx, currency, `ACV K (${currency})`, 140),
    acvCol('acv_total_opp', fx, currency, `ACV Total Opp (${currency})`, 160),
    { field: 'opp_owner_name',       headerName: 'Opp Owner',    width: 150 },
    { field: 'engagement_type',      headerName: 'Engagement',   width: 110 },
    { field: 'vat_dh',               headerName: 'VAT DH (Digital SA)', width: 200 },
    { field: 'vat_full',             headerName: 'VAT Full Team',        flex: 1, minWidth: 200 },
    { field: 'vat_size',             headerName: 'VAT Size',    width: 90 },
    { field: 'flsm',                 headerName: 'Sales Manager', width: 150 },
    { field: 'local_acct_owner',     headerName: 'Local Owner',  width: 150 },
    { field: 'account_sales_group_text', headerName: 'Sales Group', width: 180 },
    { field: 'fc_qualification',     headerName: 'FC',           width: 110 },
  ]

  const acvBookedTab  = bookedRows.filter(r => r.drm_category === 'Booked/Won').reduce((s, r) => s + (Number(r.acv_usd) || 0) * fx, 0)
  const acvPurchase   = bookedRows.filter(r => r.opp_phase === 'A - Purchase' && r.drm_category !== 'Booked/Won').reduce((s, r) => s + (Number(r.acv_usd) || 0) * fx, 0)
  const nBookedTab    = bookedRows.filter(r => r.drm_category === 'Booked/Won').length
  const nPurchase     = bookedRows.filter(r => r.opp_phase === 'A - Purchase' && r.drm_category !== 'Booked/Won').length

  // Columns for "New since last update" view — includes previous status
  const newBookingsCols: ColDef[] = [
    oppIdCol,
    { field: 'account_name',         headerName: 'Account',         flex: 1, minWidth: 160 },
    { field: 'opp_description',      headerName: 'Description',     flex: 1, minWidth: 180 },
    { field: 'drm_category',         headerName: 'Current DRM',     width: 130,
      cellStyle: (p: any) => p.value === 'Booked/Won' ? { color: '#256f3a', fontWeight: 700 } : { color: '#E76500', fontWeight: 700 } },
    { field: 'prev_drm_category',    headerName: 'Previous DRM',    width: 180,
      cellStyle: () => ({ color: '#788fa6', fontStyle: 'italic' }) },
    { field: 'opp_phase',            headerName: 'Current Phase',   width: 140,
      cellStyle: (p: any) => p.value === 'A - Purchase' ? { color: '#E76500', fontWeight: 700 } : {} },
    { field: 'solution_area_l1',     headerName: 'Solution L1',     width: 170 },
    { field: 'sub_solution_area_l2', headerName: 'Sub-Solution',    width: 160 },
    { field: 'closing_qtr',          headerName: 'Closing Qtr',     width: 110 },
    { field: 'region_lvl3',          headerName: 'Region',          width: 130 },
    acvCol('acv_usd', fx, currency, `ACV K (${currency})`, 140),
    acvCol('acv_total_opp', fx, currency, `ACV Total (${currency})`, 155),
    { field: 'opp_owner_name',       headerName: 'Opp Owner',       width: 150 },
    { field: 'engagement_type',      headerName: 'Engagement',      width: 110 },
    { field: 'vat_dh',               headerName: 'VAT DH',          width: 180 },
    { field: 'vat_full',             headerName: 'VAT Full Team',   flex: 1, minWidth: 200 },
    { field: 'vat_size',             headerName: 'VAT Size',        width: 90 },
    { field: 'flsm',                 headerName: 'Sales Manager',   width: 150 },
  ]


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-sap-text">ADRM Pipeline Review</h2>
        <PptxExportButton
          label="Export PPT"
          getPayload={() => ({
            page: 'adrm',
            title: 'ADRM Pipeline Review',
            subtitle: `Digital LAC — ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,
            filters: debouncedParams as any,
            currency,
            kpis: [
              { label: 'ACV Booked',    value: `$${(acvBooked/1e6).toFixed(1)}M`,  sub: `${nBooked} opps`,    color: 'green' },
              { label: 'ACV Committed', value: `$${(acvCommit/1e6).toFixed(1)}M`,  sub: `${nCommit} opps`,   color: 'blue'  },
              { label: 'ACV Probable',  value: `$${(acvProb/1e6).toFixed(1)}M`,    sub: `${nProbable} opps`, color: 'orange'},
              { label: 'ACV Upside',    value: `$${(acvUpside/1e6).toFixed(1)}M`,  sub: `${nUpside} opps`              },
              { label: 'ACV Excluded',  value: `$${(acvExcl/1e6).toFixed(1)}M`,    sub: `${nExcluded} opps`, color: 'red'  },
              { label: 'ACV Disc/Lost', value: `$${(acvLost/1e6).toFixed(1)}M`,    sub: `${nLost} opps`,     color: 'grey' },
            ],
            bar_charts: [
              { title: `ACV by Region (${currency})`,   data: (charts.by_region??[]).map((r:any)=>({label:r.label,value:r.acv*fxRate})) },
              { title: `# Opps by Segment`,             data: (charts.by_segment??[]).map((r:any)=>({label:r.label,value:r.n_opps})) },
              { title: `ACV by Solution L1 (${currency})`, data: (charts.by_sol_l1??[]).slice(0,8).map((r:any)=>({label:r.label,value:r.acv*fxRate})) },
              { title: `ACV by Quarter (${currency})`,  data: (charts.by_closing_qtr??[]).map((r:any)=>({label:r.label,value:r.acv*fxRate})) },
            ],
          })}
        />
      </div>
      <hr className="border-sap-border mb-4" />

      <PipelineFilterBar filters={filters} opts={opts} toggle={toggle} set={setFilter} clear={clearFilters} />

      {/* ── Tab bar ── */}
      <div className="flex border-b border-sap-border mb-4 gap-0">
        {([
          { key: 'pipeline', label: 'Pipeline Analysis' },
          { key: 'booked',   label: 'Booked & A-Purchase', count: bookedRows.length, newCount: newBookings.length },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold border-b-2 transition ${
              activeTab === t.key
                ? 'border-sap-blue text-sap-blue'
                : 'border-transparent text-sap-muted hover:text-sap-text'
            }`}>
            {t.label}
            {'count' in t && t.count > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-sap-bg text-sap-muted font-normal">{t.count}</span>
            )}
            {'newCount' in t && t.newCount > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[#d4edda] text-[#256f3a] font-bold">+{t.newCount} new</span>
            )}
          </button>
        ))}
      </div>

      {/* ── BOOKED & A-PURCHASE TAB ── */}
      {activeTab === 'booked' && (
        <div>
          {/* KPI summary */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <KpiCard label="Booked/Won"   value={formatAcvK(acvBookedTab, currency)} color="green" sub={`${nBookedTab.toLocaleString()} opps`} />
            <KpiCard label="A-Purchase"   value={formatAcvK(acvPurchase, currency)}  color="orange" sub={`${nPurchase.toLocaleString()} opps`} />
            <KpiCard label="New this update" value={String(newBookings.length)}
              color="green"
              sub={`${formatAcvK(newBookings.reduce((s,r)=>s+(Number(r.acv_usd)||0)*fx,0),currency)} ACV`} />
            <div className="card p-3 flex flex-col justify-center">
              <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1">vs previous snapshot</div>
              <div className="text-[11px] text-sap-text">{newBookings.length > 0 ? `${newBookings.length} new closings detected` : 'No new closings'}</div>
            </div>
          </div>

          {/* Sub-toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1 bg-sap-bg rounded-lg p-1">
              {([
                { k: 'new', label: `🆕 New since last update (${newBookings.length})` },
                { k: 'all', label: `All Booked & A-Purchase (${bookedRows.length})` },
              ] as const).map(v => (
                <button key={v.k} onClick={() => setBookedView(v.k)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition ${
                    bookedView === v.k ? 'bg-white text-sap-blue shadow-sm' : 'text-sap-muted hover:text-sap-text'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>
            <ExcelDownloadButton
              rows={bookedView === 'new' ? newBookings : bookedRows}
              cols={bookedView === 'new' ? newBookingsCols : bookedCols}
              defaultFilename={bookedView === 'new' ? 'new_bookings.xlsx' : 'booked_purchase.xlsx'}
              sheetName={bookedView === 'new' ? 'New Bookings' : 'Booked & A-Purchase'}
              className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
            />
          </div>

          {bookedView === 'new' && newBookings.length > 0 && (
            <div className="mb-3 p-3 bg-[#d4edda] border border-[#a5d6a7] rounded-lg text-[12px] text-[#256f3a] font-medium">
              🎉 {newBookings.length} opportunit{newBookings.length === 1 ? 'y' : 'ies'} closed since the last data update — showing previous DRM/Phase status for context.
            </div>
          )}

          {isLoading
            ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
            : <div className={selectedOpp ? 'flex gap-4 items-start' : ''} style={selectedOpp ? { minHeight: 'calc(100vh - 140px)' } : {}}>
                <div className={selectedOpp ? 'flex-1 min-w-0' : ''}>
                  <DataTable
                    rows={bookedView === 'new' ? newBookings : bookedRows}
                    cols={bookedView === 'new' ? newBookingsCols : bookedCols}
                    height={selectedOpp ? 640 : 560}
                    onRowClick={handleSelectOpp}
                  />
                </div>
                {selectedOpp && (
                  <div className="w-[62%] flex-shrink-0 sticky top-4">
                    <OppDetailPanel
                      opp={selectedOpp}
                      noteForm={noteForm}
                      setNoteForm={setNoteForm}
                      saveMut={saveMut}
                      onClose={() => setSelectedOpp(null)}
                      currency={currency}
                      fx={fx}
                    />
                  </div>
                )}
              </div>
          }
        </div>
      )}

      {/* ── PIPELINE ANALYSIS TAB ── */}
      {activeTab === 'pipeline' && (
      <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setExcludeNeg(e => !e)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
            excludeNeg ? 'bg-[#aa0808] text-white border-[#aa0808]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
          }`}>
          {excludeNeg ? '✕ Excl. Negatives (on)' : '≠ Excl. Negatives'}
        </button>
        {excludeNeg && <span className="text-[11px] text-[#aa0808] font-medium">Excluding rows with ACV ≤ 0</span>}
        <button onClick={() => setIncludePurchase(e => !e)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
            includePurchase ? 'bg-[#256f3a] text-white border-[#256f3a]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
          }`}>
          {includePurchase ? '✓ A-Purchase as Booked' : '+ Include A-Purchase'}
        </button>
        {includePurchase && <span className="text-[11px] text-[#256f3a] font-medium">Opp Phase = A-Purchase counted as Booked</span>}
      </div>

      <SectionLabel>Summary</SectionLabel>
      <div className="grid grid-cols-6 gap-3 mb-4">
        <KpiCard label="ACV Booked"    value={formatAcvK(acvBooked,currency)}  color="green"  sub={`${nBooked.toLocaleString()} opps`} />
        <KpiCard label="ACV Committed" value={formatAcvK(acvCommit,currency)}                 sub={`${nCommit.toLocaleString()} opps`} />
        <KpiCard label="ACV Probable"  value={formatAcvK(acvProb,currency)}    color="orange" sub={`${nProbable.toLocaleString()} opps`} />
        <KpiCard label="ACV Upside"    value={formatAcvK(acvUpside,currency)}                 sub={`${nUpside.toLocaleString()} opps`} />
        <KpiCard label="ACV Excluded"  value={formatAcvK(acvExcl,currency)}    color="red"    sub={`${nExcluded.toLocaleString()} opps`} />
        <KpiCard label="ACV Disc/Lost" value={formatAcvK(acvLost,currency)}    color="grey"   sub={`${nLost.toLocaleString()} opps`} />
      </div>

      {!prevRows.some((r: any) => r.iss_group_text != null) && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-[12px] font-medium">
          <span className="text-amber-500 text-base">⚠</span>
          <span>
            Prior week data not available — all "Prior Week" bars will show zero.
            To fix: go to <a href="/etl" className="underline font-semibold">Update Data</a> and upload the <b>Pipeline (Last Week)</b> file.
          </span>
        </div>
      )}

      <CollapsibleSection title="By Account Segment — current vs prior week">
      <div className="grid grid-cols-2 gap-4">
        <EChart option={wowBar(charts.by_segment ?? [], 'iss_group_text', `# Opps by Segment`, 'n_opps')} />
        <EChart option={wowBar(charts.by_segment ?? [], 'iss_group_text', `ACV by Segment (${currency})`, 'acv')} />
      </div>
      </CollapsibleSection>

      <CollapsibleSection title="By Geography">
      <div className="grid grid-cols-2 gap-4">
        <EChart option={wowBar(charts.by_region ?? [], 'region_lvl3', `# Opps by Region`, 'n_opps')} />
        <EChart option={wowBar(charts.by_region ?? [], 'region_lvl3', `ACV by Region (${currency})`, 'acv')} />
      </div>
      </CollapsibleSection>

      <CollapsibleSection title="By Closing Quarter">
      <div className="grid grid-cols-2 gap-4">
        <EChart option={stackedOpt} />
        <EChart option={wowBar(charts.by_closing_qtr ?? [], 'closing_qtr', `ACV by Quarter — current vs prior (${currency})`, 'acv')} />
      </div>
      </CollapsibleSection>

      <CollapsibleSection title="By Opp Phase / By Solution Area L1">
      <div className="grid grid-cols-2 gap-4">
        <EChart option={wowBar(charts.by_phase ?? [], 'opp_phase', `ACV by Opp Phase (${currency})`, 'acv')} />
        {(() => {
          const d = chartTopN(charts.by_sol_l1 ?? [], 'acv', 12)
          return <EChart option={hbarOpt(`ACV by Solution L1 (${currency})`, d.labels, d.values.map(v=>v*fx), '#4cb1ff')} />
        })()}
      </div>
      </CollapsibleSection>

      <CollapsibleSection title="By Qualification Decision">
      <div className="grid grid-cols-2 gap-4">
        <EChart option={wowBar(charts.by_qual_decision ?? [], 'deal_qualification_decision', `# Opps by Qual Decision`, 'n_opps')} />
        <EChart option={wowBar(charts.by_qual_decision ?? [], 'deal_qualification_decision', `ACV by Qual Decision (${currency})`, 'acv')} />
      </div>
      </CollapsibleSection>

      <CollapsibleSection title="By Channel Partner">
      <div className="grid grid-cols-2 gap-4">
        {(() => {
          const d = chartTopN(charts.by_channel ?? [], 'n_opps', 12)
          return <EChart option={hbarOpt(`Top 12 Partners — # Opps`, d.labels, d.values, '#5d36ff')} />
        })()}
        {(() => {
          const d = chartTopN(charts.by_channel ?? [], 'acv', 12)
          return <EChart option={hbarOpt(`Top 12 Partners — ACV (${currency})`, d.labels, d.values.map(v=>v*fx), '#0070f2')} />
        })()}
      </div>
      </CollapsibleSection>

      <CollapsibleSection title="By Sub-Solution L2 / By Age Days">
      <div className="grid grid-cols-2 gap-4 mb-4">
        {(() => {
          const d = chartTopN(charts.by_sub_sol ?? [], 'acv', 15)
          return <EChart option={hbarOpt(`ACV by Sub-Solution L2 (Top 15)`, d.labels, d.values.map(v=>v*fx))} />
        })()}
        <EChart option={hbarOpt(
          `ACV by Age Range (${currency})`,
          ageOrder,
          ageOrder.map(r => ageMap[r] ?? 0),
          '#ffa500'
        )} />
      </div>
      </CollapsibleSection>

      <CollapsibleSection title="By Engagement Type — current vs prior week">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={wowBar(charts.by_engagement ?? [], 'engagement_type', `# Opps by Engagement Type`, 'n_opps')} />
        <EChart option={wowBar(charts.by_engagement ?? [], 'engagement_type', `ACV by Engagement Type (${currency})`, 'acv')} />
      </div>

      {/* Engagement breakdown detail — stacked by DRM category */}
      {(() => {
        const engData: ChartRow[] = charts.by_engagement ?? []
        if (!engData.length) return null
        const engLabels = engData.map(r => r.label ?? '—')
        const engAcv    = engData.map(r => r.acv * fx)
        const engOpps   = engData.map(r => r.n_opps)
        const engColors: Record<string,string> = {
          'Digital': '#0070f2',
          'Field': '#4cb1ff',
          'No Engagement': '#c8d8f0',
        }
        return (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <EChart option={{
              title: { text: `ACV by Engagement (${currency}) — breakdown`, textStyle: { fontSize: 13, fontWeight: 600 } },
              legend: {},
              xAxis: { type: 'category', data: engLabels },
              yAxis: { type: 'value' },
              series: engLabels.map((lbl, i) => ({
                name: lbl,
                type: 'bar',
                data: engLabels.map((_, j) => j === i ? engAcv[i] : 0),
                itemStyle: { color: engColors[lbl] ?? '#788fa6' },
              })),
            }} />
            <EChart option={{
              title: { text: '# Opps by Engagement — distribution %', textStyle: { fontSize: 13, fontWeight: 600 } },
              series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                data: engLabels.map((lbl, i) => ({
                  name: lbl,
                  value: engOpps[i],
                  itemStyle: { color: engColors[lbl] ?? '#788fa6' },
                })),
                label: { formatter: '{b}: {d}%', color: '#31333f', fontSize: 11 },
              }],
            }} />
          </div>
        )
      })()}

      {/* Linearidade — distribuição por mês de Closing Date */}
      {(() => {
        // Group active pipeline by closing month
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        type MonthBucket = { n_opps: number; acv: number }
        const byMonth: Record<string, MonthBucket> = {}
        MONTHS.forEach((_, i) => { byMonth[`${(i+1).toString().padStart(2,'0')}`] = { n_opps: 0, acv: 0 } })

        filteredRows
          .filter(r => !['Disc/Lost','Excluded from Pipeline','Booked/Won'].includes(String(r.drm_category ?? '')))
          .forEach(r => {
            const d = r.closing_date as string
            if (!d) return
            const month = String(d).slice(5, 7)   // "YYYY-MM-DD" → "MM"
            if (byMonth[month]) {
              byMonth[month].n_opps += 1
              byMonth[month].acv += (Number(r.acv_usd) || 0) * fx
            }
          })

        const labels    = MONTHS
        const oppVals   = MONTHS.map((_, i) => byMonth[`${(i+1).toString().padStart(2,'0')}`].n_opps)
        const acvVals   = MONTHS.map((_, i) => byMonth[`${(i+1).toString().padStart(2,'0')}`].acv)
        const totalOpps = oppVals.reduce((a, b) => a + b, 0)
        const totalAcv  = acvVals.reduce((a, b) => a + b, 0)
        const linearOpps = totalOpps > 0 ? Array(12).fill(+(totalOpps / 12).toFixed(1)) : []
        const linearAcv  = totalAcv  > 0 ? Array(12).fill(+(totalAcv  / 12)) : []

        const barColors = oppVals.map(v =>
          totalOpps > 0 && v > totalOpps / 12 * 1.5 ? '#aa0808'
          : totalOpps > 0 && v < totalOpps / 12 * 0.5 ? '#e76500'
          : '#0070f2'
        )

        return (
          <>
            <SectionLabel>Linearity — Distribution by Closing Month (Active Pipeline)</SectionLabel>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <EChart option={{
                title: { text: '# Opps by Closing Month', textStyle: { fontSize: 13, fontWeight: 600 } },
                legend: { data: ['# Opps', 'Linear Target'] },
                xAxis: { type: 'category', data: labels },
                yAxis: { type: 'value' },
                series: [
                  {
                    name: '# Opps', type: 'bar',
                    data: oppVals.map((v, i) => ({ value: v, itemStyle: { color: barColors[i] } })),
                    label: { show: true, position: 'top', fontSize: 10, color: '#31333f',
                      formatter: (p: {value: number}) => p.value > 0 ? p.value.toLocaleString() : '' },
                  },
                  {
                    name: 'Linear Target', type: 'line',
                    data: linearOpps,
                    lineStyle: { color: '#256f3a', type: 'dashed', width: 2 },
                    itemStyle: { color: '#256f3a' },
                    symbol: 'none',
                  },
                ],
              }} height={320} />

              <EChart option={{
                title: { text: `ACV by Closing Month (${currency})`, textStyle: { fontSize: 13, fontWeight: 600 } },
                legend: { data: ['ACV', 'Linear Target'] },
                xAxis: { type: 'category', data: labels },
                yAxis: { type: 'value' },
                series: [
                  {
                    name: 'ACV', type: 'bar',
                    data: acvVals.map((v, i) => ({
                      value: v,
                      itemStyle: {
                        color: totalAcv > 0 && v > totalAcv / 12 * 1.5 ? '#aa0808'
                             : totalAcv > 0 && v < totalAcv / 12 * 0.5 ? '#e76500'
                             : '#0070f2',
                      },
                    })),
                    label: {
                      show: true, position: 'top', fontSize: 10, color: '#31333f',
                      formatter: (p: {value: number}) => {
                        if (!p.value) return ''
                        if (Math.abs(p.value) >= 1e6) return `${(p.value/1e6).toFixed(1)}M`
                        if (Math.abs(p.value) >= 1e3) return `${(p.value/1e3).toFixed(1)}K`
                        return String(p.value.toFixed(0))
                      },
                    },
                  },
                  {
                    name: 'Linear Target', type: 'line',
                    data: linearAcv,
                    lineStyle: { color: '#256f3a', type: 'dashed', width: 2 },
                    itemStyle: { color: '#256f3a' },
                    symbol: 'none',
                  },
                ],
              }} height={320} />
            </div>
          </>
        )
      })()}
      </CollapsibleSection>

      {/* ── SDE Section ── */}
      <CollapsibleSection title="SDE Engagement — Opps with and without SDE">
      {(() => {
        const active = filteredRows.filter((r:any) =>
          !['Disc/Lost','Excluded from Pipeline','Booked/Won'].includes(String(r.drm_category ?? ''))
        )
        const withSde    = active.filter((r:any) => r.sde_primary_engagement_name)
        const withoutSde = active.filter((r:any) => !r.sde_primary_engagement_name)
        const withHandover    = withSde.filter((r:any) => r.sde_handover_date || r.sde_handover_name)
        const pendingHandover = withSde.filter((r:any) => !r.sde_handover_date && !r.sde_handover_name)

        const acvWithSde    = withSde.reduce((s:number,r:any)=>s+(Number(r.acv_total_opp)||0)*fx,0)
        const acvWithout    = withoutSde.reduce((s:number,r:any)=>s+(Number(r.acv_total_opp)||0)*fx,0)
        const acvHandover   = withHandover.reduce((s:number,r:any)=>s+(Number(r.acv_total_opp)||0)*fx,0)
        const acvPending    = pendingHandover.reduce((s:number,r:any)=>s+(Number(r.acv_total_opp)||0)*fx,0)

        return (
          <div className="grid grid-cols-2 gap-4">
            <EChart option={{
              title: { text: '# Opps — With SDE vs Without SDE', textStyle: { fontSize: 13, fontWeight: 600 } },
              series: [{
                type: 'pie', radius: ['35%','65%'],
                data: [
                  { name: `With SDE (${withSde.length})`, value: withSde.length, itemStyle: { color: '#0070f2' } },
                  { name: `Without SDE (${withoutSde.length})`, value: withoutSde.length, itemStyle: { color: '#c8d8f0' } },
                ],
                label: { formatter: '{b}\n{d}%', fontSize: 11 },
              }],
              graphic: [{
                type: 'text', left: 'center', top: 'middle',
                style: { text: `${withSde.length+withoutSde.length}\nOpps`, fill: '#32363A', fontSize: 13, fontWeight: 700, textAlign: 'center' }
              }],
            }} />
            <EChart option={{
              title: { text: `ACV — SDE vs Without SDE (${currency})`, textStyle: { fontSize: 13, fontWeight: 600 } },
              series: [{
                type: 'pie', radius: ['35%','65%'],
                data: [
                  { name: `With SDE (${formatAcvK(acvWithSde,currency)})`, value: acvWithSde, itemStyle: { color: '#0070f2' } },
                  { name: `Without SDE (${formatAcvK(acvWithout,currency)})`, value: acvWithout, itemStyle: { color: '#c8d8f0' } },
                ],
                label: { formatter: '{b}\n{d}%', fontSize: 11 },
              }],
            }} />
            <EChart option={{
              title: { text: `# Opps With SDE — Handover`, textStyle: { fontSize: 13, fontWeight: 600 } },
              xAxis: { type: 'category', data: ['Handover done', 'Handover pending'] },
              yAxis: { type: 'value' },
              series: [{
                type: 'bar',
                data: [
                  { value: withHandover.length, itemStyle: { color: '#43A047', borderRadius: [4,4,0,0] } },
                  { value: pendingHandover.length, itemStyle: { color: '#BB0000', borderRadius: [4,4,0,0] } },
                ],
                label: { show: true, position: 'top', fontWeight: 700, fontSize: 12 },
              }],
            }} />
            <EChart option={{
              title: { text: `ACV With SDE — Handover (${currency})`, textStyle: { fontSize: 13, fontWeight: 600 } },
              xAxis: { type: 'category', data: ['Handover done', 'Handover pending'] },
              yAxis: { type: 'value', axisLabel: AXIS_LABEL_M },
              series: [{
                type: 'bar',
                data: [
                  { value: acvHandover, itemStyle: { color: '#43A047', borderRadius: [4,4,0,0] } },
                  { value: acvPending,  itemStyle: { color: '#BB0000', borderRadius: [4,4,0,0] } },
                ],
                label: { show: true, position: 'top', fontWeight: 700, fontSize: 11, formatter: (p:any)=>fmtM(p.value) },
              }],
            }} />
          </div>
        )
      })()}
      </CollapsibleSection>

      {/* DDA / LAC Cloud ERP Filters + Charts */}
      <SectionLabel>DDA Analysis — DDA Status & Range Aging</SectionLabel>
      {ddaOpts.dda_statuses.length === 0 && ddaOpts.range_agings.length === 0 ? (
        <div className="card p-4 mb-4 border-[#e76500] border text-[13px] text-[#e76500]">
          ⚠ DDA data not loaded — upload the LAC Cloud ERP file in Update Data
        </div>
      ) : (
        <>
          {/* DDA Filters */}
          <div className="card p-4 mb-4 flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">DDA Status</p>
              <MultiSelect label="DDA Status" selected={ddaStatusFilter}
                options={ddaOpts.dda_statuses} onChange={setDdaStatusFilter} />
            </div>
            <div className="flex-1 min-w-[220px]">
              <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Range Aging</p>
              <MultiSelect label="Range Aging" selected={rangeAgingFilter}
                options={ddaOpts.range_agings} onChange={setRangeAgingFilter} />
            </div>
            {(ddaStatusFilter.length > 0 || rangeAgingFilter.length > 0) && (
              <div className="flex items-end">
                <button onClick={() => { setDdaStatusFilter([]); setRangeAgingFilter([]) }}
                  className="text-[11px] text-sap-error hover:underline pb-0.5">
                  Clear DDA filters
                </button>
              </div>
            )}
          </div>

          {/* DDA Charts */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <EChart option={{
              title: { text: '# Opps by DDA Status', textStyle: { fontSize: 13, fontWeight: 600 } },
              grid: { left: 16, right: 70, top: 40, bottom: 16, containLabel: true },
              xAxis: { type: 'value' },
              yAxis: { type: 'category', data: (ddaCharts.by_dda_status ?? []).map((r: {label:string}) => r.label ?? '—').reverse() },
              series: [{
                type: 'bar',
                data: (ddaCharts.by_dda_status ?? []).map((r: {n_opps:number}) => r.n_opps).reverse(),
                itemStyle: { color: '#0070f2' },
              }],
            }} height={Math.max(240, (ddaCharts.by_dda_status?.length ?? 0) * 36 + 80)} />
            <EChart option={{
              title: { text: '# Opps by Range Aging', textStyle: { fontSize: 13, fontWeight: 600 } },
              grid: { left: 16, right: 70, top: 40, bottom: 16, containLabel: true },
              xAxis: { type: 'value' },
              yAxis: { type: 'category', data: (ddaCharts.by_range_aging ?? []).map((r: {label:string}) => r.label ?? '—').reverse() },
              series: [{
                type: 'bar',
                data: (ddaCharts.by_range_aging ?? []).map((r: {n_opps:number}) => r.n_opps).reverse(),
                itemStyle: { color: '#e76500' },
              }],
            }} height={Math.max(240, (ddaCharts.by_range_aging?.length ?? 0) * 36 + 80)} />
          </div>
        </>
      )}

      <div className="flex items-center justify-between mb-2">
        <div>
          <SectionLabel>Opportunities</SectionLabel>
          <p className="text-xs text-sap-subtle">{filteredRows.length.toLocaleString()} rows displayed (limited to 20,000)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* SDE filter pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">SDE:</span>
            {([
              { k: 'all',               label: 'All' },
              { k: 'with_sde',         label: '👤 With SDE',          color: '#0D47A1', bg: '#E3F2FD' },
              { k: 'handover_done',    label: '✅ Handover Done',     color: '#1B5E20', bg: '#E8F5E9' },
              { k: 'handover_pending', label: '⏳ Pending',            color: '#7A5800', bg: '#FFF8E1' },
              { k: 'no_sde',           label: '⬜ No SDE',             color: '#616161', bg: '#F5F5F5' },
            ] as const).map(opt => {
              const isActive = sdeFilter === opt.k
              return (
                <button key={opt.k} onClick={() => setSdeFilter(opt.k)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg border transition"
                  style={isActive && opt.k !== 'all'
                    ? { background: (opt as any).bg, color: (opt as any).color, borderColor: (opt as any).color }
                    : isActive
                      ? { background: '#0070F2', color: '#fff', borderColor: '#0070F2' }
                      : { background: '#fff', color: '#888', borderColor: '#E1E2E6' }
                  }>
                  {opt.label}
                </button>
              )
            })}
          </div>
          <ColVisibilityPanel
            visibleCols={visibleCols}
            allColDefs={cols.map(c => ({ key: (c as any).field === 'opportunity_id' ? 'oppId' : (c as any).field, header: (c as any).headerName || (c as any).field }))}
            lobKeys={true}
            onToggle={toggleCol} onShowAll={showAll} onReset={resetCols}
            open={panelOpen} setOpen={setPanelOpen}
          />
          <ExcelDownloadButton
            rows={filteredRows} cols={visibleColDefs}
            defaultFilename="pipeline_adrm.xlsx" sheetName="Pipeline ADRM"
            className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
          />
        </div>
      </div>
      {isLoading
        ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
        : <div className={selectedOpp ? 'flex gap-4 items-start' : ''} style={selectedOpp ? { minHeight: 'calc(100vh - 140px)' } : {}}>
            <div className={selectedOpp ? 'flex-1 min-w-0' : ''}>
              <DataTable rows={filteredRows} cols={visibleColDefs} height={selectedOpp ? 600 : 520} onRowClick={handleSelectOpp} />
            </div>
            {selectedOpp && (
              <div className="w-[62%] flex-shrink-0 sticky top-4">
                <OppDetailPanel
                  opp={selectedOpp}
                  noteForm={noteForm}
                  setNoteForm={setNoteForm}
                  saveMut={saveMut}
                  onClose={() => setSelectedOpp(null)}
                  currency={currency}
                  fx={fx}
                />
              </div>
            )}
          </div>
      }
      </div>
      )}{/* end pipeline tab */}
    </div>
  )
}
