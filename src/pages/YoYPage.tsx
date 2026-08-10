// @ts-nocheck
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { EChart } from '../components/EChart'
import { PptxExportButton } from '../components/PptxExportButton'
import { MultiSelect } from '../components/MultiSelect'
import { useAuth } from '../context/AuthContext'
import { formatAcvK } from '../lib/utils'

type YearData = {
  summary: { n_booked: number; acv_booked: number; n_active: number; acv_active: number; n_lost: number; acv_lost: number }
  by_quarter:  { closing_qtr: string; n_booked: number; acv_booked: number }[]
  by_solution: { solution_area_l1: string; n_booked: number; acv_booked: number }[]
  by_region:   { region_lvl3: string; n_booked: number; acv_booked: number }[]
  by_segment:  { iss_group_text: string; n_booked: number; acv_booked: number }[]
  by_drm:      { drm_category: string; n_opps: number; acv: number }[]
}

const Y25_COLOR = '#788fa6'
const Y26_COLOR = '#0070f2'
const Y25_LIGHT = '#c8d8f0'
const Y26_LIGHT = '#0070f2'

function pctDiff(a: number, b: number): string {
  if (!a) return b > 0 ? '+100%' : '—'
  const d = ((b - a) / Math.abs(a)) * 100
  return (d >= 0 ? '+' : '') + d.toFixed(1) + '%'
}

function diffColor(a: number, b: number): string {
  if (!a) return 'text-sap-muted'
  return b >= a ? 'text-sap-success' : 'text-sap-error'
}

function KpiPair({ label, v25, v26, fmt }: { label: string; v25: number; v26: number; fmt: (n: number) => string }) {
  return (
    <div className="bg-white border border-sap-border rounded-xl p-4 flex flex-col gap-2">
      <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] text-sap-muted mb-0.5">2025</p>
          <p className="text-lg font-bold text-[#788fa6]">{fmt(v25)}</p>
        </div>
        <div className="text-center px-2">
          <p className={`text-sm font-bold ${diffColor(v25, v26)}`}>{pctDiff(v25, v26)}</p>
          <p className="text-[10px] text-sap-muted">YoY</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-sap-muted mb-0.5">2026</p>
          <p className="text-lg font-bold text-sap-blue">{fmt(v26)}</p>
        </div>
      </div>
    </div>
  )
}

function barCompare(title: string, data25: { label: string; acv: number }[], data26: { label: string; acv: number }[], fx: number, currency: string) {
  // Align labels from both years
  const allLabels = [...new Set([...data25.map(r => r.label), ...data26.map(r => r.label)])]
    .filter(Boolean)
    .sort((a, b) => {
      const v26 = data26.find(r => r.label === b)?.acv ?? 0
      const v25 = data25.find(r => r.label === b)?.acv ?? 0
      return (v26 + v25) - ((data26.find(r => r.label === a)?.acv ?? 0) + (data25.find(r => r.label === a)?.acv ?? 0))
    })
  const map25 = Object.fromEntries(data25.map(r => [r.label, r.acv * fx]))
  const map26 = Object.fromEntries(data26.map(r => [r.label, r.acv * fx]))
  return {
    title: { text: title, textStyle: { fontSize: 13, fontWeight: 600 } },
    legend: { data: ['2025', '2026'] },
    xAxis: { type: 'category', data: allLabels },
    yAxis: { type: 'value' },
    series: [
      { name: '2025', type: 'bar', data: allLabels.map(l => map25[l] ?? 0), itemStyle: { color: Y25_COLOR } },
      { name: '2026', type: 'bar', data: allLabels.map(l => map26[l] ?? 0), itemStyle: { color: Y26_COLOR } },
    ],
  }
}

function hbarCompare(title: string, data25: { label: string; acv: number }[], data26: { label: string; acv: number }[], fx: number) {
  const allLabels = [...new Set([...data25.map(r => r.label), ...data26.map(r => r.label)])]
    .filter(Boolean)
  // Sort by 2026 value descending, reversed for horizontal bar
  allLabels.sort((a, b) => (data26.find(r => r.label === a)?.acv ?? 0) - (data26.find(r => r.label === b)?.acv ?? 0))
  const map25 = Object.fromEntries(data25.map(r => [r.label, r.acv * fx]))
  const map26 = Object.fromEntries(data26.map(r => [r.label, r.acv * fx]))
  return {
    title: { text: title, textStyle: { fontSize: 13, fontWeight: 600 } },
    legend: { data: ['2025', '2026'] },
    grid: { left: 16, right: 70, top: 40, bottom: 16, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: allLabels },
    series: [
      { name: '2025', type: 'bar', data: allLabels.map(l => map25[l] ?? 0), itemStyle: { color: Y25_COLOR } },
      { name: '2026', type: 'bar', data: allLabels.map(l => map26[l] ?? 0), itemStyle: { color: Y26_COLOR } },
    ],
  }
}

export function YoYPage() {
  const { currency, fxRate } = useAuth()
  const fx = fxRate
  const [excludeEnterprise, setExcludeEnterprise] = useState(false)
  const [selQuarters, setSelQuarters] = useState<string[]>([])
  const [selSolutions, setSelSolutions] = useState<string[]>([])
  const [selSubSolutions, setSelSubSolutions] = useState<string[]>([])
  const [selTeams, setSelTeams] = useState<string[]>([])
  const [selSubTeams, setSelSubTeams] = useState<string[]>([])

  const { data: filterOpts = {} } = useQuery({
    queryKey: ['yoy-filters'],
    queryFn: () => api.get('/api/comparison/filters').then(r => r.data),
    staleTime: 10 * 60_000,
  })

  // Stable keys for query cache
  const yoyKey = JSON.stringify({ excludeEnterprise, selQuarters, selSolutions, selSubSolutions, selTeams, selSubTeams })

  const { data, isLoading } = useQuery({
    queryKey: ['yoy', yoyKey],
    queryFn: () => api.get('/api/comparison', {
      params: {
        exclude_enterprise: excludeEnterprise,
        quarters: selQuarters,
        solutions: selSolutions,
        sub_solutions: selSubSolutions,
        teams: selTeams,
        sub_teams: selSubTeams,
      }
    }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const y25: YearData = data?.y2025 ?? { summary: {}, by_quarter: [], by_solution: [], by_region: [], by_segment: [], by_drm: [] }
  const y26: YearData = data?.y2026 ?? { summary: {}, by_quarter: [], by_solution: [], by_region: [], by_segment: [], by_drm: [] }
  const has2025 = data?.has_2025 ?? false
  const m25 = data?.melody_2025 ?? {}
  const m26 = data?.melody_2026 ?? {}

  const s25 = y25.summary || {}
  const s26 = y26.summary || {}

  // Quarter chart — normalize quarters (strip year prefix for alignment)
  const qtrs25 = y25.by_quarter.map(r => ({ label: r.closing_qtr.replace(/^\d{4}-/, ''), acv: r.acv_booked }))
  const qtrs26 = y26.by_quarter.map(r => ({ label: r.closing_qtr.replace(/^\d{4}-/, ''), acv: r.acv_booked }))

  const qtrChartOpt = {
    title: { text: 'Booked ACV by Quarter (2025 vs 2026)', textStyle: { fontSize: 13, fontWeight: 600 } },
    legend: { data: ['2025', '2026'] },
    xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
    yAxis: { type: 'value' },
    series: [
      { name: '2025', type: 'bar', data: ['Q1','Q2','Q3','Q4'].map(q => (qtrs25.find(r => r.label === q)?.acv ?? 0) * fx), itemStyle: { color: Y25_COLOR } },
      { name: '2026', type: 'bar', data: ['Q1','Q2','Q3','Q4'].map(q => (qtrs26.find(r => r.label === q)?.acv ?? 0) * fx), itemStyle: { color: Y26_COLOR } },
    ],
  }

  // DRM breakdown — both years side by side
  const drmLabels = ['Booked/Won','Committed','Probable','Upside','Disc/Lost','Excluded from Pipeline']
  const map25drm = Object.fromEntries((y25.by_drm || []).map(r => [r.drm_category, r.acv * fx]))
  const map26drm = Object.fromEntries((y26.by_drm || []).map(r => [r.drm_category, r.acv * fx]))
  const drmOpt = {
    title: { text: 'Pipeline by DRM Category (2025 vs 2026)', textStyle: { fontSize: 13, fontWeight: 600 } },
    legend: { data: ['2025', '2026'] },
    xAxis: { type: 'category', data: drmLabels },
    yAxis: { type: 'value' },
    series: [
      { name: '2025', type: 'bar', data: drmLabels.map(l => map25drm[l] ?? 0), itemStyle: { color: Y25_COLOR } },
      { name: '2026', type: 'bar', data: drmLabels.map(l => map26drm[l] ?? 0), itemStyle: { color: Y26_COLOR } },
    ],
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-sap-text">2025 vs 2026 — YoY Comparison</h2>
        <PptxExportButton label="Export PPT" getPayload={() => ({
          page: 'yoy',
          title: '2025 vs 2026 — YoY Comparison',
          subtitle: `Digital LAC — ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,
          currency,
          kpis: [],
          bar_charts: [],
        })} />
      </div>
      <hr className="border-sap-border mb-4" />

      {/* Controls */}
      <div className="card p-4 mb-5 flex items-start gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Quarter</p>
          <MultiSelect
            label="Quarter"
            selected={selQuarters}
            options={filterOpts.quarters ?? ['Q1','Q2','Q3','Q4']}
            onChange={setSelQuarters}
          />
        </div>
        <div className="flex-1 min-w-[260px]">
          <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Solution Area L1</p>
          <MultiSelect
            label="Solution"
            selected={selSolutions}
            options={filterOpts.solutions ?? []}
            onChange={setSelSolutions}
          />
        </div>
        <div className="flex-1 min-w-[260px]">
          <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Sub Solution L2</p>
          <MultiSelect
            label="Sub Solution"
            selected={selSubSolutions}
            options={filterOpts.sub_solutions ?? []}
            onChange={setSelSubSolutions}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Team / Area</p>
          <MultiSelect
            label="Team"
            selected={selTeams}
            options={filterOpts.teams ?? []}
            onChange={setSelTeams}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Sub-Team (LoBs)</p>
          <MultiSelect
            label="Sub-Team"
            selected={selSubTeams}
            options={filterOpts.sub_teams ?? []}
            onChange={setSelSubTeams}
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Enterprise</p>
          <button
            onClick={() => setExcludeEnterprise(e => !e)}
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
              excludeEnterprise ? 'bg-[#aa0808] text-white border-[#aa0808]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
            }`}>
            {excludeEnterprise ? '✕ Enterprise excl.' : '+ Include Enterprise'}
          </button>
        </div>
        {(selQuarters.length > 0 || selSolutions.length > 0 || selSubSolutions.length > 0 || selTeams.length > 0 || selSubTeams.length > 0) && (
          <div className="flex items-end pb-0.5">
            <button onClick={() => { setSelQuarters([]); setSelSolutions([]); setSelSubSolutions([]); setSelTeams([]); setSelSubTeams([]) }}
              className="text-[11px] text-sap-error hover:underline">
              Clear filters
            </button>
          </div>
        )}
        {data && !has2025 && !isLoading && (
          <div className="flex items-end pb-0.5">
            <span className="text-xs text-[#e76500] font-medium">
              ⚠ 2025 data not loaded — upload in Update Data
            </span>
          </div>
        )}
      </div>

      {isLoading
        ? <div className="text-sap-muted text-sm py-16 text-center">Loading…</div>
        : <>
          {/* KPI Summary */}
          <SectionLabel>Booked / Won</SectionLabel>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KpiPair label={`ACV Booked (${currency})`}
              v25={(s25.acv_booked ?? 0) * fx} v26={(s26.acv_booked ?? 0) * fx}
              fmt={v => formatAcvK(v, currency)} />
            <KpiPair label="# Opps Booked"
              v25={s25.n_booked ?? 0} v26={s26.n_booked ?? 0}
              fmt={v => v.toLocaleString()} />
            <KpiPair label="Avg ACV per Opp"
              v25={s25.n_booked ? (s25.acv_booked ?? 0) * fx / s25.n_booked : 0}
              v26={s26.n_booked ? (s26.acv_booked ?? 0) * fx / s26.n_booked : 0}
              fmt={v => formatAcvK(v, currency)} />
          </div>

          <SectionLabel>Active Pipeline (Commit + Probable + Upside)</SectionLabel>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KpiPair label={`ACV Active (${currency})`}
              v25={(s25.acv_active ?? 0) * fx} v26={(s26.acv_active ?? 0) * fx}
              fmt={v => formatAcvK(v, currency)} />
            <KpiPair label="# Opps Active"
              v25={s25.n_active ?? 0} v26={s26.n_active ?? 0}
              fmt={v => v.toLocaleString()} />
            <KpiPair label="Win Rate %"
              v25={(s25.n_booked ?? 0) + (s25.n_lost ?? 0) > 0
                ? (s25.n_booked ?? 0) / ((s25.n_booked ?? 0) + (s25.n_lost ?? 0)) * 100 : 0}
              v26={(s26.n_booked ?? 0) + (s26.n_lost ?? 0) > 0
                ? (s26.n_booked ?? 0) / ((s26.n_booked ?? 0) + (s26.n_lost ?? 0)) * 100 : 0}
              fmt={v => `${v.toFixed(1)}%`} />
          </div>

          {/* Charts */}
          <SectionLabel>Booked by Quarter</SectionLabel>
          <EChart option={qtrChartOpt} height={300} className="mb-6" />

          <SectionLabel>Pipeline by DRM Category</SectionLabel>
          <EChart option={drmOpt} height={300} className="mb-6" />

          <SectionLabel>Booked by Solution Area L1</SectionLabel>
          <EChart option={hbarCompare(
            `ACV Booked by Solution L1 (${currency})`,
            y25.by_solution.map(r => ({ label: r.solution_area_l1, acv: r.acv_booked })),
            y26.by_solution.map(r => ({ label: r.solution_area_l1, acv: r.acv_booked })),
            fx
          )} height={320} className="mb-6" />

          <div className="grid grid-cols-2 gap-4 mb-6">
            <EChart option={hbarCompare(
              `Booked by Region (${currency})`,
              y25.by_region.map(r => ({ label: r.region_lvl3, acv: r.acv_booked })),
              y26.by_region.map(r => ({ label: r.region_lvl3, acv: r.acv_booked })),
              fx
            )} />
            <EChart option={hbarCompare(
              `Booked by Segment (${currency})`,
              y25.by_segment.map(r => ({ label: r.iss_group_text, acv: r.acv_booked })),
              y26.by_segment.map(r => ({ label: r.iss_group_text, acv: r.acv_booked })),
              fx
            )} />
          </div>

          {/* ── Melody Support Indicators ── */}
          <SectionLabel>Melody — Opportunity Support</SectionLabel>
          {data && !m25.has_data && (
            <div className="card p-3 mb-4 border-[#e76500] border text-[13px] text-[#e76500] font-medium">
              ⚠ Melody 2025 data not loaded — upload in Update Data → Melody 2025
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <KpiPair label="# Supported Opportunities"
              v25={Number(m25.n_opps_supported ?? 0)} v26={Number(m26.n_opps_supported ?? 0)}
              fmt={v => v.toLocaleString()} />
            <KpiPair label={`Supported ACV (${currency})`}
              v25={Number(m25.acv_supported ?? 0) * fx} v26={Number(m26.acv_supported ?? 0) * fx}
              fmt={v => formatAcvK(v, currency)} />
            <KpiPair label="# Activities"
              v25={Number(m25.n_activities ?? 0)} v26={Number(m26.n_activities ?? 0)}
              fmt={v => v.toLocaleString()} />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KpiPair label="# Active SAs"
              v25={Number(m25.n_advisors ?? 0)} v26={Number(m26.n_advisors ?? 0)}
              fmt={v => v.toLocaleString()} />
            <KpiPair label="# Supported Opps → Booked"
              v25={Number(m25.n_booked ?? 0)} v26={Number(m26.n_booked ?? 0)}
              fmt={v => v.toLocaleString()} />
            <KpiPair label={`Supported Booked ACV (${currency})`}
              v25={Number(m25.acv_booked_supported ?? 0) * fx} v26={Number(m26.acv_booked_supported ?? 0) * fx}
              fmt={v => formatAcvK(v, currency)} />
          </div>
        </>
      }
    </div>
  )
}
