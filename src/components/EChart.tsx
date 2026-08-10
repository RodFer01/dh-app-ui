import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useRef, useEffect, useId } from 'react'
import { chartRegistry } from '../lib/chartRegistry'

const SAP_COLORS = ['#0070f2','#4cb1ff','#256f3a','#aa0808','#e76500','#5d36ff','#046c7a','#788fa6']

const BASE_OPTS: Partial<EChartsOption> = {
  backgroundColor: '#ffffff',
  textStyle: { fontFamily: 'Inter, sans-serif', color: '#31333f' },
  grid: { left: 16, right: 24, top: 48, bottom: 48, containLabel: true },
  color: SAP_COLORS,
  legend: {
    orient: 'horizontal',
    top: 4,
    right: 0,
    textStyle: { color: '#31333f', fontSize: 11 },
  },
  tooltip: {
    backgroundColor: '#fff',
    borderColor: '#e1e2e6',
    textStyle: { color: '#31333f', fontSize: 12 },
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
  },
}

function mergeAxis(base: Record<string, unknown>, override?: Record<string, unknown>) {
  return {
    axisLine:  { lineStyle: { color: '#d9d9d9' } },
    splitLine: { lineStyle: { color: '#f0f2f4' } },
    axisLabel: { color: '#31333f', fontSize: 11 },
    ...base,
    ...(override ?? {}),
  }
}

/** Add value labels to every series that doesn't already have label config */
function addLabels(series: any[]): any[] {
  if (!Array.isArray(series)) return series
  return series.map(s => {
    if (s.label !== undefined) return s  // already configured, don't override
    const isBar  = s.type === 'bar'
    const isLine = s.type === 'line'
    const isPie  = s.type === 'pie'
    const isScatter = s.type === 'scatter'

    if (isPie) {
      return { ...s, label: { show: true, color: '#31333f', fontSize: 11,
        formatter: '{b}: {d}%' } }
    }
    if (isScatter) return s  // no labels on scatter
    if (isLine) {
      return { ...s, label: { show: false } }  // tooltip handles lines
    }
    if (isBar) {
      // Detect horizontal bar by checking yAxis type via series data context
      // Use outside position for bars, format number compactly
      return {
        ...s,
        label: {
          show: true,
          position: 'outside',
          color: '#31333f',
          fontSize: 10,
          fontWeight: 500,
          formatter: (p: any) => {
            const v = Number(p.value)
            if (!v && v !== 0) return ''
            if (Math.abs(v) >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`
            if (Math.abs(v) >= 1_000)    return `${(v/1_000).toFixed(1)}K`
            return v % 1 === 0 ? v.toLocaleString() : v.toFixed(1)
          },
        },
      }
    }
    return s
  })
}

interface Props {
  option: EChartsOption
  height?: number
  className?: string
  chartId?: string   // optional explicit id; defaults to title or auto-id
}

export function EChart({ option, height = 320, className = '', chartId }: Props) {
  const ref = useRef<any>(null)
  const autoId = useId()
  const id = chartId ?? ((option as any)?.title?.[0]?.text || (option as any)?.title?.text || autoId)

  useEffect(() => {
    if (ref.current) {
      chartRegistry.register(String(id), ref.current)
    }
    return () => { chartRegistry.unregister(String(id)) }
  }, [id])
  const merged: EChartsOption = {
    ...BASE_OPTS,
    ...option,
    // Add labels to all series
    series: option.series ? addLabels(Array.isArray(option.series) ? option.series : [option.series]) : undefined,
    xAxis: option.xAxis
      ? (Array.isArray(option.xAxis)
          ? option.xAxis.map(a => mergeAxis(a as Record<string, unknown>))
          : mergeAxis(option.xAxis as Record<string, unknown>))
      : undefined,
    yAxis: option.yAxis
      ? (Array.isArray(option.yAxis)
          ? option.yAxis.map(a => mergeAxis(a as Record<string, unknown>))
          : mergeAxis(option.yAxis as Record<string, unknown>))
      : undefined,
  }

  return (
    <div className={`bg-white border border-sap-border rounded-xl shadow-card p-2 ${className}`}>
      <ReactECharts ref={ref} option={merged} style={{ height }} opts={{ renderer: 'canvas' }} />
    </div>
  )
}
