// @ts-nocheck
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useDebounce } from '../lib/useDebounce'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { FilterBar, FilterGrid } from '../components/FilterBar'
import { MultiSelect, SearchMultiSelect } from '../components/MultiSelect'
import { DataTable } from '../components/DataTable'
import { EChart } from '../components/EChart'
import { PptxExportButton } from '../components/PptxExportButton'
import { ColVisibilityPanel, BagFilterBar } from '../components/PipelineTableExtras'
import { useColVisibility, useBagFilter, buildLobAcvCols, engagementCellStyle, LOB_COL_DEFS } from '../lib/pipelineTableHelpers'
import { useAuth } from '../context/AuthContext'
import { formatAcvK, acvCol } from '../lib/utils'
import { exportToExcel } from '../lib/exportExcel'
import { ExcelDownloadButton } from '../components/ExcelDownloadButton'
import type { ColDef } from 'ag-grid-community'
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { oppIdCol } from '../components/OppIdCol'

type Row = Record<string, unknown>
type ChartRow = { label: string; n_opps: number; acv: number }

const DRM_COLORS: Record<string, string> = {
  'Booked/Won':               '#256f3a',
  'Disc/Lost':                '#aa0808',
  'Committed':                '#0070f2',
  'Probable':                 '#4cb1ff',
  'Upside':                   '#c4d9f0',
  'Excluded from Pipeline':   '#788fa6',
}

const DRM_CATS = ['Booked/Won', 'Committed', 'Probable', 'Upside', 'Excluded from Pipeline', 'Disc/Lost']

function sumBy<T>(arr: T[], key: keyof T): number {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

function Delta({ curr, prev, good = 'up' }: { curr: number; prev: number; good?: 'up' | 'down' }) {
  const d = curr - prev
  if (d === 0) return <span className="flex items-center gap-0.5 text-sap-subtle text-xs"><Minus size={11} /> —</span>
  const isGood = good === 'up' ? d > 0 : d < 0
  const color  = isGood ? 'text-sap-success' : 'text-sap-error'
  const Icon   = d > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon size={11} /> {Math.abs(d).toLocaleString()}
    </span>
  )
}

function pct(n: number | null) {
  return n != null ? `${n.toFixed(1)}%` : '—'
}

function LobRow({ r, fx, currency, isChild = false }: {
  r: any; fx: number; currency: string; isChild?: boolean
}) {
  const yoyBookedDiff = r.n_booked - r.prev_n_booked
  const yoyAcvDiff    = r.acv_booked - r.prev_acv_booked

  return (
    <tr className={`border-b border-sap-border text-[12px] ${isChild ? 'bg-[#f9fafb]' : 'hover:bg-sap-bg'}`}>
      <td className={`py-2 px-3 font-${isChild ? 'normal' : 'semibold'} text-sap-text ${isChild ? 'pl-8 text-sap-muted' : ''}`}>
        {isChild ? '↳ ' : ''}{r.lob}
      </td>
      {/* Booked */}
      <td className="py-2 px-2 text-center font-bold text-[#256f3a]">{r.n_booked.toLocaleString()}</td>
      <td className="py-2 px-2 text-center font-bold text-[#256f3a]">{formatAcvK(r.acv_booked * fx, currency)}</td>
      {/* Pipeline */}
      <td className="py-2 px-2 text-center text-[#0070f2]">{r.n_committed.toLocaleString()}</td>
      <td className="py-2 px-2 text-center text-[#4cb1ff]">{r.n_probable.toLocaleString()}</td>
      <td className="py-2 px-2 text-center text-[#788fa6]">{r.n_upside.toLocaleString()}</td>
      <td className="py-2 px-2 text-center text-[#788fa6]">{r.n_excluded.toLocaleString()}</td>
      {/* Lost */}
      <td className="py-2 px-2 text-center text-[#aa0808]">{r.n_lost.toLocaleString()}</td>
      {/* Conv Rate */}
      <td className="py-2 px-2 text-center font-semibold">
        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
          r.conversion_rate >= 30 ? 'bg-[#d4edda] text-[#256f3a]' :
          r.conversion_rate >= 15 ? 'bg-[#fff3cd] text-[#856404]' :
          'bg-[#fde8e8] text-[#aa0808]'
        }`}>{pct(r.conversion_rate)}</span>
      </td>
      {/* 2025 comparison */}
      <td className="py-2 px-2 text-center text-sap-muted border-l border-dashed border-sap-border">
        {r.prev_n_booked.toLocaleString()}
      </td>
      <td className="py-2 px-2 text-center text-sap-muted">{formatAcvK(r.prev_acv_booked * fx, currency)}</td>
      <td className="py-2 px-2 text-center text-sap-muted">{pct(r.prev_conv_rate)}</td>
      {/* YoY delta */}
      <td className="py-2 px-2 text-center">
        <Delta curr={r.n_booked} prev={r.prev_n_booked} />
      </td>
      <td className="py-2 px-2 text-center">
        <Delta curr={r.acv_booked} prev={r.prev_acv_booked} />
      </td>
    </tr>
  )
}

export function LACResultsPage() {
  const { currency, fxRate } = useAuth()
  const fx = fxRate

  const [filters, setFilters] = useState({
    closing_qtrs:     [] as string[],
    regions:          [] as string[],
    sol_l1s:          [] as string[],
    engagement_types: [] as string[],
    opp_owners:       [] as string[],
    fcs:              [] as string[],
    drms:             [] as string[],
    digital_sas:      [] as string[],
    iss_groups:       [] as string[],
    iacs:             [] as string[],
    search:           '',
  })
  const set = (k: string, v: string | string[]) => setFilters(f => ({ ...f, [k]: v }))

  const { data: opts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => api.get('/api/pipeline/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const baseParams: Record<string, unknown> = {}
  if (filters.closing_qtrs.length)     baseParams.closing_qtrs     = filters.closing_qtrs
  if (filters.regions.length)          baseParams.regions           = filters.regions
  if (filters.sol_l1s.length)          baseParams.sol_l1s           = filters.sol_l1s
  if (filters.engagement_types.length) baseParams.engagement_types  = filters.engagement_types
  if (filters.opp_owners.length)       baseParams.opp_owners        = filters.opp_owners
  if (filters.fcs.length)              baseParams.fcs               = filters.fcs
  if (filters.drms.length)             baseParams.drms              = filters.drms
  if (filters.digital_sas.length)      baseParams.digital_sas       = filters.digital_sas
  if (filters.iss_groups.length)        baseParams.iss_groups        = filters.iss_groups
  if (filters.iacs.length)             baseParams.iacs              = filters.iacs
  if (filters.search)                  baseParams.search            = filters.search
  const debouncedParams = useDebounce(baseParams, 400)
  const [includePurchase, setIncludePurchase] = useState(false)
  const [lobTab, setLobTab] = useState<'current' | 'yoy'>('current')

  const purchaseParams = { ...debouncedParams, ...(includePurchase ? { include_purchase: true } : {}) }

  const { data: kpis = {} } = useQuery({
    queryKey: ['pipeline-kpis', purchaseParams],
    queryFn: () => api.get('/api/pipeline/kpis', { params: purchaseParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const { data: charts = {} } = useQuery({
    queryKey: ['pipeline-charts', purchaseParams],
    queryFn: () => api.get('/api/pipeline/charts', { params: purchaseParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const { data: rows = [] as Row[], isLoading } = useQuery({
    queryKey: ['pipeline', purchaseParams],
    queryFn: () => api.get('/api/pipeline', { params: { ...purchaseParams, deduplicate: true, limit: 20000 } }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const { data: prevRows = [] as Row[] } = useQuery({
    queryKey: ['pipeline-prev', {}],
    queryFn: () => api.get('/api/pipeline/prev').then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const { data: lobData = { lobs: [] } } = useQuery({
    queryKey: ['lac-lob-breakdown', debouncedParams],
    queryFn: () => api.get('/api/pipeline/lac/lob-breakdown', { params: debouncedParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const bookedRows = rows.filter(r => r.drm_category === 'Booked/Won')
  const lostRows   = rows.filter(r => r.drm_category === 'Disc/Lost')
  const prevBooked = prevRows.filter(r => r.drm_category === 'Booked/Won')
  const prevLost   = prevRows.filter(r => r.drm_category === 'Disc/Lost')

  const nBooked   = Number(kpis.n_booked   || 0)
  const nLost     = Number(kpis.n_lost     || 0)
  const nCommit   = Number(kpis.n_committed|| 0)
  const nProbable = Number(kpis.n_probable || 0)
  const nUpside   = Number(kpis.n_upside   || 0)
  const nExcluded = Number(kpis.n_excluded || 0)
  const acvBooked  = Number(kpis.acv_booked   || 0) * fx
  const acvLost    = Number(kpis.acv_lost     || 0) * fx
  const acvCommit  = Number(kpis.acv_committed|| 0) * fx
  const acvProb    = Number(kpis.acv_probable || 0) * fx
  const acvUpside  = Number(kpis.acv_upside   || 0) * fx
  const acvExcl    = Number(kpis.acv_excluded || 0) * fx

  const nClosed  = nBooked + nLost
  const winRate  = nClosed > 0 ? ((nBooked / nClosed) * 100).toFixed(1) : '—'
  const nDigital = Number(kpis.n_digital || 0)

  const { data: bookedCharts = {} } = useQuery({
    queryKey: ['pipeline-charts-booked', purchaseParams],
    queryFn: () => api.get('/api/pipeline/charts', { params: { ...purchaseParams, drm: 'Booked/Won' } }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const bookedRegion: ChartRow[] = (bookedCharts.by_region ?? []).sort((a, b) => a.acv - b.acv)
  const bookedSolL1:  ChartRow[] = (bookedCharts.by_sol_l1  ?? []).sort((a, b) => a.acv - b.acv)
  const bookedQtr:    ChartRow[] = (bookedCharts.by_closing_qtr ?? [])

  const { data: lostCharts = {} } = useQuery({
    queryKey: ['pipeline-charts-lost', purchaseParams],
    queryFn: () => api.get('/api/pipeline/charts', { params: { ...purchaseParams, drm: 'Disc/Lost' } }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const lostQtr: ChartRow[] = (lostCharts.by_closing_qtr ?? [])

  const allQtrs     = [...new Set([...bookedQtr.map(r => r.label), ...lostQtr.map(r => r.label)])].sort()
  const bookedQtrMap = Object.fromEntries(bookedQtr.map(r => [r.label, r.n_opps]))
  const lostQtrMap   = Object.fromEntries(lostQtr.map(r => [r.label, r.n_opps]))
  const fcData: ChartRow[] = charts.by_fc ?? []

  // LoB breakdown — separate top-level vs Finance sub-groups
  const topLobs      = (lobData.lobs ?? []).filter(r => !r.is_finance_sub)
  const financeSubs  = (lobData.lobs ?? []).filter(r => r.is_finance_sub)
  const financeRow   = topLobs.find(r => r.lob === 'Finance & Spend Management')

  const cols: ColDef[] = [
    oppIdCol,
    { field: 'account_name',      headerName: 'Account',     flex: 1, minWidth: 150 },
    { field: 'opp_owner_name',    headerName: 'Owner',       width: 140 },
    { field: 'solution_area_l1',  headerName: 'Solution L1', width: 160 },
    { field: 'closing_qtr',       headerName: 'Quarter',     width: 110 },
    { field: 'engagement_type',   headerName: 'Engagement',  width: 110 , cellStyle: engagementCellStyle },
    { field: 'iss_group_text',     headerName: 'ISS Group',   width: 130 },
    { field: 'iac',               headerName: 'IAC',         width: 130 },
    { field: 'vat_dh',            headerName: 'Digital SA',  width: 160 },
    acvCol('acv_total_opp', fx, currency, `ACV K (${currency})`, 150),
    ...buildLobAcvCols(fx, currency),
    { field: 'drm_category', headerName: 'DRM Cat', width: 110 },
  ]

  const ALL_COL_KEYS = cols.map((c:any) => c.field === 'opportunity_id' ? 'oppId' : c.field).filter(Boolean)
  const DEFAULT_KEYS = ALL_COL_KEYS.filter((k:string) => !k.startsWith('acv_l1_'))
  const { visibleCols: lacVisibleCols, panelOpen: lacPanelOpen, setPanelOpen: setLacPanelOpen, toggleCol: lacToggleCol, showAll: lacShowAll, resetCols: lacResetCols } = useColVisibility(ALL_COL_KEYS, DEFAULT_KEYS)
  const { bagFilter: lacBagFilter, setBagFilter: setLacBagFilter, filteredRows: lacBagRows, singleCount: lacSingleCount, basketCount: lacBasketCount } = useBagFilter(bookedRows)
  const lacVisibleColDefs = cols.filter((c:any) => lacVisibleCols.has(c.field === 'opportunity_id' ? 'oppId' : c.field))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-sap-text">Digital LAC Results</h2>
        <PptxExportButton label="Export PPT" getPayload={() => ({
          page: 'lac',
          title: 'Digital LAC Results',
          subtitle: `${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,
          filters: debouncedParams as any,
          currency,
          kpis: [
            { label:'Booked/Won',  value:`$${(Number(kpis.acv_booked||0)*fx/1e6).toFixed(1)}M`,  sub:`${Number(kpis.n_booked||0)} opps`, color:'green'  },
            { label:'Committed',   value:`$${(Number(kpis.acv_committed||0)*fx/1e6).toFixed(1)}M`,sub:`${Number(kpis.n_committed||0)} opps`,color:'blue'   },
            { label:'Probable',    value:`$${(Number(kpis.acv_probable||0)*fx/1e6).toFixed(1)}M`, sub:`${Number(kpis.n_probable||0)} opps`, color:'orange' },
            { label:'Disc/Lost',   value:`$${(Number(kpis.acv_lost||0)*fx/1e6).toFixed(1)}M`,     sub:`${Number(kpis.n_lost||0)} opps`,    color:'red'    },
          ],
          bar_charts: [
            { title:`ACV Booked by Region (${currency})`, data:(bookedCharts.by_region??[]).map((r:any)=>({label:r.label,value:r.acv*fx})) },
            { title:`ACV Booked by Solution L1`,           data:(bookedCharts.by_sol_l1??[]).map((r:any)=>({label:r.label,value:r.acv*fx})) },
          ],
          lob_rows: (lobData.lobs??[]).map((r:any)=>({lob:r.lob,n_booked:r.n_booked,acv_booked:r.acv_booked,n_committed:r.n_committed,n_probable:r.n_probable,n_upside:r.n_upside,n_lost:r.n_lost,conversion_rate:r.conversion_rate,is_finance_sub:r.is_finance_sub})),
        })} />
      </div>
      <hr className="border-sap-border mb-4" />

      <FilterBar>
        <FilterGrid cols={5}>
          <MultiSelect label="Closing Qtr"      selected={filters.closing_qtrs}     onChange={v => set('closing_qtrs', v)}     options={opts.closing_qtrs     ?? []} />
          <MultiSelect label="Region Lvl 3"     selected={filters.regions}          onChange={v => set('regions', v)}          options={opts.regions          ?? []} />
          <MultiSelect label="Solution L1"      selected={filters.sol_l1s}          onChange={v => set('sol_l1s', v)}          options={opts.sol_l1s          ?? []} />
          <MultiSelect label="Engagement Type"  selected={filters.engagement_types} onChange={v => set('engagement_types', v)} options={opts.engagement_types  ?? []} />
          <MultiSelect label="Opp Owner"        selected={filters.opp_owners}       onChange={v => set('opp_owners', v)}       options={opts.opp_owners        ?? []} />
          <MultiSelect label="FC Qualification" selected={filters.fcs}              onChange={v => set('fcs', v)}              options={opts.fcs               ?? []} />
          <MultiSelect label="DRM Category"     selected={filters.drms}             onChange={v => set('drms', v)}             options={DRM_CATS} />
          <MultiSelect label="ISS Group (Segment)"  selected={filters.iss_groups}        onChange={v => set('iss_groups', v)}        options={opts.iss_groups ?? []} />
          <MultiSelect label="IAC"                   selected={filters.iacs}              onChange={v => set('iacs', v)}              options={opts.iacs ?? []} />
          <SearchMultiSelect label="SA Name (LoB Team)" selected={filters.digital_sas} onChange={v => set('digital_sas', v)} options={opts.digital_sas ?? []} />
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">Search</label>
            <input value={filters.search} onChange={e => set('search', e.target.value)}
              placeholder="Opp ID / Account…"
              className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>
        </FilterGrid>
      </FilterBar>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setIncludePurchase(e => !e)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
            includePurchase ? 'bg-[#256f3a] text-white border-[#256f3a]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
          }`}>
          {includePurchase ? '✓ A-Purchase as Booked' : '+ Include A-Purchase'}
        </button>
        {includePurchase && <span className="text-[11px] text-[#256f3a] font-medium">Opp Phase = A-Purchase counted as Booked</span>}
      </div>

      {/* ── 1. DRM Category KPI Cards ─────────────────────────────────────── */}
      <SectionLabel>DRM Category Summary</SectionLabel>
      <div className="grid grid-cols-6 gap-3 mb-3">
        <KpiCard label="Booked / Won"            value={formatAcvK(acvBooked, currency)} color="green"  sub={`${nBooked.toLocaleString()} opps`} />
        <KpiCard label="Committed"               value={formatAcvK(acvCommit, currency)} color="blue"   sub={`${nCommit.toLocaleString()} opps`} />
        <KpiCard label="Probable"                value={formatAcvK(acvProb,   currency)} color="orange" sub={`${nProbable.toLocaleString()} opps`} />
        <KpiCard label="Upside"                  value={formatAcvK(acvUpside, currency)}                sub={`${nUpside.toLocaleString()} opps`} />
        <KpiCard label="Excluded fr. Pipeline"   value={formatAcvK(acvExcl,   currency)}                sub={`${nExcluded.toLocaleString()} opps`} />
        <KpiCard label="Disc / Lost"             value={formatAcvK(acvLost,   currency)} color="red"    sub={`${nLost.toLocaleString()} opps`} />
      </div>

      {/* Conversion Rate + Digital */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <KpiCard label="Conversion Rate"  value={`${winRate}%`}
          color={Number(winRate) >= 30 ? 'green' : Number(winRate) >= 15 ? 'orange' : 'red'}
          sub="Booked ÷ (Booked + Disc/Lost)" />
        <KpiCard label="Digital Booked"   value={nDigital.toLocaleString()} color="blue" sub="digital engagements" />
        <div className="card px-4 py-2 col-span-2 flex items-center gap-6 text-sm">
          <span className="text-sap-subtle text-xs font-semibold">vs prior week</span>
          <span className="flex items-center gap-1.5">Booked: <Delta curr={bookedRows.length} prev={prevBooked.length} /></span>
          <span className="flex items-center gap-1.5">ACV: <Delta curr={sumBy(bookedRows,'acv_usd')*fx} prev={sumBy(prevBooked,'acv_usd')*fx} /></span>
          <span className="flex items-center gap-1.5">Lost: <Delta curr={lostRows.length} prev={prevLost.length} good="down" /></span>
        </div>
      </div>

      {/* ── 2. LoB Breakdown ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Results by Line of Business</SectionLabel>
        <div className="flex items-center gap-3">
          {filters.closing_qtrs.length > 0 && lobTab === 'yoy' && (
            <span className="text-[11px] text-sap-muted bg-[#e8f4e8] border border-[#a5d6a7] rounded px-2 py-0.5">
              ✓ 2026 quarters mapped to same quarters in 2025
            </span>
          )}
          <div className="flex gap-1">
            {(['current', 'yoy'] as const).map(t => (
              <button key={t} onClick={() => setLobTab(t)}
                className={`text-[11px] font-semibold px-3 py-1 rounded-lg border transition ${
                  lobTab === t ? 'bg-sap-blue text-white border-sap-blue' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
                }`}>
                {t === 'current' ? 'Current Period' : 'vs 2025'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-sap-blue text-white text-[11px] uppercase tracking-wide">
              <th className="py-2 px-3 text-left">Line of Business</th>
              <th className="py-2 px-2 text-center" colSpan={2}>Booked / Won</th>
              <th className="py-2 px-2 text-center">Commit</th>
              <th className="py-2 px-2 text-center">Probable</th>
              <th className="py-2 px-2 text-center">Upside</th>
              <th className="py-2 px-2 text-center">Excl.</th>
              <th className="py-2 px-2 text-center">Lost</th>
              <th className="py-2 px-2 text-center">Conv %</th>
              {lobTab === 'yoy' && <>
                <th className="py-2 px-2 text-center border-l border-dashed border-blue-300" colSpan={3}>2025 (Booked / ACV / Conv)</th>
                <th className="py-2 px-2 text-center" colSpan={2}>YoY Δ</th>
              </>}
            </tr>
            <tr className="bg-[#e8f0f7] text-sap-muted text-[10px]">
              <th className="py-1 px-3 text-left">LoB</th>
              <th className="py-1 px-2 text-center">#</th>
              <th className="py-1 px-2 text-center">ACV</th>
              <th className="py-1 px-2 text-center">#</th>
              <th className="py-1 px-2 text-center">#</th>
              <th className="py-1 px-2 text-center">#</th>
              <th className="py-1 px-2 text-center">#</th>
              <th className="py-1 px-2 text-center">#</th>
              <th className="py-1 px-2 text-center">%</th>
              {lobTab === 'yoy' && <>
                <th className="py-1 px-2 text-center border-l border-dashed border-sap-border">#</th>
                <th className="py-1 px-2 text-center">ACV</th>
                <th className="py-1 px-2 text-center">%</th>
                <th className="py-1 px-2 text-center">Δ#</th>
                <th className="py-1 px-2 text-center">ΔACV</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {topLobs.map(r => (
              <>
                <LobRow key={r.lob} r={r} fx={fx} currency={currency} />
                {r.lob === 'Finance & Spend Management' &&
                  financeSubs.map(s => (
                    <LobRow key={s.lob} r={s} fx={fx} currency={currency} isChild />
                  ))
                }
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 3. Charts ──────────────────────────────────────────────────────── */}
      <SectionLabel>Booked vs Disc/Lost by Quarter</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={{
          title: { text: '# Opps Booked/Won vs Disc/Lost by Quarter', textStyle: { fontSize: 13, fontWeight: 600 } },
          legend: { data: ['Booked/Won', 'Disc/Lost'] },
          xAxis: { type: 'category', data: allQtrs },
          yAxis: { type: 'value' },
          series: [
            { name: 'Booked/Won', type: 'bar', data: allQtrs.map(q => bookedQtrMap[q] ?? 0), itemStyle: { color: '#256f3a' } },
            { name: 'Disc/Lost',  type: 'bar', data: allQtrs.map(q => lostQtrMap[q]   ?? 0), itemStyle: { color: '#aa0808' } },
          ],
        }} />
        <EChart option={{
          title: { text: `ACV Booked by Region (${currency})`, textStyle: { fontSize: 13, fontWeight: 600 } },
          grid: { left: 16, right: 70, top: 40, bottom: 16, containLabel: true },
          xAxis: { type: 'value' },
          yAxis: { type: 'category', data: bookedRegion.map(r => r.label) },
          series: [{ type: 'bar', data: bookedRegion.map(r => r.acv * fx), itemStyle: { color: '#256f3a' } }],
        }} />
      </div>

      <SectionLabel>Booked by Solution L1 / FC Mix (Active Pipeline)</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={{
          title: { text: `ACV Booked by Solution L1 (${currency})`, textStyle: { fontSize: 13, fontWeight: 600 } },
          grid: { left: 16, right: 70, top: 40, bottom: 16, containLabel: true },
          xAxis: { type: 'value' },
          yAxis: { type: 'category', data: bookedSolL1.map(r => r.label) },
          series: [{ type: 'bar', data: bookedSolL1.map(r => r.acv * fx), itemStyle: { color: '#256f3a' } }],
        }} />
        <EChart option={{
          title: { text: `Active Pipeline FC Mix (${currency})`, textStyle: { fontSize: 13, fontWeight: 600 } },
          series: [{
            type: 'pie', radius: '60%',
            data: fcData.map(r => ({
              name: r.label,
              value: +(r.acv * fx / 1000).toFixed(1),
              itemStyle: { color: DRM_COLORS[r.label] ?? '#788fa6' },
            })),
          }],
        }} />
      </div>

      {/* ── LoB ACV bar chart ─────────────────────────────────────────────── */}
      <SectionLabel>ACV Booked by LoB — Current vs 2025</SectionLabel>
      <EChart height={360} option={{
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: (p: any) => `<b>${p[0]?.axisValue}</b><br/>${p.map((s: any) => `${s.marker}${s.seriesName}: <b>${s.value >= 1000 ? (s.value/1000).toFixed(1)+'M' : s.value+'K'}</b>`).join('<br/>')}` },
        legend: {
          data: ['Current', '2025'],
          bottom: 0,
          itemWidth: 14, itemHeight: 10,
          textStyle: { fontSize: 12, color: '#32363A' },
        },
        grid: { top: 24, bottom: 52, left: 16, right: 16, containLabel: true },
        xAxis: {
          type: 'category',
          data: topLobs.map(r => r.lob
            .replace('Business Transformation Mgmt', 'BTM')
            .replace('Human Capital Management', 'HCM')
            .replace('Customer Experience', 'CX')
            .replace('Finance & Spend Management', 'Finance')
            .replace('BAIP - Technology Foundation', 'BAIP TF')
            .replace('BAIP - Data & AI', 'BAIP D&AI')
            .replace('Cloud ERP Private', 'Cloud ERP')
          ),
          axisLabel: { rotate: 15, fontSize: 11, interval: 0 },
          axisTick: { show: false },
        },
        yAxis: { type: 'value',
          axisLabel: { formatter: (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}M` : `${v}K`, fontSize: 10 },
          splitLine: { lineStyle: { type: 'dashed', color: '#f0f1f2' } },
        },
        series: [
          { name: 'Current', type: 'bar', barGap: '10%', barCategoryGap: '30%',
            data: topLobs.map(r => +(r.acv_booked * fx / 1000).toFixed(1)),
            itemStyle: { color: '#0070f2', borderRadius: [3,3,0,0] },
            label: { show: true, position: 'top', fontSize: 10, fontWeight: 600, color: '#0070f2',
              formatter: (p: any) => p.value >= 1000 ? `${(p.value/1000).toFixed(1)}M` : `${p.value}K` } },
          { name: '2025', type: 'bar',
            data: topLobs.map(r => +(r.prev_acv_booked * fx / 1000).toFixed(1)),
            itemStyle: { color: '#c4d9f0', borderRadius: [3,3,0,0] },
            label: { show: true, position: 'top', fontSize: 10, color: '#788fa6',
              formatter: (p: any) => p.value >= 1000 ? `${(p.value/1000).toFixed(1)}M` : `${p.value}K` } },
        ],
      }} />

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <BagFilterBar bagFilter={lacBagFilter} setBagFilter={setLacBagFilter} singleCount={lacSingleCount} basketCount={lacBasketCount} />
      <div className="flex items-center justify-between mb-2 mt-4">
        <SectionLabel>Top Booked / Won Opportunities</SectionLabel>
        <div className="flex gap-2">
        <ColVisibilityPanel visibleCols={lacVisibleCols} allColDefs={cols.map((c:any)=>({key:c.field==='opportunity_id'?'oppId':c.field,header:c.headerName||c.field}))} lobKeys={true} onToggle={lacToggleCol} onShowAll={lacShowAll} onReset={lacResetCols} open={lacPanelOpen} setOpen={setLacPanelOpen} />
        <ExcelDownloadButton rows={lacBagRows} cols={lacVisibleColDefs} defaultFilename="lac_results_booked.xlsx" sheetName="Booked Won"
          className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
        />
        </div>
      </div>
      <p className="text-xs text-sap-subtle mb-2">{nBooked.toLocaleString()} Booked/Won total (showing {bookedRows.length.toLocaleString()} in table)</p>
      {isLoading
        ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
        : <DataTable rows={lacBagRows} cols={lacVisibleColDefs} height={480} />
      }
    </div>
  )
}
