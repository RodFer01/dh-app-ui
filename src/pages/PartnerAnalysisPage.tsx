// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { ChevronDown, BarChart2 } from 'lucide-react'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { EChart } from '../components/EChart'
import { DataTable } from '../components/DataTable'
import { PipelineFilterBar } from '../components/PipelineFilterBar'
import { ColVisibilityPanel } from '../components/PipelineTableExtras'
import { ExcelDownloadButton } from '../components/ExcelDownloadButton'
import { usePipelineFilters } from '../lib/usePipelineFilters'
import { useColVisibility, buildLobAcvCols, engagementCellStyle } from '../lib/pipelineTableHelpers'
import { acvCol } from '../lib/utils'
import { presalesStatusCol, qualDecisionCol } from '../lib/presalesHelpers'
import { oppIdCol } from '../components/OppIdCol'
import { useAuth } from '../context/AuthContext'
import { formatAcvK } from '../lib/utils'
import api from '../lib/api'
import { BuildingBlockChart } from '../components/BuildingBlockChart'
import { OppDetailPanel, BLANK_NOTE_FORM } from '../components/OppDetailPanel'

const DRM_COLORS: Record<string, string> = {
  Committed: '#0070f2',
  Probable:  '#4cb1ff',
  Upside:    '#a8d4f5',
  Pipeline:  '#c0d4e8',
  'Booked/Won': '#1a7f4b',
}

const fetch = (url: string, params: Record<string, any> = {}) =>
  api.get(url, { params }).then(r => r.data)

const moneyK = (v: number | null | undefined) =>
  v == null ? '—' : `$${(v / 1000).toFixed(0)}K`

const TOP_N = 15  // max partners shown in charts

function CollapsibleFrame({ title, subtitle, open, onToggle, children }: any) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <BarChart2 size={14} className="text-blue-500 flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 flex-1">
          {title}
          {subtitle && <span className="font-normal text-gray-400 ml-1.5">{subtitle}</span>}
        </span>
        <button onClick={onToggle} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
          <ChevronDown size={13} className={`transition-transform ${open ? '' : '-rotate-180'}`} />
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

export default function PartnerAnalysisPage() {
  const { filters, debouncedParams, set, clear } = usePipelineFilters()
  const { currency, fxRate } = useAuth()
  const fx = fxRate

  const [demoDateFrom, setDemoDateFrom] = useState('')
  const [demoDateTo, setDemoDateTo]     = useState('')
  const [demoOppMainSolL2, setDemoOppMainSolL2] = useState('')
  const [demoLobFilters, setDemoLobFilters] = useState<string[]>([])
  const [demoL3Filters, setDemoL3Filters] = useState<string[]>([])
  const [demoL4Filters, setDemoL4Filters] = useState<string[]>([])
  const [demoOpen, setDemoOpen]         = useState(false)
  const [demoL3Open, setDemoL3Open]     = useState(false)
  const [demoL4Open, setDemoL4Open]     = useState(false)
  const [engagementOpen, setEngagementOpen] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [selectedOpp, setSelectedOpp] = useState<any>(null)
  const [noteForm, setNoteForm] = useState(BLANK_NOTE_FORM)
  const qc = useQueryClient()

  // Filter options
  const { data: opts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => fetch('/api/pipeline/filters'),
    staleTime: 5 * 60_000,
  })

  const { data: melodyOpts = {} } = useQuery({
    queryKey: ['melody-filters'],
    queryFn: () => fetch('/api/melody/filters'),
    staleTime: 5 * 60_000,
  })

  // Partner summary (opps + ACV per partner)
  const { data: summaryRows = [], isLoading: summaryLoading } = useQuery({
    queryKey: ['partner-summary', debouncedParams],
    queryFn: () => fetch('/api/partner-analysis/summary', debouncedParams),
  })

  // Partner × Solution Area
  const { data: bysolRows = [] } = useQuery({
    queryKey: ['partner-by-solution', debouncedParams],
    queryFn: () => fetch('/api/partner-analysis/by-solution', debouncedParams),
  })

  // Demo activity — pass ALL debouncedParams so region/segment/etc. filters apply
  const demoParams = useMemo(() => ({
    ...debouncedParams,
    ...(demoDateFrom && { date_from: demoDateFrom }),
    ...(demoDateTo   && { date_to: demoDateTo }),
    ...(demoOppMainSolL2 && { opp_main_sol_l2: demoOppMainSolL2 }),
  }), [debouncedParams, demoDateFrom, demoDateTo, demoOppMainSolL2])

  const { data: demoRows = [] } = useQuery({
    queryKey: ['partner-demo-activity', demoParams],
    queryFn: () => fetch('/api/partner-analysis/demo-activity', demoParams),
  })

  const { data: demoL3Rows = [] } = useQuery({
    queryKey: ['partner-demo-activity-l3', demoParams, demoLobFilters],
    queryFn: () => fetch('/api/partner-analysis/demo-activity-l3', {
      ...demoParams,
      ...(demoLobFilters.length && { opp_main_sol_l2s: demoLobFilters }),
    }),
  })

  const { data: demoL4Rows = [] } = useQuery({
    queryKey: ['partner-demo-activity-l4', demoParams, demoLobFilters],
    queryFn: () => fetch('/api/partner-analysis/demo-activity-l4', {
      ...demoParams,
      ...(demoLobFilters.length && { opp_main_sol_l2s: demoLobFilters }),
    }),
  })

  // Partner detail (drill-down)
  const { data: detailRows = [] } = useQuery({
    queryKey: ['partner-demo-detail', selectedPartner, demoDateFrom, demoDateTo],
    queryFn: () => fetch('/api/partner-analysis/demo-by-partner', {
      partner: selectedPartner,
      ...(demoDateFrom && { date_from: demoDateFrom }),
      ...(demoDateTo   && { date_to: demoDateTo }),
    }),
    enabled: !!selectedPartner,
  })

  // Partner opportunity table — only when a partner is selected or channel_partners filter is active
  const canFetchOpps = !!(selectedPartner || debouncedParams.channel_partners?.length)

  const partnerOppParams = useMemo(() => {
    if (selectedPartner) {
      return { ...debouncedParams, channel_partners: [selectedPartner] }
    }
    return debouncedParams
  }, [debouncedParams, selectedPartner])

  const { data: partnerOppRows = [], isFetching: oppFetching } = useQuery({
    queryKey: ['partner-opps', partnerOppParams],
    queryFn: () => fetch('/api/pipeline', partnerOppParams),
    enabled: canFetchOpps,
  })

  // ── Engagement type aggregation (from partnerOppRows) ─────────────────────
  const { engagementOppsOption, engagementAcvOption, engagementTotalOpps } = useMemo(() => {
    const TYPES = ['No Engagement', 'Field', 'Digital']
    const counts: Record<string, number> = { 'No Engagement': 0, Field: 0, Digital: 0 }
    const acvs: Record<string, number>   = { 'No Engagement': 0, Field: 0, Digital: 0 }
    for (const r of partnerOppRows) {
      const raw = (r.engagement_type || '').trim()
      const key = TYPES.includes(raw) ? raw : 'No Engagement'
      counts[key]++
      acvs[key] += r.acv_total_opp || 0
    }
    const oppsOption: EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      title: { text: '# Opportunities by Engagement Type', left: 'center', textStyle: { fontSize: 13, fontWeight: 600 } },
      grid: { left: 16, right: 16, top: 44, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: TYPES, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: '# Opps', axisLabel: { fontSize: 10, color: '#788fa6' } },
      series: [{ type: 'bar', data: TYPES.map(t => counts[t]), itemStyle: { color: '#0070f2' },
        label: { show: true, position: 'top', fontSize: 11, formatter: '{c}' } }],
    }
    const acvOption: EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => `<b>${params[0]?.axisValue}</b>: ${moneyK(params[0]?.value)}` },
      title: { text: 'ACV K (USD) by Engagement Type', left: 'center', textStyle: { fontSize: 13, fontWeight: 600 } },
      grid: { left: 16, right: 16, top: 44, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: TYPES, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: 'K (USD)', axisLabel: { fontSize: 10, color: '#788fa6', formatter: (v: number) => moneyK(v) } },
      series: [{ type: 'bar', data: TYPES.map(t => acvs[t]), itemStyle: { color: '#2d6a4f' },
        label: { show: true, position: 'top', fontSize: 11, formatter: (p: any) => moneyK(p.value) } }],
    }
    return { engagementOppsOption: oppsOption, engagementAcvOption: acvOption, engagementTotalOpps: partnerOppRows.length }
  }, [partnerOppRows])

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

  // ── Aggregate KPIs ──────────────────────────────────────────────────────────
  const totalOpps       = summaryRows.reduce((s, r) => s + (r.n_opps || 0), 0)
  const totalAcv        = summaryRows.reduce((s, r) => s + (r.total_acv || 0), 0)
  const totalPartners   = summaryRows.length
  const totalDemoActivities = demoRows.reduce((s, r) => s + (r.n_activities || 0), 0)

  // ── Chart: Partners vs # Opps (top N, horizontal bar) ──────────────────────
  const oppsChartOption = useMemo<EChartsOption>(() => {
    const top = [...summaryRows].slice(0, TOP_N).reverse()
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => `<b>${params[0]?.axisValue}</b>: ${params[0]?.value} opps` },
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6' } },
      yAxis: { type: 'category', data: top.map(r => r.partner), axisLabel: { fontSize: 11, width: 200, overflow: 'truncate' } },
      series: [{
        type: 'bar', data: top.map(r => r.n_opps),
        itemStyle: { color: '#0070f2' },
        label: { show: true, position: 'right', fontSize: 10, formatter: '{c}' },
      }],
    }
  }, [summaryRows])

  // ── Chart: Partners vs ACV (stacked by DRM) ────────────────────────────────
  const acvChartOption = useMemo<EChartsOption>(() => {
    const top = [...summaryRows].slice(0, TOP_N).reverse()
    const drms = ['Pipeline', 'Upside', 'Probable', 'Committed']
    const acvFields: Record<string, string> = {
      'Pipeline': 'acv_pipeline', 'Upside': 'acv_upside',
      'Probable': 'acv_probable', 'Committed': 'acv_committed',
    }
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any[]) =>
          `<b>${params[0]?.axisValue}</b><br/>` +
          params.map(p => `${p.marker}${p.seriesName}: <b>${moneyK(p.value)}</b>`).join('<br/>'),
      },
      legend: { data: drms, bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 8, right: 24, top: 8, bottom: 36, containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6', formatter: (v: number) => moneyK(v) } },
      yAxis: { type: 'category', data: top.map(r => r.partner), axisLabel: { fontSize: 11, width: 200, overflow: 'truncate' } },
      series: drms.map(drm => ({
        name: drm, type: 'bar', stack: 'total',
        itemStyle: { color: DRM_COLORS[drm] ?? '#aaa' },
        data: top.map(r => r[acvFields[drm]] ?? 0),
        label: { show: false },
      })),
    }
  }, [summaryRows])

  // ── Chart: Partner × Solution Area (stacked bar) ───────────────────────────
  const bysolChartOption = useMemo<EChartsOption>(() => {
    const partners = [...new Set(bysolRows.map(r => r.partner))].slice(0, 12)
    const sols     = [...new Set(bysolRows.map(r => r.sol_l1))]
      .filter(Boolean)
      .sort((a, b) => {
        const ta = bysolRows.filter(r => r.sol_l1 === a).reduce((s, r) => s + r.total_acv, 0)
        const tb = bysolRows.filter(r => r.sol_l1 === b).reduce((s, r) => s + r.total_acv, 0)
        return tb - ta
      })
      .slice(0, 8)

    const palette = ['#0070f2','#e66a2c','#1a7f4b','#a020f0','#c00000','#0080a0','#f0a000','#408060']

    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any[]) =>
          `<b>${params[0]?.axisValue}</b><br/>` +
          params.filter(p => p.value > 0)
            .map(p => `${p.marker}${p.seriesName}: <b>${moneyK(p.value)}</b>`).join('<br/>'),
      },
      legend: { data: sols, bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: 8, right: 16, top: 8, bottom: 52, containLabel: true },
      xAxis: { type: 'category', data: partners, axisLabel: { rotate: 35, fontSize: 10, width: 120, overflow: 'truncate' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6', formatter: (v: number) => moneyK(v) } },
      series: sols.map((sol, i) => ({
        name: sol, type: 'bar', stack: 'total',
        itemStyle: { color: palette[i % palette.length] },
        data: partners.map(p => {
          const r = bysolRows.find(x => x.partner === p && x.sol_l1 === sol)
          return r?.total_acv ?? 0
        }),
        label: { show: false },
      })),
    }
  }, [bysolRows])

  // ── Chart: Demo Activity by Partner × SA LoB ───────────────────────────────
  const availableLobs = useMemo(() =>
    [...new Set(demoRows.map((r: any) => r.opp_main_sol_l2))].filter(Boolean).sort() as string[]
  , [demoRows])

  const filteredDemoRows = useMemo(() =>
    demoLobFilters.length ? demoRows.filter((r: any) => demoLobFilters.includes(r.opp_main_sol_l2)) : demoRows
  , [demoRows, demoLobFilters])

  const demoChartOption = useMemo<EChartsOption>(() => {
    const partners = [...new Set(filteredDemoRows.map(r => r.partner))].slice(0, 12)
    const sols     = [...new Set(filteredDemoRows.map(r => r.opp_main_sol_l2))].filter(l => l && l !== 'Not Specified')
    if (filteredDemoRows.find(r => r.opp_main_sol_l2 === 'Not Specified')) sols.push('Not Specified')

    const lobPalette = ['#0070f2','#e66a2c','#1a7f4b','#a020f0','#c00000','#0080a0','#f0a000','#408060','#808080']

    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any[]) =>
          `<b>${params[0]?.axisValue}</b><br/>` +
          params.filter(p => p.value > 0)
            .map(p => `${p.marker}${p.seriesName}: <b>${p.value}</b> activities`).join('<br/>'),
      },
      legend: { data: sols, bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: 8, right: 16, top: 8, bottom: 52, containLabel: true },
      xAxis: { type: 'category', data: partners, axisLabel: { rotate: 35, fontSize: 10, width: 120, overflow: 'truncate' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6' } },
      series: sols.map((sol, i) => ({
        name: sol, type: 'bar', stack: 'total',
        itemStyle: { color: lobPalette[i % lobPalette.length] },
        data: partners.map(p => {
          const r = filteredDemoRows.find(x => x.partner === p && x.opp_main_sol_l2 === sol)
          return r?.n_activities ?? 0
        }),
        label: { show: false },
      })),
    }
  }, [filteredDemoRows])

  // ── Chart: Demo Activity by Partner × Opp Solution L3 ────────────────────
  const availableL3s = useMemo(() =>
    [...new Set(demoL3Rows.map((r: any) => r.opp_main_sol_l3))].filter(Boolean).sort() as string[]
  , [demoL3Rows])

  const filteredDemoL3Rows = useMemo(() =>
    demoL3Filters.length ? demoL3Rows.filter((r: any) => demoL3Filters.includes(r.opp_main_sol_l3)) : demoL3Rows
  , [demoL3Rows, demoL3Filters])

  const demoL3ChartOption = useMemo<EChartsOption>(() => {
    const partners = [...new Set(filteredDemoL3Rows.map(r => r.partner))].slice(0, 12)
    const sols = [...new Set(filteredDemoL3Rows.map(r => r.opp_main_sol_l3))].filter(l => l && l !== 'Not Specified')
    if (filteredDemoL3Rows.find(r => r.opp_main_sol_l3 === 'Not Specified')) sols.push('Not Specified')
    const pal = ['#0070f2','#e66a2c','#1a7f4b','#a020f0','#c00000','#0080a0','#f0a000','#408060','#808080']
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => `<b>${params[0]?.axisValue}</b><br/>` +
          params.filter(p => p.value > 0).map(p => `${p.marker}${p.seriesName}: <b>${p.value}</b> activities`).join('<br/>') },
      legend: { data: sols, bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: 8, right: 16, top: 8, bottom: 52, containLabel: true },
      xAxis: { type: 'category', data: partners, axisLabel: { rotate: 35, fontSize: 10, width: 120, overflow: 'truncate' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6' } },
      series: sols.map((sol, i) => ({
        name: sol, type: 'bar', stack: 'total',
        itemStyle: { color: pal[i % pal.length] },
        data: partners.map(p => {
          const r = filteredDemoL3Rows.find(x => x.partner === p && x.opp_main_sol_l3 === sol)
          return r?.n_activities ?? 0
        }),
        label: { show: false },
      })),
    }
  }, [filteredDemoL3Rows])

  const demoL3Cols = useMemo(() => [
    { field: 'partner',          headerName: 'Partner',           flex: 2, minWidth: 180 },
    { field: 'opp_main_sol_l3',  headerName: 'Opp Solution L3',  flex: 2, minWidth: 180 },
    { field: 'n_activities',     headerName: '# Activities',      flex: 1, minWidth: 100, sort: 'desc' },
    { field: 'n_distinct_opps',  headerName: '# Opps',            flex: 1, minWidth: 80 },
    { field: 'n_distinct_sas',   headerName: '# SAs',             flex: 1, minWidth: 80 },
  ], [])

  // ── Chart: Demo Activity by Partner × Opp Solution L4 ────────────────────
  const availableL4s = useMemo(() =>
    [...new Set(demoL4Rows.map((r: any) => r.opp_main_sol_l4))].filter(Boolean).sort() as string[]
  , [demoL4Rows])

  const filteredDemoL4Rows = useMemo(() =>
    demoL4Filters.length ? demoL4Rows.filter((r: any) => demoL4Filters.includes(r.opp_main_sol_l4)) : demoL4Rows
  , [demoL4Rows, demoL4Filters])

  const demoL4ChartOption = useMemo<EChartsOption>(() => {
    const partners = [...new Set(filteredDemoL4Rows.map(r => r.partner))].slice(0, 12)
    const sols = [...new Set(filteredDemoL4Rows.map(r => r.opp_main_sol_l4))].filter(l => l && l !== 'Not Specified')
    if (filteredDemoL4Rows.find(r => r.opp_main_sol_l4 === 'Not Specified')) sols.push('Not Specified')
    const pal = ['#0070f2','#e66a2c','#1a7f4b','#a020f0','#c00000','#0080a0','#f0a000','#408060','#808080']
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => `<b>${params[0]?.axisValue}</b><br/>` +
          params.filter(p => p.value > 0).map(p => `${p.marker}${p.seriesName}: <b>${p.value}</b> activities`).join('<br/>') },
      legend: { data: sols, bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: 8, right: 16, top: 8, bottom: 52, containLabel: true },
      xAxis: { type: 'category', data: partners, axisLabel: { rotate: 35, fontSize: 10, width: 120, overflow: 'truncate' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6' } },
      series: sols.map((sol, i) => ({
        name: sol, type: 'bar', stack: 'total',
        itemStyle: { color: pal[i % pal.length] },
        data: partners.map(p => {
          const r = filteredDemoL4Rows.find(x => x.partner === p && x.opp_main_sol_l4 === sol)
          return r?.n_activities ?? 0
        }),
        label: { show: false },
      })),
    }
  }, [filteredDemoL4Rows])

  const demoL4Cols = useMemo(() => [
    { field: 'partner',          headerName: 'Partner',           flex: 2, minWidth: 180 },
    { field: 'opp_main_sol_l4',  headerName: 'Opp Solution L4',  flex: 2, minWidth: 180 },
    { field: 'n_activities',     headerName: '# Activities',      flex: 1, minWidth: 100, sort: 'desc' },
    { field: 'n_distinct_opps',  headerName: '# Opps',            flex: 1, minWidth: 80 },
    { field: 'n_distinct_sas',   headerName: '# SAs',             flex: 1, minWidth: 80 },
  ], [])

  // ── Partner summary table columns ───────────────────────────────────────────
  const fmtAcv = (p: any) => formatAcvK(Number(p.value || 0) * fx, currency)

  const summaryCols = useMemo(() => [
    { field: 'partner',       headerName: 'Channel Partner', flex: 2, minWidth: 180 },
    { field: 'n_opps',        headerName: '# Opps',          flex: 1, minWidth: 80,  sort: 'desc' },
    { field: 'total_acv',     headerName: `Total ACV (${currency})`, flex: 1, minWidth: 120, valueFormatter: fmtAcv },
    { field: 'acv_committed', headerName: 'Committed',               flex: 1, minWidth: 100, valueFormatter: fmtAcv },
    { field: 'acv_probable',  headerName: 'Probable',                flex: 1, minWidth: 100, valueFormatter: fmtAcv },
    { field: 'acv_upside',    headerName: 'Upside',                  flex: 1, minWidth: 100, valueFormatter: fmtAcv },
    { field: 'acv_pipeline',  headerName: 'Pipeline',                flex: 1, minWidth: 100, valueFormatter: fmtAcv },
    { field: 'n_booked',      headerName: '# Booked',                flex: 1, minWidth: 80 },
    { field: 'acv_booked',    headerName: `ACV Booked (${currency})`, flex: 1, minWidth: 120, valueFormatter: fmtAcv },
  ], [fx, currency])

  const demoCols = useMemo(() => [
    { field: 'partner',          headerName: 'Partner',           flex: 2, minWidth: 180 },
    { field: 'opp_main_sol_l2',  headerName: 'Opp Solution L2',  flex: 2, minWidth: 160 },
    { field: 'n_activities',     headerName: '# Activities',      flex: 1, minWidth: 100, sort: 'desc' },
    { field: 'n_distinct_opps',  headerName: '# Opps',            flex: 1, minWidth: 80 },
    { field: 'n_distinct_sas',   headerName: '# SAs',             flex: 1, minWidth: 80 },
  ], [])

  const detailCols = useMemo(() => [
    { field: 'activity_date',    headerName: 'Date',             flex: 1, minWidth: 100, valueFormatter: (p: any) => p.value ? String(p.value).slice(0, 10) : '—' },
    { field: 'account_name',     headerName: 'Account',          flex: 2, minWidth: 160 },
    { field: 'sa_name',          headerName: 'SA',               flex: 1, minWidth: 130 },
    { field: 'opp_main_sol_l2',  headerName: 'Opp Solution L2',  flex: 1, minWidth: 160 },
    { field: 'activity_type',    headerName: 'Type',             flex: 1, minWidth: 100 },
    { field: 'solution_l2',      headerName: 'Activity Sol L2',  flex: 1, minWidth: 120 },
    { field: 'solution_area_l1', headerName: 'Sol Area L1',      flex: 1, minWidth: 120 },
    { field: 'drm_category',     headerName: 'DRM',              flex: 1, minWidth: 100 },
    { field: 'closing_qtr',      headerName: 'Closing Qtr',      flex: 1, minWidth: 100 },
    { field: 'acv_total_opp',    headerName: `Opp ACV (${currency})`, flex: 1, minWidth: 110, valueFormatter: (p: any) => formatAcvK(Number(p.value || 0) * fx, currency) },
  ], [fx, currency])

  // ── Partner opportunity table columns (full set, like Opportunity List) ─────
  const oppCols = useMemo(() => [
    oppIdCol,
    { field: 'account_name',          headerName: 'Account',      flex: 1, minWidth: 150 },
    { field: 'opp_description', headerName: 'Description', flex: 1, minWidth: 160,
      valueGetter: (p: any) => {
        const d = p.data; if (!d) return d?.opp_description || ''
        const nonTF = ['acv_l1_baip_dai','acv_l1_btm','acv_l1_cloud_erp','acv_l1_cx','acv_l1_finance','acv_l1_hcm','acv_l1_scm','acv_l1_other']
        const active = nonTF.filter(f => Number(d[f] || 0) > 0).length
        const label = active > 1 ? '🧺 Basket  ' : (active === 1 || Number(d.acv_l1_baip_tf || 0) > 0) ? '🎯 Single  ' : ''
        return label + (d.opp_description || '')
      },
      cellStyle: (p: any) => {
        const v = p.value || ''
        if (v.startsWith('🧺')) return { color: '#5E35B1', fontWeight: 600 }
        if (v.startsWith('🎯')) return { color: '#1565C0', fontWeight: 600 }
        return {}
      },
    },
    { field: 'channel_partner',        headerName: 'Partner',      width: 180 },
    { field: 'region_lvl3',            headerName: 'Region',       width: 130 },
    { field: 'solution_area_l1',       headerName: 'Solution L1',  width: 160 },
    { field: 'sub_solution_area_l2',   headerName: 'Sub-Solution', width: 160 },
    { field: 'drm_category',           headerName: 'DRM Cat',      width: 110 },
    { field: 'opp_phase',              headerName: 'Opp Phase',    width: 140 },
    { field: 'closing_qtr',            headerName: 'Closing Qtr',  width: 110 },
    { field: 'engagement_type',        headerName: 'Engagement',   width: 110, cellStyle: engagementCellStyle },
    { field: 'deal_qualification_score', headerName: 'Score',      width: 75 },
    { ...presalesStatusCol(110) },
    { ...qualDecisionCol(120) },
    acvCol('acv_total_opp', fx, currency, `ACV K (${currency})`, 140),
    { field: 'opp_owner_name',         headerName: 'Opp Owner',    width: 140 },
    { field: 'flsm',                   headerName: 'Sales Manager', width: 150 },
    { field: 'iss_group_text',         headerName: 'ISS Group',    width: 130 },
    { field: 'fc_qualification',       headerName: 'FC',           width: 110 },
    { field: 'vat_dh',                 headerName: 'Digital SA',   width: 160 },
    ...buildLobAcvCols(fx, currency),
  ], [fx, currency])

  const OPP_ALL_KEYS = oppCols.map(c => (c as any).field === 'opportunity_id' ? 'oppId' : (c as any).field).filter(Boolean)
  const OPP_DEFAULT_KEYS = OPP_ALL_KEYS.filter(k => !k.startsWith('acv_l1_'))

  const { visibleCols, panelOpen, setPanelOpen, toggleCol, showAll, resetCols } =
    useColVisibility(OPP_ALL_KEYS, OPP_DEFAULT_KEYS)

  const visibleOppColDefs = oppCols.filter(c => {
    const k = (c as any).field === 'opportunity_id' ? 'oppId' : (c as any).field
    return visibleCols.has(k)
  })

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Partner Analysis</h1>
      </div>

      {/* Filters */}
      <PipelineFilterBar filters={filters} opts={opts} set={set} clear={clear} showEngagement={false} />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Partners" value={totalPartners} />
        <KpiCard label="Total Opps"      value={totalOpps} />
        <KpiCard label={`Total ACV (${currency})`} value={formatAcvK(totalAcv * fx, currency)} />
        <KpiCard label="Demo Activities" value={totalDemoActivities} />
      </div>

      {/* Bar charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Partners — # Opportunities (Top {TOP_N})</SectionLabel>
          <div className="bg-white rounded border p-3 mt-2">
            <EChart option={oppsChartOption} style={{ height: 400 }} />
          </div>
        </div>
        <div>
          <SectionLabel>Partners — ACV by DRM Category (Top {TOP_N})</SectionLabel>
          <div className="bg-white rounded border p-3 mt-2">
            <EChart option={acvChartOption} style={{ height: 400 }} />
          </div>
        </div>
      </div>

      {/* Partner × Solution Area */}
      <div>
        <SectionLabel>Partner by Solution Area (ACV)</SectionLabel>
        <div className="bg-white rounded border p-3 mt-2">
          <EChart option={bysolChartOption} style={{ height: 340 }} />
        </div>
      </div>

      {/* Partner summary table */}
      <div>
        <SectionLabel>Partner Pipeline Summary</SectionLabel>
        <div className="mt-2">
          <DataTable
            rows={summaryRows}
            cols={summaryCols}
            pagination
            pageSize={20}
            height={520}
            onRowClick={(row) => setSelectedPartner(row.partner === selectedPartner ? null : row.partner)}
          />
        </div>
        {selectedPartner && (
          <p className="text-xs text-gray-500 mt-1">
            Viewing opportunities for <b>{selectedPartner}</b>.
            <button className="ml-2 text-blue-600 hover:underline text-xs" onClick={() => setSelectedPartner(null)}>Clear</button>
          </p>
        )}
      </div>

      {/* Demo Activity section — collapsible */}
      <CollapsibleFrame
        title="Demo Support by Partner × Opp Solution L2 (Melody Activity)"
        open={demoOpen}
        onToggle={() => setDemoOpen(o => !o)}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">From date</label>
              <input type="date" value={demoDateFrom} onChange={e => setDemoDateFrom(e.target.value)}
                className="text-sm border rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">To date</label>
              <input type="date" value={demoDateTo} onChange={e => setDemoDateTo(e.target.value)}
                className="text-sm border rounded px-2 py-1.5" />
            </div>
            {availableLobs.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Solution L2 (LoB)</label>
                <div className="flex flex-wrap gap-1">
                  {availableLobs.map(lob => (
                    <button key={lob}
                      onClick={() => setDemoLobFilters(p => p.includes(lob) ? p.filter(x => x !== lob) : [...p, lob])}
                      className={`text-[11px] px-2 py-1 rounded-lg border font-semibold transition ${
                        demoLobFilters.includes(lob)
                          ? 'bg-sap-blue text-white border-sap-blue'
                          : 'border-sap-border text-sap-muted hover:bg-sap-bg'
                      }`}>
                      {lob}
                    </button>
                  ))}
                  {demoLobFilters.length > 0 && (
                    <button onClick={() => setDemoLobFilters([])} className="text-[10px] text-sap-error hover:underline self-center ml-1">Clear</button>
                  )}
                </div>
              </div>
            )}
            {(demoDateFrom || demoDateTo || demoOppMainSolL2) && (
              <button onClick={() => { setDemoDateFrom(''); setDemoDateTo(''); setDemoOppMainSolL2('') }}
                className="text-xs text-gray-500 hover:text-gray-700 border rounded px-2 py-1.5">
                Clear dates
              </button>
            )}
          </div>

          <div className="bg-white rounded border p-3">
            <EChart option={demoChartOption} style={{ height: 320 }} />
          </div>
        </div>
      </CollapsibleFrame>

      {/* Demo Activity L3 */}
      <CollapsibleFrame
        title="Demo Support by Partner × Opp Solution L3 (Melody Activity)"
        open={demoL3Open}
        onToggle={() => setDemoL3Open(o => !o)}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            {availableL3s.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Solution L3</label>
                <div className="flex flex-wrap gap-1">
                  {availableL3s.map(lob => (
                    <button key={lob}
                      onClick={() => setDemoL3Filters(p => p.includes(lob) ? p.filter(x => x !== lob) : [...p, lob])}
                      className={`text-[11px] px-2 py-1 rounded-lg border font-semibold transition ${
                        demoL3Filters.includes(lob)
                          ? 'bg-sap-blue text-white border-sap-blue'
                          : 'border-sap-border text-sap-muted hover:bg-sap-bg'
                      }`}>
                      {lob}
                    </button>
                  ))}
                  {demoL3Filters.length > 0 && (
                    <button onClick={() => setDemoL3Filters([])} className="text-[10px] text-sap-error hover:underline self-center ml-1">Clear</button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded border p-3">
            <EChart option={demoL3ChartOption} style={{ height: 320 }} />
          </div>
        </div>
      </CollapsibleFrame>

      {/* Demo Activity L4 */}
      <CollapsibleFrame
        title="Demo Support by Partner × Opp Solution L4 (Melody Activity)"
        open={demoL4Open}
        onToggle={() => setDemoL4Open(o => !o)}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            {availableL4s.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Solution L4</label>
                <div className="flex flex-wrap gap-1">
                  {availableL4s.map(lob => (
                    <button key={lob}
                      onClick={() => setDemoL4Filters(p => p.includes(lob) ? p.filter(x => x !== lob) : [...p, lob])}
                      className={`text-[11px] px-2 py-1 rounded-lg border font-semibold transition ${
                        demoL4Filters.includes(lob)
                          ? 'bg-sap-blue text-white border-sap-blue'
                          : 'border-sap-border text-sap-muted hover:bg-sap-bg'
                      }`}>
                      {lob}
                    </button>
                  ))}
                  {demoL4Filters.length > 0 && (
                    <button onClick={() => setDemoL4Filters([])} className="text-[10px] text-sap-error hover:underline self-center ml-1">Clear</button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded border p-3">
            <EChart key={demoLobFilters.join(',')} option={demoL4ChartOption} style={{ height: 320 }} />
          </div>
        </div>
      </CollapsibleFrame>

      {/* Building Block — partner opps by DRM */}
      {canFetchOpps && partnerOppRows.length > 0 && (
        <div className="mb-4">
          <SectionLabel>Pipeline Building Block — by DRM Category</SectionLabel>
          <BuildingBlockChart
            rows={partnerOppRows}
            groupBy="drm_category"
            valueField="acv_total_opp"
            currency={currency}
            fx={fxRate}
            title={`Partner Pipeline — Building Block (${currency})`}
          />
        </div>
      )}

      {/* Partner Opportunity Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <SectionLabel>
              Partner Opportunities{selectedPartner ? ` — ${selectedPartner}` : ''}
            </SectionLabel>
            {canFetchOpps && !oppFetching && (
              <p className="text-xs text-gray-400 mt-0.5">{partnerOppRows.length.toLocaleString()} rows</p>
            )}
          </div>
          {canFetchOpps && (
            <div className="flex items-center gap-2">
              <ColVisibilityPanel
                visibleCols={visibleCols}
                allColDefs={oppCols.map(c => ({ key: (c as any).field === 'opportunity_id' ? 'oppId' : (c as any).field, header: (c as any).headerName || (c as any).field }))}
                lobKeys={true}
                onToggle={toggleCol} onShowAll={showAll} onReset={resetCols}
                open={panelOpen} setOpen={setPanelOpen}
              />
              <ExcelDownloadButton
                rows={partnerOppRows} cols={visibleOppColDefs}
                defaultFilename={`partner_opps${selectedPartner ? '_' + selectedPartner.replace(/\s+/g, '_') : ''}.xlsx`}
                sheetName="Partner Opportunities"
                className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
              />
            </div>
          )}
        </div>

        {canFetchOpps ? (
          <div className={selectedOpp ? 'flex gap-4 items-start' : ''} style={selectedOpp ? { minHeight: 'calc(100vh - 140px)' } : {}}>
            <div className={selectedOpp ? 'flex-1 min-w-0' : ''}>
              {oppFetching
                ? <div className="text-gray-400 text-sm py-6 text-center">Loading…</div>
                : <DataTable rows={partnerOppRows} cols={visibleOppColDefs} height={selectedOpp ? 560 : 460}
                    onRowClick={handleSelectOpp}
                  />
              }
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
        ) : (
          <p className="text-sm text-gray-400 italic py-4">
            Click a partner row in the summary table above, or use the Channel Partner filter to see opportunities.
          </p>
        )}
      </div>

      {/* Engagement Type Analysis */}
      {canFetchOpps && partnerOppRows.length > 0 && (
        <CollapsibleFrame
          title="Engagement Type Analysis"
          subtitle={`— ${engagementTotalOpps.toLocaleString()} opps`}
          open={engagementOpen}
          onToggle={() => setEngagementOpen(o => !o)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded border p-3">
              <EChart option={engagementOppsOption} style={{ height: 280 }} />
            </div>
            <div className="bg-white rounded border p-3">
              <EChart option={engagementAcvOption} style={{ height: 280 }} />
            </div>
          </div>
        </CollapsibleFrame>
      )}

      {/* Activity Detail — below Partner Opportunities */}
      {selectedPartner && detailRows.length > 0 && (
        <div>
          <SectionLabel>Activity Detail — {selectedPartner}</SectionLabel>
          <div className="mt-2">
            <DataTable rows={detailRows} cols={detailCols} pagination pageSize={20} height={560} />
          </div>
        </div>
      )}
    </div>
  )
}
