import { cn } from '../lib/utils'

type Color = 'blue' | 'green' | 'red' | 'orange' | 'grey'

const colorMap: Record<Color, string> = {
  blue:   'text-sap-blue',
  green:  'text-sap-success',
  red:    'text-sap-error',
  orange: 'text-sap-warning',
  grey:   'text-sap-neutral',
}

interface Props {
  label: string
  value: string | number
  color?: Color
  sub?: string
}

export function KpiCard({ label, value, color = 'blue', sub }: Props) {
  return (
    <div className="card p-4 text-center hover:shadow-hover hover:-translate-y-0.5 transition-all duration-150">
      <div className="kpi-label">{label}</div>
      <div className={cn('kpi-value', colorMap[color])}>{value}</div>
      {sub && <div className="text-[11px] text-sap-subtle mt-0.5">{sub}</div>}
    </div>
  )
}
