// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useDebounce } from '../lib/useDebounce'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { FilterBar, FilterGrid } from '../components/FilterBar'
import { FilterSelect } from '../components/FilterSelect'
import { DataTable } from '../components/DataTable'
import { EChart } from '../components/EChart'
import { PptxExportButton } from '../components/PptxExportButton'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatAcvK, acvCol } from '../lib/utils'
import type { ColDef } from 'ag-grid-community'
import { Download, AlertTriangle } from 'lucide-react'
import { oppIdCol } from '../components/OppIdCol'
import { exportToExcel } from '../lib/exportExcel'
import { presalesStatusCol, qualDecisionCol } from '../lib/presalesHelpers'
import { ExcelDownloadButton } from '../components/ExcelDownloadButton'
import { PipelineFilterBar } from '../components/PipelineFilterBar'
import { usePipelineFilters } from '../lib/usePipelineFilters'

type Row = Record<string, unknown>

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key] ?? 'Unknown')
    ;(acc[k] ??= []).push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export function MelodyPage() {
  const { currency, fxRate } = useAuth()

  const [excludeNeg, setExcludeNeg] = useState(false)
  const [filters, setFilters] = useState({
    date_from: '', date_to: '',
    activity_type: '', status: '', team_area: '', sub_team: '',
    employee_name: '',
  })
  const set = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  const { filters: pipelineFilters, debouncedParams, toggle, set: setFilter, clear: clearFilters } = usePipelineFilters()

  const { data: opts = {} } = useQuery({
    queryKey: ['melody-filters'],
    queryFn: () => api.get('/api/melody/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: pipelineOpts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => api.get('/api/pipeline/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // Stable serialized key for melody filters — debounce the string, not the object
  const melodyFilterKey = useMemo(
    () => JSON.stringify(filters),
    [filters]
  )
  const debouncedMelodyKey = useDebounce(melodyFilterKey, 400)
  const debouncedMelodyParams = useMemo(() => {
    const f = JSON.parse(debouncedMelodyKey)
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''))
  }, [debouncedMelodyKey])

  // Fetch melody rows FIRST — needed by oppIds useMemo below
  const { data: rows = [] as Row[], isLoading } = useQuery({
    queryKey: ['melody', debouncedMelodyParams],
    queryFn: () => api.get('/api/melody', { params: debouncedMelodyParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: weeklyTrend = [] as { week: string; activity_count: number }[] } = useQuery({
    queryKey: ['melody-trend', debouncedMelodyParams],
    queryFn: () => api.get('/api/melody/weekly-trend', { params: debouncedMelodyParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  // Pipeline KPIs — when melody filters active, restrict to the opp_ids in filtered rows
  const hasMelodyFilters = Object.values(JSON.parse(debouncedMelodyKey)).some(v => v !== '')

  const oppIds = useMemo(() => {
    if (!hasMelodyFilters) return [] as string[]
    return [...new Set(rows.map((r: Row) => r.opportunity_id as string).filter(Boolean))]
  }, [rows, hasMelodyFilters])

  // debouncedParams is already stable (useMemo in usePipelineFilters).
  // We need a stable string key that changes only when pipeline filters OR excludeNeg change.
  // Since debouncedParams is a stable object, we serialize it once per change.
  const kpiParamsKey = useMemo(
    () => JSON.stringify({ ...debouncedParams, ...(excludeNeg ? { exclude_neg: true } : {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(debouncedParams), excludeNeg]
  )
  const stableKpiParams = useMemo(() => JSON.parse(kpiParamsKey), [kpiParamsKey])

  const { data: kpis = {} } = useQuery({
    queryKey: ['pipeline-kpis-melody', kpiParamsKey, oppIds.join(',')],
    queryFn: async () => {
      if (hasMelodyFilters && oppIds.length === 0) {
        return { n_booked:0, n_committed:0, n_probable:0, n_upside:0, n_excluded:0, n_lost:0,
                 acv_booked:0, acv_committed:0, acv_probable:0, acv_upside:0, acv_excluded:0, acv_lost:0 }
      }
      if (hasMelodyFilters && oppIds.length > 0) {
        // POST with opp_ids + pipeline params combined
        const res = await api.post('/api/pipeline/kpis-by-ids', {
          opp_ids: oppIds,
          exclude_neg: !!stableKpiParams.exclude_neg,
        })
        return res.data
      }
      return api.get('/api/pipeline/kpis', { params: stableKpiParams }).then(r => r.data)
    },
    staleTime: 2 * 60_000,
  })
  const nBooked   = Number(kpis.n_booked    || 0)
  const nCommit   = Number(kpis.n_committed  || 0)
  const nProbable = Number(kpis.n_probable   || 0)
  const nUpside   = Number(kpis.n_upside     || 0)
  const nExcluded = Number(kpis.n_excluded   || 0)
  const nLost     = Number(kpis.n_lost       || 0)

  // KPIs
  const filteredRows = excludeNeg ? rows.filter(r => (Number(r.acv_total_opp)||0) > 0) : rows
  const nActs     = filteredRows.length
  const nOpps     = new Set(filteredRows.map(r => r.opportunity_id)).size
  const nAdvisors = new Set(filteredRows.map(r => r.employee_name)).size
  const nAccounts  = new Set(filteredRows.map(r => r.account_name)).size
  const avgPerOpp = nOpps > 0 ? (nActs / nOpps).toFixed(1) : '—'

  // Weeks spanned by filtered activities
  const weeks = new Set(filteredRows.map((r: Row) => {
    const d = r.start_date as string
    if (!d) return null
    const date = new Date(d)
    // ISO week key: YYYY-Www
    const jan4 = new Date(date.getFullYear(), 0, 4)
    const w = Math.ceil(((date.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
    return `${date.getFullYear()}-W${w.toString().padStart(2,'0')}`
  }).filter(Boolean)).size
  const avgAcctPerWeek = weeks > 0 ? (nAccounts / weeks).toFixed(1) : '—'
  const acvCovered = Array.from(new Map(filteredRows.map(r => [r.opportunity_id, Number(r.acv_total_opp) || 0])).values()).reduce((a, b) => a + b, 0) * fxRate

  // Charts
  function hbarTop<T>(arr: T[], keyField: keyof T, n = 15, color = '#0070f2') {
    const groups = groupBy(arr, keyField)
    const entries = Object.entries(groups).map(([k, v]) => [k, v.length] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, n).reverse()
    return { labels: entries.map(([k]) => k), values: entries.map(([, v]) => v), color }
  }

  const byType    = hbarTop(filteredRows, 'activity_type', 15, '#0070f2')
  const byAdvisor = hbarTop(filteredRows, 'employee_name', 15, '#4cb1ff')
  const byTeam    = hbarTop(filteredRows, 'team_area', 10, '#5d36ff')
  const bySolL2   = hbarTop(filteredRows, 'solution_l2', 12, '#046c7a')

  function hbarOpt(title: string, labels: string[], values: number[], color: string) {
    return {
      title: { text: title, textStyle: { fontSize: 13, fontWeight: 600 } },
      grid: { left: 16, right: 60, top: 40, bottom: 16, containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: labels },
      series: [{ type: 'bar', data: values, itemStyle: { color },
        label: { show: true, position: 'right', formatter: (p: {value: number}) => p.value.toLocaleString() } }],
    }
  }

  // Week-over-week chart
  const trendOpt = {
    title: { text: '# Activities per Week', textStyle: { fontSize: 13, fontWeight: 600 } },
    xAxis: { type: 'category', data: weeklyTrend.map(w => w.week) },
    yAxis: { type: 'value' },
    series: [{
      type: 'line', data: weeklyTrend.map(w => w.activity_count),
      lineStyle: { color: '#0070f2', width: 2 },
      itemStyle: { color: '#0070f2' },
      areaStyle: { color: 'rgba(0,112,242,0.08)' },
      smooth: true,
    }],
  }

  // Table columns
  const cols: ColDef[] = [
    oppIdCol,
    { field: 'account_name',    headerName: 'Account',       flex: 1, minWidth: 140 },
    { field: 'employee_name',   headerName: 'Advisor',       width: 150 },
    { field: 'team_area',       headerName: 'Team',          width: 130 },
    { field: 'sub_team',        headerName: 'Sub-Team',      width: 100 },
    { field: 'activity_type',   headerName: 'Activity Type', width: 160 },
    { field: 'activity_status', headerName: 'Status',        width: 110 },
    { field: 'start_date',      headerName: 'Start Date',    width: 130,
      valueFormatter: (p: {value: string}) => p.value ? new Date(p.value).toLocaleDateString() : '—' },
    { field: 'solution_area_l1', headerName: 'Solution L1',  width: 160 },
    { field: 'region',          headerName: 'Region',        width: 130 },
    { field: 'drm_category',    headerName: 'DRM Cat',       width: 110 },
    { field: 'closing_qtr',     headerName: 'Closing Qtr',   width: 110 },
    acvCol('acv_total_opp', fxRate, currency, `ACV K (${currency})`, 140),
    { field: 'notes',           headerName: 'Notes',         flex: 1, minWidth: 160 },
  ]

  const exportCSV = () => {
    exportToExcel(filteredRows, 'melody_activities.xlsx', 'Melody Activities', cols)
  }


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-sap-text">Melody Analysis</h2>
        <PptxExportButton label="Export PPT" getPayload={() => ({
          page: 'melody',
          title: 'Melody Analysis',
          subtitle: `SA Activities — ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,
          currency,
          kpis: [
            { label:'Total Activities', value:String(nActs), color:'blue' },
            { label:'Opportunities',    value:String(nOpps), color:'blue' },
            { label:'Advisors',         value:String(nAdvisors) },
            { label:'Accounts',         value:String(nAccounts) },
          ],
          bar_charts: [
            { title:'Activities by Type',    data:byType.labels.map((l,i)=>({label:l,value:byType.values[i]})) },
            { title:'Activities by Advisor', data:byAdvisor.labels.map((l,i)=>({label:l,value:byAdvisor.values[i]})) },
          ],
        })} />
      </div>
      <hr className="border-sap-border mb-4" />

      <FilterBar>
        <FilterGrid cols={5}>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Date From</label>
            <input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)}
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Date To</label>
            <input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)}
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
          <FilterSelect label="Activity Type" value={filters.activity_type} onChange={v => set('activity_type', v)} options={opts.activity_types ?? []} />
          <FilterSelect label="Activity Status" value={filters.status} onChange={v => set('status', v)} options={opts.statuses ?? []} />
          <FilterSelect label="Digital Team" value={filters.team_area} onChange={v => set('team_area', v)} options={opts.team_areas ?? []} />
          <FilterSelect label="Sub-Team" value={filters.sub_team} onChange={v => set('sub_team', v)} options={opts.sub_teams ?? []} />
          <FilterSelect label="Solution Advisor" value={filters.employee_name} onChange={v => set('employee_name', v)} options={opts.employees ?? []} />
        </FilterGrid>
      </FilterBar>

      <SectionLabel>Pipeline Filters</SectionLabel>
      <PipelineFilterBar filters={pipelineFilters} opts={pipelineOpts} toggle={toggle} set={setFilter} clear={clearFilters} />

      {/* KPIs */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => setExcludeNeg(e => !e)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${excludeNeg ? 'bg-[#aa0808] text-white border-[#aa0808]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'}`}>
          {excludeNeg ? '✕ Excl. Negatives (on)' : '≠ Excl. Negatives'}
        </button>
        {excludeNeg && <span className="text-[11px] text-[#aa0808] font-medium">Excluding opps with ACV ≤ 0</span>}
      </div>

      {/* Pipeline KPIs — same as ADRM Pipeline */}
      <SectionLabel>Pipeline Summary</SectionLabel>
      <div className="grid grid-cols-6 gap-3 mb-5">
        <KpiCard label="ACV Booked"    value={formatAcvK(Number(kpis.acv_booked   ||0)*fxRate, currency)} color="green"  sub={`${nBooked.toLocaleString()} opps`} />
        <KpiCard label="ACV Committed" value={formatAcvK(Number(kpis.acv_committed||0)*fxRate, currency)}                sub={`${nCommit.toLocaleString()} opps`} />
        <KpiCard label="ACV Probable"  value={formatAcvK(Number(kpis.acv_probable ||0)*fxRate, currency)} color="orange" sub={`${nProbable.toLocaleString()} opps`} />
        <KpiCard label="ACV Upside"    value={formatAcvK(Number(kpis.acv_upside   ||0)*fxRate, currency)}                sub={`${nUpside.toLocaleString()} opps`} />
        <KpiCard label="ACV Excluded"  value={formatAcvK(Number(kpis.acv_excluded ||0)*fxRate, currency)} color="red"   sub={`${nExcluded.toLocaleString()} opps`} />
        <KpiCard label="ACV Disc/Lost" value={formatAcvK(Number(kpis.acv_lost     ||0)*fxRate, currency)} color="grey"  sub={`${nLost.toLocaleString()} opps`} />
      </div>

      <SectionLabel>Summary</SectionLabel>
      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard label={`ACV Covered`}       value={formatAcvK(acvCovered, currency)} color="green" sub={`${nOpps.toLocaleString()} opps`} />
        <KpiCard label="# Activities"       value={nActs.toLocaleString()}     sub={`avg ${avgPerOpp}/opp`} />
        <KpiCard label="# SAs Active"       value={nAdvisors.toLocaleString()} color="blue" sub="advisors" />
        <KpiCard label="# Accounts"         value={nAccounts.toLocaleString()} sub="unique accounts" />
        <KpiCard label="Avg Accounts/Week" value={avgAcctPerWeek}            color="blue" sub={`${weeks} weeks`} />
      </div>

      {/* Week trend */}
      <SectionLabel>Activity Trend — Week over Week</SectionLabel>
      <EChart option={trendOpt} height={260} className="mb-4" />

      {/* Charts grid */}
      <SectionLabel>Activity Breakdown</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={hbarOpt('# Activities by Type', byType.labels, byType.values, byType.color)} />
        <EChart option={hbarOpt('# Activities by Advisor (Top 15)', byAdvisor.labels, byAdvisor.values, byAdvisor.color)} />
      </div>

      <SectionLabel>By Team / By Solution</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={hbarOpt('# Activities by Team', byTeam.labels, byTeam.values, byTeam.color)} />
        <EChart option={hbarOpt('# Activities by Solution L2 (Top 12)', bySolL2.labels, bySolL2.values, bySolL2.color)} />
      </div>

      {/* Table */}
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Activity Detail</SectionLabel>
        <ExcelDownloadButton
          rows={filteredRows} cols={cols}
          defaultFilename="melody_activities.xlsx" sheetName="Melody Activities"
          className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
        />
      </div>
      <p className="text-xs text-sap-subtle mb-2">Showing up to 5,000 of {rows.length.toLocaleString()} activities after filters</p>
      {isLoading
        ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
        : <DataTable rows={filteredRows} cols={cols} height={480} />
      }

      {/* ── VAT Gaps ─────────────────────────────────────────────────────── */}
      <VatGapsSection fx={fxRate} currency={currency} />
    </div>
  )
}


// ── VAT Gaps Section ─────────────────────────────────────────────────────────
const TEAMS = ['ERP Cloud BR', 'ERP Cloud MCLA', 'ERP MX MCLA IB', 'LoBs Team']
const DRM_CATS = ['Committed','Probable','Upside','Excluded from Pipeline','Partner Forecasted','Booked/Won']

function VatGapsSection({ fx, currency }: { fx: number; currency: string }) {
  const [saFilter, setSaFilter] = useState('')
  const [drmFilter, setDrmFilter] = useState<string[]>([])
  const [teamFilter, setTeamFilter] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const params = {
    ...(saFilter ? { digital_sa: saFilter } : {}),
    ...(drmFilter.length ? { drm_categories: drmFilter } : {}),
    ...(teamFilter ? { team: teamFilter } : {}),
  }

  const { data: summary = {} } = useQuery({
    queryKey: ['vat-gaps-summary', params],
    queryFn: () => api.get('/api/melody/vat-gaps/summary', { params }).then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: gaps = [], isLoading } = useQuery({
    queryKey: ['vat-gaps', params],
    queryFn: () => api.get('/api/melody/vat-gaps', { params }).then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const DRM_CATS_REF = DRM_CATS

  const gapCols: ColDef[] = [
    oppIdCol,
    { field:'account_name',        headerName:'Account',       flex:1, minWidth:150 },
    { field:'opp_owner_name',      headerName:'AE Owner',      width:140 },
    { field:'solution_area_l1',    headerName:'Solution L1',   width:160 },
    { field:'drm_category',        headerName:'DRM Cat',       width:120 },
    { field:'opp_phase',           headerName:'Phase',         width:120 },
    { field:'closing_qtr',         headerName:'Closing Qtr',   width:100 },
    { field:'region_lvl3',         headerName:'Region',        width:110 },
    { field:'engagement_type',     headerName:'Engagement',    width:110,
      cellStyle:(p:any) => {
        const v=(p.value||'').toLowerCase()
        if(v.includes('digital')) return{color:'#256f3a',fontWeight:700}
        if(v.includes('field'))   return{color:'#BB0000',fontWeight:700}
        return{}
      }},
    { ...presalesStatusCol(110) },
    { ...qualDecisionCol(130) },
    { field:'deal_qualification_score',    headerName:'Score',         width:75 },
    { field:'vat_dh',              headerName:'Digital SA (VAT)',      flex:1, minWidth:180 },
    { field:'vat_size',            headerName:'VAT Size',      width:80 },
    { field:'age_days',            headerName:'Age (days)',    width:90 },
    acvCol('acv_total_opp', fx, currency, `ACV (${currency})`, 140),
    { field:'flsm',                headerName:'Sales Manager', width:140 },
  ]

  const totalAcv = gaps.reduce((s:number,r:any) => s + (Number(r.acv_total_opp)||0)*fx, 0)

  return (
    <div className="mt-6">
      {/* Collapsible header */}
      <div
        className="flex items-center justify-between cursor-pointer px-4 py-3 bg-[#FFF8E1] border border-[#F0AB00] rounded-t-xl"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-[#F0AB00]" />
          <span className="font-bold text-[14px] text-sap-text">VAT Gaps — Opps with no Melody Activity</span>
          {!collapsed && (
            <span className="text-[11px] text-sap-muted ml-2">
              {summary.no_melody || 0} opps · {formatAcvK(Number(summary.no_melody_acv||0)*fx, currency)} ACV at risk
              · {Math.round((Number(summary.no_melody||0)/Math.max(Number(summary.total_active_vat||1),1))*100)}% of active VAT pipeline
            </span>
          )}
        </div>
        <span className="text-[11px] text-sap-muted">{collapsed ? 'Show ▼' : 'Hide ▲'}</span>
      </div>

      {!collapsed && (
        <div className="border border-t-0 border-[#F0AB00] rounded-b-xl p-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card p-3 bg-[#FFFDE7]">
              <div className="text-[10px] font-bold text-[#856404] uppercase tracking-wide mb-1">No Melody Activity</div>
              <div className="text-[20px] font-bold text-[#E65100]">{summary.no_melody || 0}</div>
              <div className="text-[11px] text-sap-muted">opps in VAT with no activity</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-1">ACV at Risk</div>
              <div className="text-[20px] font-bold text-sap-error">{formatAcvK(Number(summary.no_melody_acv||0)*fx, currency)}</div>
              <div className="text-[11px] text-sap-muted">pipeline not being worked</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-1">Coverage</div>
              <div className="text-[20px] font-bold text-sap-blue">{summary.has_melody || 0} / {summary.total_active_vat || 0}</div>
              <div className="text-[11px] text-sap-muted">opps with at least one activity</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Team</label>
              <select
                value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
                className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue bg-white"
              >
                <option value="">All Teams</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Digital SA (VAT)</label>
              <input
                value={saFilter} onChange={e => setSaFilter(e.target.value)}
                placeholder="Search SA name…"
                className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue w-52"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">DRM Category</label>
              <div className="flex flex-wrap gap-1">
                {DRM_CATS_REF.map(d => (
                  <button key={d} onClick={() => setDrmFilter(p => p.includes(d) ? p.filter(x=>x!==d) : [...p,d])}
                    className={`text-[11px] px-2 py-1 rounded-lg border font-semibold transition ${
                      drmFilter.includes(d) ? 'bg-sap-blue text-white border-sap-blue' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
                    }`}>
                    {d}
                  </button>
                ))}
                {drmFilter.length > 0 && (
                  <button onClick={() => setDrmFilter([])} className="text-[10px] text-sap-error hover:underline self-center ml-1">Clear</button>
                )}
              </div>
            </div>
            <ExcelDownloadButton
              rows={gaps} cols={gapCols}
              defaultFilename="vat_gaps.xlsx" sheetName="VAT Gaps"
              className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition ml-auto"
            />
          </div>

          <p className="text-xs text-sap-subtle mb-2">
            {gaps.length} opportunities · {formatAcvK(totalAcv, currency)} ACV
            {(saFilter || drmFilter.length > 0 || teamFilter) && ' (filtered)'}
          </p>

          {isLoading
            ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
            : <DataTable rows={gaps} cols={gapCols} height={480} />
          }
        </div>
      )}
    </div>
  )
}
