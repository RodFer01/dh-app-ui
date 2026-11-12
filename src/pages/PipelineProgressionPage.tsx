// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { EChart } from '../components/EChart'
import { DataTable } from '../components/DataTable'
import { PipelineFilterBar } from '../components/PipelineFilterBar'
import { usePipelineFilters } from '../lib/usePipelineFilters'
import api from '../lib/api'
import { formatAcvK } from '../lib/utils'
import { OppDetailPanel, BLANK_NOTE_FORM } from '../components/OppDetailPanel'
import { BuildingBlockChart } from '../components/BuildingBlockChart'
import { useAuth } from '../context/AuthContext'

const DRM_ORDER  = ['Committed', 'Probable', 'Upside', 'Pipeline', 'Omit', 'Other']
const DRM_COLORS: Record<string, string> = {
  Committed: '#0070f2',
  Probable:  '#4cb1ff',
  Upside:    '#f0ab00',
  Pipeline:  '#a0b4c8',
  Omit:      '#d04a4a',
  Other:     '#8899aa',
}
const PHASE_PALETTE = [
  '#0070f2','#4cb1ff','#1a7f4b','#f0ab00','#d04a4a',
  '#7b61ff','#e8740c','#00b2a9','#c4278f','#8899aa',
]
const POSITIVE_DRM = new Set(['Committed', 'Probable'])
const EXCLUDED_DRMS = new Set(['Exclude from Pipeline', 'Partner Forecasted', 'Partner Upside'])

const formatWeek = (w: string) => {
  const [y, m, d] = w.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const fetch = (url: string, params: Record<string, any> = {}) =>
  api.get(url, { params }).then(r => r.data)

const moneyK = (v: number | null | undefined) => formatAcvK(v, 'USD')

// Extract params supported by past_pipeline from the full filter set
function ppParams(p: Record<string, any>, extras: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = {}
  const fields = [
    'closing_qtrs', 'regions', 'region_lvl4s', 'sol_l1s', 'sol_l2s', 'drms', 'opp_phases',
    'qual_decisions', 'iss_groups', 'iacs', 'flsms', 'opp_owners', 'local_owners',
    'channel_partners', 'acc_sub_segments', 'engagement_types',
  ]
  for (const f of fields) {
    if (p[f]?.length) out[f] = p[f]
  }
  return { ...out, ...extras }
}

export default function PipelineProgressionPage() {
  const { filters, debouncedParams, set, clear } = usePipelineFilters()
  const { currency, fxRate } = useAuth()
  const fx = fxRate
  const [snapshotWeek, setSnapshotWeek] = useState('')
  const [fromWeek, setFromWeek]         = useState('')
  const [toWeek, setToWeek]             = useState('')
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [selectedOpp, setSelectedOpp] = useState<any>(null)
  const [noteForm, setNoteForm] = useState(BLANK_NOTE_FORM)
  const [selectedFrom, setSelectedFrom] = useState<'top' | 'stalled' | null>(null)
  const [topLimit, setTopLimit] = useState(20)
  const qc = useQueryClient()

  // Filter options
  const { data: filterOpts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => fetch('/api/pipeline/filters'),
    staleTime: 5 * 60_000,
  })

  // Available snapshots
  const { data: snapshots = [] } = useQuery({
    queryKey: ['pp-snapshots'],
    queryFn: () => fetch('/api/pipeline-progression/snapshots'),
  })
  const weekOptions: string[] = useMemo(
    () => snapshots.map((r: any) => r.snapshot_week),
    [snapshots]
  )

  const baseParams = useMemo(() => ppParams(debouncedParams), [debouncedParams])
  const summaryParams = useMemo(
    () => ppParams(debouncedParams, snapshotWeek ? { snapshot_week: snapshotWeek } : {}),
    [debouncedParams, snapshotWeek]
  )
  const topOppsParams = useMemo(
    () => ppParams(debouncedParams, {
      ...(snapshotWeek ? { snapshot_week: snapshotWeek } : {}),
      limit: topLimit,
    }),
    [debouncedParams, snapshotWeek, topLimit]
  )

  // Summary KPIs
  const { data: summary } = useQuery({
    queryKey: ['pp-summary', summaryParams],
    queryFn: () => fetch('/api/pipeline-progression/summary', summaryParams),
  })

  // DRM evolution
  const { data: evolutionRows = [] } = useQuery({
    queryKey: ['pp-evolution', baseParams],
    queryFn: () => fetch('/api/pipeline-progression/evolution', baseParams),
  })

  // Phase evolution
  const { data: phaseRows = [] } = useQuery({
    queryKey: ['pp-evolution-phase', baseParams],
    queryFn: () => fetch('/api/pipeline-progression/evolution-phase', baseParams),
  })

  // Changes comparison
  const { data: changesRows = [], refetch: refetchChanges, isFetching: changesFetching } = useQuery({
    queryKey: ['pp-changes', fromWeek, toWeek],
    queryFn: () => fetch('/api/pipeline-progression/changes', { from_week: fromWeek, to_week: toWeek }),
    enabled: compareEnabled && !!fromWeek && !!toWeek,
  })

  // Stalled pipeline
  const { data: stalledRows = [] } = useQuery({
    queryKey: ['pp-stalled', summaryParams],
    queryFn: () => fetch('/api/pipeline-progression/stalled', summaryParams),
  })

  // Top opps by ACV
  const { data: topOppsRows = [] } = useQuery({
    queryKey: ['pp-top-opps', topOppsParams],
    queryFn: () => fetch('/api/pipeline-progression/top-opps', topOppsParams),
  })

  const handleSelectOpp = (row: any) => {
    setSelectedOpp(row)
    setNoteForm(BLANK_NOTE_FORM)
    setSelectedFrom('stalled')
  }
  const handleSelectTopOpp = (row: any) => {
    setSelectedOpp(row)
    setNoteForm(BLANK_NOTE_FORM)
    setSelectedFrom('top')
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

  // DRM KPIs for selected/latest snapshot (computed from evolutionRows — no extra API call)
  const drmKpis = useMemo(() => {
    const week = snapshotWeek || weekOptions[0] || ''
    if (!week) return []
    return evolutionRows
      .filter((r: any) => r.snapshot_week === week)
      .sort((a: any, b: any) => DRM_ORDER.indexOf(a.drm_category) - DRM_ORDER.indexOf(b.drm_category))
  }, [evolutionRows, snapshotWeek, weekOptions])

  // ── DRM evolution — stacked bar chart (ACV per DRM over time) ───────────────────────
  const evolutionOption = useMemo<EChartsOption>(() => {
    const filtered = evolutionRows.filter((r: any) => !EXCLUDED_DRMS.has(r.drm_category))
    const weeks = [...new Set(filtered.map((r: any) => r.snapshot_week))].sort() as string[]
    const cats  = [...new Set(filtered.map((r: any) => r.drm_category))]
      .sort((a: any, b: any) => DRM_ORDER.indexOf(a) - DRM_ORDER.indexOf(b)) as string[]

    const series = cats.map((cat) => {
      const byWeek: Record<string, number> = Object.fromEntries(
        filtered.filter((r: any) => r.drm_category === cat)
          .map((r: any) => [r.snapshot_week, r.total_acv])
      )
      return {
        name: cat,
        type: 'bar' as const,
        itemStyle: { color: DRM_COLORS[cat] ?? '#8899aa' },
        label: { show: true, fontSize: 9, color: '#fff', formatter: (p: any) => p.value > 5000 ? moneyK(p.value) : '' },
        data: weeks.map((w, i) => {
          const curr = byWeek[w] ?? 0
          const prev = i > 0 ? (byWeek[weeks[i - 1]] ?? 0) : null
          const deltaPct = prev != null && prev > 0 ? ((curr - prev) / prev * 100) : null
          return { value: +(curr.toFixed(0)), deltaPct }
        }),
      }
    })

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const header = `<b>${formatWeek(params[0]?.axisValue)}</b><br/>`
          const lines = params
            .filter((p: any) => p.value > 0)
            .map((p: any) => {
              const pct = p.data?.deltaPct
              const pctStr = pct != null
                ? ` <span style="color:${pct >= 0 ? '#1a7f4b' : '#cc0000'}">(${pct > 0 ? '+' : ''}${pct.toFixed(0)}%)</span>`
                : ''
              return `${p.marker}${p.seriesName}: <b>${moneyK(p.value)}</b>${pctStr}`
            })
          return header + lines.join('<br/>')
        },
      },
      legend: { data: cats, bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 16, right: 16, top: 20, bottom: 48, containLabel: true },
      xAxis: { type: 'category', data: weeks, axisLabel: { rotate: 30, fontSize: 11, formatter: formatWeek } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6', formatter: (v: number) => moneyK(v) } },
      series,
    }
  }, [evolutionRows])

  // ── Opp Phase evolution — stacked bar chart (# opps per phase over time) ─────────────
  const phaseOption = useMemo<EChartsOption>(() => {
    const weeks  = [...new Set(phaseRows.map((r: any) => r.snapshot_week))].sort() as string[]
    const phases = [...new Set(phaseRows.map((r: any) => r.opp_phase))].sort() as string[]

    const series = phases.map((phase, i) => {
      const byWeek: Record<string, number> = Object.fromEntries(
        phaseRows.filter((r: any) => r.opp_phase === phase)
          .map((r: any) => [r.snapshot_week, r.n_opps])
      )
      const color = PHASE_PALETTE[i % PHASE_PALETTE.length]
      return {
        name: phase,
        type: 'bar' as const,
        itemStyle: { color },
        label: { show: true, fontSize: 9, color: '#fff', formatter: (p: any) => p.value > 0 ? String(p.value) : '' },
        data: weeks.map((w, wi) => {
          const curr = byWeek[w] ?? 0
          const prev = wi > 0 ? (byWeek[weeks[wi - 1]] ?? 0) : null
          const deltaPct = prev != null && prev > 0 ? ((curr - prev) / prev * 100) : null
          return { value: curr, deltaPct }
        }),
      }
    })

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const header = `<b>${formatWeek(params[0]?.axisValue)}</b><br/>`
          const lines = params
            .filter((p: any) => p.value > 0)
            .map((p: any) => {
              const pct = p.data?.deltaPct
              const pctStr = pct != null
                ? ` <span style="color:${pct >= 0 ? '#1a7f4b' : '#cc0000'}">(${pct > 0 ? '+' : ''}${pct.toFixed(0)}%)</span>`
                : ''
              return `${p.marker}${p.seriesName}: <b>${p.value} opps</b>${pctStr}`
            })
          return header + lines.join('<br/>')
        },
      },
      legend: { data: phases, bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 16, right: 16, top: 20, bottom: 48, containLabel: true },
      xAxis: { type: 'category', data: weeks, axisLabel: { rotate: 30, fontSize: 11, formatter: formatWeek } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#788fa6' } },
      series,
    }
  }, [phaseRows])

  // ── Column defs ──────────────────────────────────────────────────────────────
  const changesCols = useMemo(() => [
    { field: 'account_name',   headerName: 'Account',    flex: 2, minWidth: 160 },
    { field: 'opp_owner_name', headerName: 'Owner',      flex: 1, minWidth: 120 },
    { field: 'region_lvl3',    headerName: 'Region',     flex: 1, minWidth: 100 },
    { field: 'drm_from',       headerName: 'DRM Before', flex: 1, minWidth: 110 },
    {
      field: 'drm_to', headerName: 'DRM After', flex: 1, minWidth: 110,
      cellStyle: (p: any) => ({
        color: POSITIVE_DRM.has(p.value) ? '#1a7f4b' : '#cc0000',
        fontWeight: 600,
      }),
    },
    { field: 'acv_from', headerName: 'ACV Before', flex: 1, minWidth: 100, valueFormatter: (p: any) => moneyK(p.value) },
    { field: 'acv_to',   headerName: 'ACV After',  flex: 1, minWidth: 100, valueFormatter: (p: any) => moneyK(p.value) },
    { field: 'phase_from', headerName: 'Phase Before', flex: 1, minWidth: 120 },
    { field: 'phase_to',   headerName: 'Phase After',  flex: 1, minWidth: 120 },
    { field: 'qual_from',  headerName: 'Qual Before',  flex: 1, minWidth: 110 },
    { field: 'qual_to',    headerName: 'Qual After',   flex: 1, minWidth: 110 },
  ], [])

  const stalledCols = useMemo(() => [
    { field: 'opportunity_id', headerName: 'Opp ID',   flex: 1, minWidth: 130 },
    { field: 'account_name',   headerName: 'Account',  flex: 2, minWidth: 160 },
    { field: 'opp_owner_name', headerName: 'Owner',    flex: 1, minWidth: 120 },
    { field: 'region_lvl3',    headerName: 'Region',   flex: 1, minWidth: 100 },
    { field: 'drm_category',   headerName: 'DRM',      flex: 1, minWidth: 100 },
    { field: 'opp_phase',      headerName: 'Phase',    flex: 1, minWidth: 110 },
    { field: 'acv_usd',  headerName: 'ACV K',   flex: 1, minWidth: 90,  valueFormatter: (p: any) => moneyK(p.value) },
    { field: 'age_days', headerName: 'Age Days', flex: 1, minWidth: 90, sort: 'desc' },
    { field: 'dda_status', headerName: 'DDA Status', flex: 1, minWidth: 110 },
  ], [])

  const topOppsCols = useMemo(() => [
    { field: 'opportunity_id', headerName: 'Opp ID',      flex: 1, minWidth: 130 },
    { field: 'account_name',   headerName: 'Account',     flex: 2, minWidth: 160 },
    { field: 'opp_owner_name', headerName: 'Owner',       flex: 1, minWidth: 120 },
    { field: 'region_lvl3',    headerName: 'Region',      flex: 1, minWidth: 100 },
    {
      field: 'drm_category', headerName: 'DRM', flex: 1, minWidth: 110,
      cellStyle: (p: any) => p.data?.drm_changed ? { backgroundColor: '#fff3cc' } : {},
      tooltipValueGetter: (p: any) => p.data?.drm_changed ? `${p.data.prev_drm} → ${p.data.drm_category}` : '',
    },
    {
      field: 'opp_phase', headerName: 'Phase', flex: 1, minWidth: 120,
      cellStyle: (p: any) => p.data?.phase_changed ? { backgroundColor: '#fff3cc' } : {},
      tooltipValueGetter: (p: any) => p.data?.phase_changed ? `${p.data.prev_phase} → ${p.data.opp_phase}` : '',
    },
    {
      field: 'acv_usd', headerName: 'ACV', flex: 1, minWidth: 100,
      valueFormatter: (p: any) => moneyK(p.value),
      cellStyle: (p: any) => {
        if (!p.data?.acv_changed) return {}
        return { color: p.value > (p.data.prev_acv ?? 0) ? '#1a7f4b' : '#cc0000', fontWeight: 600 }
      },
    },
    { field: 'closing_qtr', headerName: 'Closing Qtr', flex: 1, minWidth: 100 },
    { field: 'age_days',    headerName: 'Age Days',    flex: 1, minWidth: 90,  sort: 'desc' },
    { field: 'dda_status',  headerName: 'DDA Status',  flex: 1, minWidth: 110 },
  ], [])

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Pipeline Progression</h1>
        <select
          value={snapshotWeek}
          onChange={e => setSnapshotWeek(e.target.value)}
          className="text-sm border rounded px-2 py-1 ml-auto"
        >
          <option value="">Latest snapshot</option>
          {weekOptions.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* Filter bar */}
      <PipelineFilterBar
        filters={filters}
        opts={filterOpts}
        set={set}
        clear={clear}
        showEngagement={false}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Total Opps"   value={summary?.total_opps   ?? '—'} />
        <KpiCard label="Total ACV"    value={moneyK(summary?.total_acv)} />
        <KpiCard label="Stalled Opps" value={summary?.stalled_opps ?? '—'} />
        <KpiCard label="Stalled ACV"  value={moneyK(summary?.stalled_acv)} />
        <KpiCard
          label="ACV Change"
          value={summary?.delta_acv != null && summary.delta_acv !== 0 ? moneyK(summary.delta_acv) : '—'}
          color={summary?.delta_acv > 0 ? 'green' : summary?.delta_acv < 0 ? 'red' : 'grey'}
        />
        <KpiCard
          label="ACV Δ %"
          value={summary?.delta_acv_pct != null && summary.delta_acv_pct !== 0
            ? `${summary.delta_acv_pct > 0 ? '+' : ''}${summary.delta_acv_pct.toFixed(1)}%`
            : '—'}
          color={summary?.delta_acv_pct > 0 ? 'green' : summary?.delta_acv_pct < 0 ? 'red' : 'grey'}
        />
      </div>

      {/* DRM breakdown KPIs */}
      {drmKpis.length > 0 && (
        <div>
          <SectionLabel>Pipeline by DRM — {formatWeek(snapshotWeek || weekOptions[0] || '')}</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-2">
            {drmKpis.map((d: any) => {
              const color =
                d.drm_category === 'Committed' ? 'blue' :
                d.drm_category === 'Probable'  ? 'orange' :
                d.drm_category === 'Upside'    ? 'orange' :
                d.drm_category === 'Omit'      ? 'red' : 'grey'
              return (
                <KpiCard
                  key={d.drm_category}
                  label={d.drm_category}
                  value={moneyK(d.total_acv)}
                  sub={`${d.n_opps} opps`}
                  color={color}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Building Block — DRM breakdown of top opps */}
      {topOppsRows.length > 0 && (
        <div>
          <SectionLabel>Pipeline Building Block — by DRM Category</SectionLabel>
          <BuildingBlockChart
            rows={topOppsRows}
            groupBy="drm_category"
            valueField="acv_usd"
            currency={currency}
            fx={fx}
            title={`Top ${topLimit} Opps — Building Block (${currency})`}
            height={340}
          />
        </div>
      )}

      {/* DRM evolution — line chart */}
      <div>
        <SectionLabel>Weekly Evolution — DRM Category (ACV)</SectionLabel>
        <div className="bg-white rounded border p-3 mt-2">
          <EChart option={evolutionOption} style={{ height: 340 }} />
        </div>
      </div>

      {/* Opp Phase evolution — line chart */}
      <div>
        <SectionLabel>Weekly Evolution — Opp Phase (# Opps)</SectionLabel>
        <div className="bg-white rounded border p-3 mt-2">
          <EChart option={phaseOption} style={{ height: 340 }} />
        </div>
      </div>

      {/* Top Opportunities by ACV */}
      <div>
        <div className="flex items-center gap-2">
          <SectionLabel>Top Opportunities by ACV</SectionLabel>
          <div className="ml-auto flex gap-1 mb-1">
            {[20, 40, 60].map(n => (
              <button
                key={n}
                onClick={() => setTopLimit(n)}
                className={`px-2 py-0.5 text-xs rounded border ${topLimit === n ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300 hover:bg-gray-100'}`}
              >
                Top {n}
              </button>
            ))}
          </div>
        </div>
        <div className={selectedFrom === 'top' && selectedOpp ? 'flex gap-4 items-start mt-2' : 'mt-2'}
          style={selectedFrom === 'top' && selectedOpp ? { minHeight: 'calc(100vh - 140px)' } : {}}>
          <div className={selectedFrom === 'top' && selectedOpp ? 'flex-1 min-w-0' : ''}>
            <DataTable rows={topOppsRows} cols={topOppsCols} height={selectedFrom === 'top' && selectedOpp ? 480 : 380} onRowClick={handleSelectTopOpp} />
          </div>
          {selectedFrom === 'top' && selectedOpp && (
            <div className="w-[62%] flex-shrink-0 sticky top-4">
              <OppDetailPanel
                opp={selectedOpp}
                noteForm={noteForm}
                setNoteForm={setNoteForm}
                saveMut={saveMut}
                onClose={() => { setSelectedOpp(null); setSelectedFrom(null) }}
                currency={currency}
                fx={fx}
              />
            </div>
          )}
        </div>
      </div>

      {/* Changes comparison */}
      <div>
        <SectionLabel>Changes Between Snapshots</SectionLabel>
        <div className="flex flex-wrap gap-3 items-center mt-2">
          <select value={fromWeek} onChange={e => setFromWeek(e.target.value)}
            className="text-sm border rounded px-2 py-1">
            <option value="">From week…</option>
            {weekOptions.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <span className="text-gray-400 text-sm">→</span>
          <select value={toWeek} onChange={e => setToWeek(e.target.value)}
            className="text-sm border rounded px-2 py-1">
            <option value="">To week…</option>
            {weekOptions.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <button
            onClick={() => { setCompareEnabled(true); refetchChanges() }}
            disabled={!fromWeek || !toWeek || changesFetching}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
          >
            {changesFetching ? 'Loading…' : 'Compare'}
          </button>
          {changesRows.length > 0 && (
            <span className="text-sm text-gray-500">{changesRows.length} opportunities changed</span>
          )}
        </div>
        {changesRows.length > 0 && (
          <div className="mt-2">
            <DataTable rows={changesRows} cols={changesCols} height={400} onRowClick={handleSelectOpp} />
          </div>
        )}
      </div>

      {/* Stalled pipeline */}
      <div>
        <SectionLabel>Stalled Pipeline (&gt;21 days unchanged)</SectionLabel>
        <div className={selectedFrom === 'stalled' && selectedOpp ? 'flex gap-4 items-start mt-2' : 'mt-2'}
          style={selectedFrom === 'stalled' && selectedOpp ? { minHeight: 'calc(100vh - 140px)' } : {}}>
          <div className={selectedFrom === 'stalled' && selectedOpp ? 'flex-1 min-w-0' : ''}>
            <DataTable rows={stalledRows} cols={stalledCols} height={selectedFrom === 'stalled' && selectedOpp ? 480 : 380} onRowClick={handleSelectOpp} />
          </div>
          {selectedFrom === 'stalled' && selectedOpp && (
            <div className="w-[62%] flex-shrink-0 sticky top-4">
              <OppDetailPanel
                opp={selectedOpp}
                noteForm={noteForm}
                setNoteForm={setNoteForm}
                saveMut={saveMut}
                onClose={() => { setSelectedOpp(null); setSelectedFrom(null) }}
                currency={currency}
                fx={fx}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
