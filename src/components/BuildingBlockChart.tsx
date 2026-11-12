// @ts-nocheck
import { useMemo } from 'react'
import { EChart } from './EChart'

const DRM_COLORS: Record<string, string> = {
  'Committed':              '#0070f2',
  'Probable':               '#4cb1ff',
  'Upside':                 '#f0ab00',
  'Partner Upside':         '#ffd666',
  'Partner Forecasted':     '#9ec8f7',
  'Exclude from Pipeline':  '#8899aa',
  'Disc/Lost':              '#aa0808',
  'Booked/Won':             '#256f3a',
  'Pipeline':               '#a0b4c8',
  'Omit':                   '#d04a4a',
  'Digital':                '#0070f2',
  'Field':                  '#4cb1ff',
  'No Engagement':          '#c8d8f0',
}

interface Props {
  rows: any[]
  groupBy?: string
  valueField?: string
  currency?: 'USD' | 'EUR'
  fx?: number
  title?: string
  height?: number
}

export function BuildingBlockChart({
  rows,
  groupBy = 'drm_category',
  valueField,
  currency = 'USD',
  fx = 1,
  title = 'Pipeline — Building Block View',
  height = 380,
}: Props) {
  const sym = currency === 'EUR' ? '€' : '$'

  const option = useMemo(() => {
    // Group rows by groupBy field, pick best ACV field available
    const groups: Record<string, any[]> = {}
    for (const r of rows) {
      const key = String(r[groupBy] ?? 'Other')
      const rawAcv = valueField
        ? Number(r[valueField] ?? 0)
        : Number(r.acv_usd ?? r.acv_total_opp ?? 0)
      const val = rawAcv * fx
      if (val <= 0) continue
      if (!groups[key]) groups[key] = []
      const label = [r.account_name, r.opp_description || r.opportunity_id]
        .filter(Boolean).join(' — ')
      groups[key].push({ name: label || key, value: val })
    }

    const data = Object.entries(groups)
      .filter(([, children]) => children.length > 0)
      .map(([cat, children]) => {
        const total = children.reduce((s, c) => s + c.value, 0)
        const color = DRM_COLORS[cat] ?? '#788fa6'
        return {
          name: cat,
          value: total,
          itemStyle: { color },
          children: children.map(c => ({
            ...c,
            itemStyle: { color: color + 'cc' },
          })),
        }
      })
      .sort((a, b) => b.value - a.value)

    const fmtAcv = (v: number) =>
      v >= 1e6 ? `${sym}${(v / 1e6).toFixed(2)}Mi` : `${sym}${(v / 1e3).toFixed(2)}K`

    return {
      title: {
        text: title,
        textStyle: { fontSize: 13, fontWeight: 600, color: '#32363A' },
        top: 6, left: 12,
      },
      tooltip: {
        formatter: (info: any) => {
          const val = info.value
          const depth = info.treePathInfo?.length ?? 0
          const parentName = depth > 1 ? info.treePathInfo[1]?.name : ''
          return `${parentName ? `<span style="color:#788fa6;font-size:10px">${parentName}</span><br/>` : ''}<b>${info.name}</b><br/>ACV: <b>${fmtAcv(val)}</b>`
        },
      },
      series: [
        {
          type: 'treemap',
          visibleMin: 200,
          roam: false,
          nodeClick: false,
          squareRatio: 0.8,
          breadcrumb: { show: false },
          top: 40,
          levels: [
            {
              // parent category
              itemStyle: { borderWidth: 3, borderColor: '#ffffff', gapWidth: 3 },
              upperLabel: {
                show: true,
                height: 22,
                fontSize: 11,
                fontWeight: 700,
                color: '#ffffff',
                overflow: 'truncate',
                ellipsis: true,
              },
              label: { show: false },
            },
            {
              // individual opps
              itemStyle: { borderWidth: 1, borderColor: '#ffffff55', gapWidth: 1 },
              label: {
                show: true,
                fontSize: 9,
                color: '#fff',
                overflow: 'truncate',
                formatter: (p: any) => fmtAcv(p.value),
              },
            },
          ],
          data,
        },
      ],
    }
  }, [rows, groupBy, valueField, fx, title, sym])

  if (!rows || rows.length === 0) return null

  return (
    <div className="bg-white rounded border p-3 mt-2">
      <EChart option={option} style={{ height }} notMerge />
    </div>
  )
}
