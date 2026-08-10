import { useState, useRef, useEffect } from 'react'

interface Props {
  label: string
  selected: string[]
  options: string[]
  onChange: (vals: string[]) => void
}

function toggle(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

export function MultiSelect({ label, selected, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">{label}</label>
      <button
        onClick={() => setOpen(o => !o)}
        className={`border rounded-lg px-2 py-1.5 text-[13px] text-left flex items-center justify-between transition focus:outline-none ${
          selected.length ? 'border-sap-blue bg-sap-blue-l text-sap-blue' : 'border-sap-border bg-white text-sap-muted'
        }`}
      >
        <span className="truncate">
          {selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <span className="ml-1 text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 bg-white border border-sap-border rounded-xl shadow-hover mt-1 min-w-[200px] max-h-[280px] overflow-y-auto">
          <div className="px-2 py-1.5 border-b border-sap-border flex items-center justify-between">
            <span className="text-[10px] font-semibold text-sap-muted uppercase">Select {label}</span>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="text-[10px] text-sap-blue hover:underline">Clear</button>
            )}
          </div>
          {(options || []).map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-sap-bg cursor-pointer text-[13px]">
              <input type="checkbox" checked={selected.includes(opt)}
                onChange={() => onChange(toggle(selected, opt))}
                className="accent-sap-blue flex-shrink-0" />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}

// ── SearchMultiSelect with Exclude mode ───────────────────────────────────────
interface SearchProps extends Props {
  // When excludeMode=true, `selected` contains items to EXCLUDE (all others are included)
  excludeMode?: boolean
  onExcludeModeChange?: (v: boolean) => void
}

export function SearchMultiSelect({
  label, selected, options, onChange,
  excludeMode = false, onExcludeModeChange,
}: SearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const filtered = (options || []).filter(o => !query || o.toLowerCase().includes(query.toLowerCase()))

  function openDrop() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 280) })
    }
    setOpen(true)
    setQuery('')
  }

  // Re-position on scroll/resize
  useEffect(() => {
    if (!open) return
    const update = () => {
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect()
        setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 280) })
      }
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [open])

  const hasExclusion = excludeMode && selected.length > 0

  const displayLabel = () => {
    if (selected.length === 0) return excludeMode ? 'All (none excluded)' : 'All'
    if (excludeMode) return `All except ${selected.length}`
    return selected.length === 1 ? selected[0] : `${selected.length} selected`
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">{label}</label>
      <button
        ref={btnRef}
        onClick={openDrop}
        className={`border rounded-lg px-2 py-1.5 text-[13px] text-left flex items-center justify-between transition focus:outline-none ${
          hasExclusion ? 'border-orange-400 bg-orange-50 text-orange-700' :
          selected.length && !excludeMode ? 'border-sap-blue bg-sap-blue-l text-sap-blue' :
          'border-sap-border bg-white text-sap-muted'
        }`}
      >
        <span className="truncate">{displayLabel()}</span>
        <span className="ml-1 text-[10px]">▾</span>
      </button>

      {open && dropPos && (
        <div
          className="fixed z-[9999] bg-white border border-sap-border rounded-xl shadow-2xl"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, maxHeight: 380, display: 'flex', flexDirection: 'column' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — mode toggle + search */}
          <div className="px-3 pt-2.5 pb-2 border-b border-sap-border flex-shrink-0 space-y-2">
            {/* Mode toggle */}
            {onExcludeModeChange && (
              <div className="flex gap-1">
                <button
                  onClick={() => { onExcludeModeChange(false); onChange([]) }}
                  className={`flex-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition ${
                    !excludeMode ? 'bg-sap-blue text-white border-sap-blue' : 'text-sap-muted border-sap-border hover:border-sap-blue'
                  }`}>
                  ✓ Include selected
                </button>
                <button
                  onClick={() => { onExcludeModeChange(true); onChange([]) }}
                  className={`flex-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition ${
                    excludeMode ? 'bg-orange-500 text-white border-orange-500' : 'text-sap-muted border-sap-border hover:border-orange-400'
                  }`}>
                  ✗ Exclude selected
                </button>
              </div>
            )}
            {/* Search */}
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${label}…`}
              className="w-full border border-sap-border rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:border-sap-blue"
            />
            {/* Select all / Clear */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => onChange(excludeMode ? [] : [...options])}
                className="text-[11px] font-semibold text-sap-blue hover:underline">
                {excludeMode ? 'Include All (clear exclusions)' : `Select All (${options.length})`}
              </button>
              {selected.length > 0 && (
                <button onClick={() => onChange([])} className="text-[11px] text-sap-error hover:underline">
                  Clear {selected.length}
                </button>
              )}
            </div>
          </div>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="px-2 py-1.5 border-b border-sap-border flex-shrink-0 flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
              {selected.map(s => (
                <span key={s} className={`flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  excludeMode ? 'bg-orange-100 text-orange-700' : 'bg-sap-blue-l text-sap-blue'
                }`}>
                  <span className="max-w-[110px] truncate">{s}</span>
                  <button onClick={() => onChange(toggle(selected, s))} className="ml-0.5 font-bold hover:opacity-70">×</button>
                </span>
              ))}
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0
              ? <div className="px-3 py-3 text-[12px] text-sap-muted text-center">No results for "{query}"</div>
              : filtered.map(opt => {
                  const checked = selected.includes(opt)
                  return (
                    <label key={opt} className={`flex items-center gap-2 px-3 py-1.5 hover:bg-sap-bg cursor-pointer text-[13px] ${
                      checked ? (excludeMode ? 'bg-orange-50' : 'bg-sap-blue-l') : ''
                    }`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => onChange(toggle(selected, opt))}
                        className={excludeMode ? 'accent-orange-500 flex-shrink-0' : 'accent-sap-blue flex-shrink-0'} />
                      <span className="truncate">{opt}</span>
                    </label>
                  )
                })
            }
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />}
    </div>
  )
}
