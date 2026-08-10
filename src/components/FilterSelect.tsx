interface FilterSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}

export function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] text-sap-text bg-white focus:outline-none focus:border-sap-blue"
      >
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
