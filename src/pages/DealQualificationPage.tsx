// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { DataTable } from '../components/DataTable'
import { EChart } from '../components/EChart'
import { PptxExportButton } from '../components/PptxExportButton'
import { ColVisibilityPanel, BagFilterBar } from '../components/PipelineTableExtras'
import { useColVisibility, useBagFilter, buildLobAcvCols, engagementCellStyle, LOB_COL_DEFS } from '../lib/pipelineTableHelpers'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatAcvK, acvCol } from '../lib/utils'
import type { ColDef } from 'ag-grid-community'
import { exportToExcel } from '../lib/exportExcel'
import { presalesStatusCol, qualDecisionCol } from '../lib/presalesHelpers'
import { ExcelDownloadButton } from '../components/ExcelDownloadButton'
import { oppIdCol } from '../components/OppIdCol'
import { PipelineFilterBar } from '../components/PipelineFilterBar'
import { usePipelineFilters } from '../lib/usePipelineFilters'

type Row = Record<string, unknown>

const DEC_COLORS: Record<string,string> = {
  'Qualified':'#256f3a','In Qualification':'#0070f2','Not Qualified':'#aa0808','De-qualified':'#e76500',
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key] ?? 'Unknown')
    ;(acc[k] ??= []).push(item)
    return acc
  }, {} as Record<string, T[]>)
}
function sumBy<T>(arr: T[], key: keyof T): number {
  return arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)
}
function meanBy<T>(arr: T[], key: keyof T): number {
  const valid = arr.map(r => Number(r[key])).filter(v => !isNaN(v) && v > 0)
  return valid.length ? valid.reduce((a,b) => a+b, 0) / valid.length : 0
}

export function DealQualificationPage() {
  const { currency, fxRate } = useAuth()

  const [excludeNeg, setExcludeNeg] = useState(false)
  const { filters, params, debouncedParams, toggle, set: setFilter, clear: clearFilters } = usePipelineFilters()

  const { data: opts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => api.get('/api/pipeline/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // Pipeline KPIs (server-side, full dataset)
  const [includePurchase, setIncludePurchase] = useState(false)
  const kpiParams = {
    ...debouncedParams,
    ...(excludeNeg ? { exclude_neg: true } : {}),
    ...(includePurchase ? { include_purchase: true } : {}),
  }

  const { data: kpis = {} } = useQuery({
    queryKey: ['pipeline-kpis', kpiParams],
    queryFn: () => api.get('/api/pipeline/kpis', { params: kpiParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  // Server-side chart aggregations — complete dataset
  const { data: charts = {} } = useQuery({
    queryKey: ['pipeline-charts', kpiParams],
    queryFn: () => api.get('/api/pipeline/charts', { params: kpiParams }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const nBooked   = Number(kpis.n_booked    || 0)
  const nCommit   = Number(kpis.n_committed  || 0)
  const nProbable = Number(kpis.n_probable   || 0)
  const nUpside   = Number(kpis.n_upside     || 0)
  const nExcluded = Number(kpis.n_excluded   || 0)
  const nLost     = Number(kpis.n_lost       || 0)

  const { data: rows = [] as Row[], isLoading } = useQuery({
    queryKey: ['pipeline', kpiParams],
    queryFn: () => api.get('/api/pipeline', { params: {...kpiParams, deduplicate: true, limit: 20000} }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const filteredRows = useMemo(() => excludeNeg ? rows.filter(r => (Number(r.acv_usd)||0) > 0) : rows, [rows, excludeNeg])
  const scored = useMemo(() => filteredRows.filter(r => r.deal_qualification_score != null && Number(r.deal_qualification_score) > 0), [filteredRows])

  const fx = fxRate
  const nScored   = scored.length
  const avgScore  = nScored > 0 ? meanBy(scored, 'deal_qualification_score').toFixed(1) : '—'
  const nQual     = scored.filter(r => r.deal_qualification_decision === 'Qualified').length
  const nInQual   = scored.filter(r => r.deal_qualification_decision === 'In Qualification').length
  const acvScored = sumBy(scored, 'acv_usd') * fx

  // Score histogram
  const scoreValues = scored.map(r => Number(r.deal_qualification_score)).filter(Boolean)
  const histBins = 20
  const minS = Math.min(...scoreValues, 0), maxS = Math.max(...scoreValues, 100)
  const binSize = (maxS - minS) / histBins
  const histData = Array.from({ length: histBins }, (_, i) => {
    const lo = minS + i * binSize, hi = lo + binSize
    return scoreValues.filter(v => v >= lo && v < hi).length
  })
  const histLabels = Array.from({ length: histBins }, (_, i) => `${Math.round(minS + i * binSize)}-${Math.round(minS + (i+1) * binSize)}`)

  // Decision bar
  const decGroups  = groupBy(scored, 'deal_qualification_decision')
  const decEntries = Object.entries(decGroups).map(([k, v]) => [k, v.length] as [string, number]).sort((a,b) => b[1]-a[1])

  // Scatter data
  const scatterData = scored.filter(r => (Number(r.acv_total_opp)||0) > 0).map(r => [
    Number(r.deal_qualification_score), +(Number(r.acv_total_opp) * fx / 1000).toFixed(1),
    String(r.opp_phase ?? ''), String(r.account_name ?? ''),
  ])

  // Avg score by solution l1
  const solGroups  = groupBy(scored, 'solution_area_l1')
  const solScores  = Object.entries(solGroups).map(([k, v]) => [k, +meanBy(v,'deal_qualification_score').toFixed(1)] as [string, number]).sort((a,b)=>a[1]-b[1])

  // Avg score by engagement type
  const engGroups  = groupBy(scored, 'engagement_type')
  const engScores  = Object.entries(engGroups).map(([k, v]) => [k, +meanBy(v,'deal_qualification_score').toFixed(1)] as [string, number]).sort((a,b)=>a[1]-b[1])

  // ACV by decision
  const decACV = Object.entries(decGroups).map(([k, v]) => [k, +(sumBy(v,'acv_usd')*fx/1000).toFixed(1)] as [string, number])

  const cols: ColDef[] = [
    oppIdCol,
    { field: 'account_name',               headerName: 'Account',    flex: 1, minWidth: 140 },
    { field: 'opp_owner_name',             headerName: 'Owner',      width: 140 },
    { field: 'opp_phase',                  headerName: 'Phase',      width: 130 },
    { field: 'fc_qualification',           headerName: 'FC Qual',    width: 110 },
    { field: 'deal_qualification_score',   headerName: 'Score',      width: 80 },
    { ...presalesStatusCol(110) },
    { ...qualDecisionCol(140) },
    { field: 'engagement_type',            headerName: 'Engagement', width: 110, cellStyle: engagementCellStyle },
    { field: 'vat_dh',                     headerName: 'Digital SA', width: 160 },
    acvCol('acv_total_opp', fx, currency, `ACV K (${currency})`, 150),
    ...buildLobAcvCols(fx, currency),
    { field: 'iss_group_text',             headerName: 'ISS Group', width: 130 },
    { field: 'iac',                      headerName: 'IAC',        width: 130 },
    { field: 'closing_qtr',                headerName: 'Closing Qtr',width: 110 },
    { field: 'drm_category',               headerName: 'DRM Cat',    width: 110 },
  ]

  const exportCSV = () => {
    exportToExcel(filteredRows, 'deal_qualification.xlsx', 'Deal Qualification', cols)
  }

  const ALL_COL_KEYS = cols.map((c:any) => c.field === 'opportunity_id' ? 'oppId' : c.field).filter(Boolean)
  const DEFAULT_KEYS = ALL_COL_KEYS.filter((k:string) => !k.startsWith('acv_l1_'))
  const { visibleCols, panelOpen, setPanelOpen, toggleCol, showAll, resetCols } = useColVisibility(ALL_COL_KEYS, DEFAULT_KEYS)
  const { bagFilter, setBagFilter, filteredRows: bagRows, singleCount, basketCount } = useBagFilter(filteredRows)
  const visibleColDefs = cols.filter((c:any) => visibleCols.has(c.field === 'opportunity_id' ? 'oppId' : c.field))


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-sap-text">Deal Qualification Report</h2>
        <PptxExportButton label="Export PPT" getPayload={() => ({
          page: 'deal_qual',
          title: 'Deal Qualification Report',
          subtitle: `${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,
          currency,
          kpis: [
            { label:'Scored Opps', value:String(nScored), color:'blue' },
            { label:'Avg Score',   value:String(avgScore) },
            { label:'Qualified',   value:String(nQual),   color:'green' },
            { label:'In Qual.',    value:String(nInQual),  color:'orange' },
          ],
          bar_charts: [
            { title:'Decisions',            data:decEntries.map(([l,v])=>({label:l,value:v})) },
            { title:'Avg Score by Sol. L1', data:solScores.map(([l,v])=>({label:l,value:v})) },
          ],
        })} />
      </div>
      <hr className="border-sap-border mb-4" />

      <PipelineFilterBar filters={filters} opts={opts} toggle={toggle} set={setFilter} clear={clearFilters} />

      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => setExcludeNeg(e => !e)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${excludeNeg ? 'bg-[#aa0808] text-white border-[#aa0808]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'}`}>
          {excludeNeg ? '✕ Excl. Negatives (on)' : '≠ Excl. Negatives'}
        </button>
        {excludeNeg && <span className="text-[11px] text-[#aa0808] font-medium">Excluding rows with ACV ≤ 0</span>}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => setIncludePurchase(e => !e)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
            includePurchase ? 'bg-[#256f3a] text-white border-[#256f3a]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
          }`}>
          {includePurchase ? '✓ A-Purchase as Booked' : '+ Include A-Purchase'}
        </button>
        {includePurchase && <span className="text-[11px] text-[#256f3a] font-medium">Opp Phase = A-Purchase counted as Booked</span>}
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
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="ACV Scored"            value={formatAcvK(acvScored, currency)} color="green" sub={`${nScored.toLocaleString()} opps scored`} />
        <KpiCard label="Avg Qual Score"        value={avgScore} sub="qualification score" />
        <KpiCard label="# Qualified"           value={nQual.toLocaleString()} color="green" sub="qualified opps" />
        <KpiCard label="# In Qualification"    value={nInQual.toLocaleString()} sub="in qualification" />
      </div>

      <SectionLabel>Score Distribution / Qualification Decision</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={{
          title: { text: 'Score Distribution', textStyle: { fontSize: 13, fontWeight: 600 } },
          xAxis: { type: 'category', data: histLabels },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: histData, itemStyle: { color: '#0070f2' } }],
        }} />
        <EChart option={{
          title: { text: '# Opps by Qualification Decision', textStyle: { fontSize: 13, fontWeight: 600 } },
          xAxis: { type: 'category', data: decEntries.map(([k])=>k) },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: decEntries.map(([k,v]) => ({ value: v, itemStyle: { color: (DEC_COLORS as Record<string,string>)[k] ?? '#788fa6' } })) }],
        }} />
      </div>

      <SectionLabel>Score vs ACV Scatter / Avg Score by Solution</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={{
          title: { text: `Score vs ACV (k${currency}) by Opp Phase`, textStyle: { fontSize: 13, fontWeight: 600 } },
          xAxis: { type: 'value', name: 'Score' },
          yAxis: { type: 'value', name: `ACV (k${currency})` },
          series: [{ type: 'scatter', data: scatterData.map(d => [d[0], d[1]]), symbolSize: 8, itemStyle: { color: '#0070f2', opacity: 0.7 } }],
        }} />
        <EChart option={{
          title: { text: 'Avg Score by Solution L1', textStyle: { fontSize: 13, fontWeight: 600 } },
          grid: { left: 16, right: 60, top: 40, bottom: 16, containLabel: true },
          xAxis: { type: 'value', max: 100 },
          yAxis: { type: 'category', data: solScores.map(([k])=>k) },
          series: [{ type: 'bar', data: solScores.map(([,v])=>v), itemStyle: { color: '#4cb1ff' },
            label: { show: true, position: 'right' } }],
        }} />
      </div>

      <SectionLabel>Avg Score by Engagement / ACV by Decision</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <EChart option={{
          title: { text: 'Avg Score by Engagement Type', textStyle: { fontSize: 13, fontWeight: 600 } },
          grid: { left: 16, right: 60, top: 40, bottom: 16, containLabel: true },
          xAxis: { type: 'value', max: 100 },
          yAxis: { type: 'category', data: engScores.map(([k])=>k) },
          series: [{ type: 'bar', data: engScores.map(([k,v]) => ({ value: v, itemStyle: { color: k === 'Digital' ? '#0070f2' : k === 'Field' ? '#4cb1ff' : '#d9d9d9' } })),
            label: { show: true, position: 'right' } }],
        }} />
        <EChart option={{
          title: { text: `ACV by Qualification Decision (${currency})`, textStyle: { fontSize: 13, fontWeight: 600 } },
          xAxis: { type: 'category', data: (charts.by_qual_decision ?? []).map((r: {label: string}) => r.label) },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: (charts.by_qual_decision ?? []).map((r: {label: string; acv: number}) => ({
            value: r.acv * fx,
            itemStyle: { color: (DEC_COLORS as Record<string,string>)[r.label] ?? '#788fa6' },
          })) }],
        }} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Opportunity Detail</SectionLabel>
        <ExcelDownloadButton
          rows={filteredRows} cols={cols}
          defaultFilename="deal_qualification.xlsx" sheetName="Deal Qualification"
          className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
        />
      </div>
      <p className="text-xs text-sap-subtle mb-2">{rows.length.toLocaleString()} opportunities after filters</p>
      {isLoading
        ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
        : <DataTable rows={bagRows} cols={visibleColDefs} height={480} />
      }
    </div>
  )
}
