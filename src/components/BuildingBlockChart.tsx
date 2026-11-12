// @ts-nocheck
import { useMemo, useState } from 'react'

type ColorDef = { bg: string; text: string; badge: string }

const DRM_COLORS: Record<string, ColorDef> = {
  'Committed':              { bg: '#0070f2', text: '#fff', badge: '#fff3' },
  'Probable':               { bg: '#4cb1ff', text: '#fff', badge: '#fff3' },
  'Upside':                 { bg: '#f0ab00', text: '#fff', badge: '#fff3' },
  'Partner Upside':         { bg: '#e6b800', text: '#fff', badge: '#fff3' },
  'Partner Forecasted':     { bg: '#7b9ec7', text: '#fff', badge: '#fff3' },
  'Exclude from Pipeline':  { bg: '#556b82', text: '#fff', badge: '#fff3' },
  'Disc/Lost':              { bg: '#aa0808', text: '#fff', badge: '#fff3' },
  'Booked/Won':             { bg: '#256f3a', text: '#fff', badge: '#fff3' },
  'Pipeline':               { bg: '#6b8499', text: '#fff', badge: '#fff3' },
  'Omit':                   { bg: '#c04040', text: '#fff', badge: '#fff3' },
  'Digital':                { bg: '#0070f2', text: '#fff', badge: '#fff3' },
  'Field':                  { bg: '#4cb1ff', text: '#fff', badge: '#fff3' },
  'No Engagement':          { bg: '#8899aa', text: '#fff', badge: '#fff3' },
}
const DEFAULT_COLOR: ColorDef = { bg: '#788fa6', text: '#fff', badge: '#fff3' }

const TOP_N_OPTIONS: Array<number | 'Todos'> = [10, 20, 40, 'Todos']

// Only these categories shown, in this fixed order
const CATEGORY_ORDER = ['Booked/Won', 'Committed', 'Probable', 'Upside']

const BLOCK_H = 520

function fmtAcv(v: number, sym = '$'): string {
  if (v == null) return '—'
  if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(2)}Mi`
  if (v >= 1e3) return `${sym}${(v / 1e3).toFixed(0)}K`
  return `${sym}${Math.round(v)}`
}

interface Props {
  rows: any[]
  groupBy?: string
  valueField?: string
  currency?: 'USD' | 'EUR'
  fx?: number
  title?: string
}

export function BuildingBlockChart({
  rows,
  groupBy = 'drm_category',
  valueField,
  currency = 'USD',
  fx = 1,
  title = 'Pipeline — Building Block',
}: Props) {
  const [topN, setTopN] = useState<number | 'Todos'>(20)
  const sym = currency === 'EUR' ? '€' : '$'

  const getAcv = (r: any): number => {
    const raw = valueField
      ? Number(r[valueField] ?? 0)
      : Number(r.acv_usd ?? r.acv_total_opp ?? 0)
    return raw * fx
  }

  // All rows sorted by ACV desc
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => getAcv(b) - getAcv(a)),
    [rows, fx, valueField]
  )

  // Top N slice — drives both block sizes and cards (filters fully applied)
  const visibleRows = useMemo(
    () => (topN === 'Todos' ? sortedRows : sortedRows.slice(0, topN)),
    [sortedRows, topN]
  )

  // Groups derived from visibleRows — totals, counts, and card lists are all consistent
  const groups = useMemo(() => {
    const g: Record<string, { total: number; count: number; rows: any[] }> = {}
    for (const r of visibleRows) {
      const k = String(r[groupBy] ?? 'Other')
      if (!g[k]) g[k] = { total: 0, count: 0, rows: [] }
      g[k].total += getAcv(r)
      g[k].count += 1
      g[k].rows.push(r)
    }
    return g
  }, [visibleRows, groupBy, fx, valueField])

  const categories = useMemo(
    () => CATEGORY_ORDER
      .filter(cat => groups[cat])
      .map(cat => [cat, groups[cat]] as [string, { total: number; count: number; rows: any[] }]),
    [groups]
  )

  if (!rows.length) return null

  return (
    <div className="bg-white rounded border p-4 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[13px] font-bold text-sap-text">{title}</div>
          <div className="text-[10px] text-sap-muted mt-0.5">
            Distribuição por categoria · {visibleRows.length} de {sortedRows.length} oportunidades
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mr-1.5">Top:</span>
          {TOP_N_OPTIONS.map(n => (
            <button
              key={String(n)}
              onClick={() => setTopN(n)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition ${
                topN === n
                  ? 'bg-sap-blue text-white border-sap-blue'
                  : 'border-sap-border text-sap-muted hover:bg-sap-bg'
              }`}
            >
              {n === 'Todos' ? 'Todos' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Building blocks — top aligned, equal height */}
      <div className="flex gap-1.5 items-start">
        {categories.map(([cat, { total, count, rows: catRows }]) => {
          const color = DRM_COLORS[cat] ?? DEFAULT_COLOR
          return (
            <div
              key={cat}
              className="flex-1 min-w-0 rounded-lg overflow-hidden flex flex-col"
              style={{ height: BLOCK_H, backgroundColor: color.bg }}
            >
              {/* Category header */}
              <div className="px-2.5 pt-2 pb-1 shrink-0 border-b border-white/20">
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/70 truncate">{cat}</div>
                <div className="text-[16px] font-black text-white leading-tight">{fmtAcv(total, sym)}</div>
                <div className="text-[9px] text-white/60">{count} opp{count !== 1 ? 's' : ''}</div>
              </div>

              {/* Opp cards — scrollable */}
              <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-1">
                {catRows.map((r: any, i: number) => {
                  const acv = getAcv(r)
                  return (
                    <div
                      key={r.opportunity_id ?? i}
                      className="rounded p-1.5"
                      style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div
                          className="text-[10px] font-bold leading-tight truncate"
                          style={{ color: '#fff', maxWidth: '65%' }}
                        >
                          {r.account_name || '—'}
                        </div>
                        <div className="text-[11px] font-black shrink-0" style={{ color: '#fff' }}>
                          {fmtAcv(acv, sym)}
                        </div>
                      </div>
                      {r.opp_description && (
                        <div className="text-[8px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {r.opp_description}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1.5 mt-1">
        {categories.map(([cat]) => (
          <div
            key={cat}
            className="flex-1 min-w-0 text-[9px] font-semibold text-center truncate"
            style={{ color: (DRM_COLORS[cat] ?? DEFAULT_COLOR).bg }}
          >
            {cat}
          </div>
        ))}
      </div>
    </div>
  )
}
