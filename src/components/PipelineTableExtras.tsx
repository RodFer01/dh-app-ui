import { LOB_COL_DEFS } from '../lib/pipelineTableHelpers'

interface Props {
  visibleCols: Set<string>
  allColDefs: { key: string; header: string }[]
  lobKeys?: boolean          // show LoB ACV section
  onToggle: (k: string) => void
  onShowAll: () => void
  onReset: () => void
  open: boolean
  setOpen: (v: boolean) => void
}

export function ColVisibilityPanel({ visibleCols, allColDefs, lobKeys = true, onToggle, onShowAll, onReset, open, setOpen }: Props) {
  const lobFields = new Set(LOB_COL_DEFS.map(l => l.field))
  const baseColDefs = allColDefs.filter(c => !lobFields.has(c.key))
  const lobColDefs  = LOB_COL_DEFS.map(l => ({ key: l.field, header: l.label }))

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
          open ? 'bg-sap-blue text-white border-sap-blue' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Columns
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${open ? 'bg-white text-sap-blue' : 'bg-sap-blue text-white'}`}>
          {visibleCols.size}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-sap-border rounded-xl shadow-lg w-72 overflow-hidden">
            <div className="px-3 py-2 border-b border-sap-border bg-[#fafbfc] flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Show / Hide Columns</span>
              <div className="flex gap-2">
                <button onClick={onShowAll} className="text-[10px] text-sap-blue hover:underline">All</button>
                <button onClick={onReset}   className="text-[10px] text-sap-muted hover:underline">Reset</button>
              </div>
            </div>

            {lobKeys && (
              <div className="px-3 pt-2 pb-1 border-b border-sap-border">
                <div className="text-[10px] font-semibold text-sap-blue uppercase tracking-wide mb-1.5">ACV by Solution L1</div>
                <div className="grid grid-cols-2 gap-1">
                  {lobColDefs.map(c => (
                    <label key={c.key} className="flex items-center gap-1.5 cursor-pointer text-[12px] py-0.5 hover:text-sap-blue">
                      <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => onToggle(c.key)}
                        className="accent-sap-blue flex-shrink-0 w-3 h-3" />
                      <span className="truncate">{c.header}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="px-3 pt-2 pb-2 max-h-64 overflow-y-auto">
              <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Other Columns</div>
              <div className="grid grid-cols-2 gap-1">
                {baseColDefs.filter(c => c.key !== 'oppId').map(c => (
                  <label key={c.key} className="flex items-center gap-1.5 cursor-pointer text-[12px] py-0.5 hover:text-sap-blue">
                    <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => onToggle(c.key)}
                      className="accent-sap-blue flex-shrink-0 w-3 h-3" />
                    <span className="truncate">{c.header}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


interface BagFilterProps {
  bagFilter: 'all' | 'single' | 'basket'
  setBagFilter: (v: 'all' | 'single' | 'basket') => void
  singleCount: number
  basketCount: number
}

export function BagFilterBar({ bagFilter, setBagFilter, singleCount, basketCount }: BagFilterProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Deal Type:</span>
      {([
        { k: 'all'    as const, label: 'All',            count: 0,           active: 'bg-sap-blue text-white border-sap-blue' },
        { k: 'single' as const, label: '🎯 Single Bag',  count: singleCount, active: 'bg-[#1565C0] text-white border-[#1565C0]' },
        { k: 'basket' as const, label: '🧺 Basket Deal', count: basketCount, active: 'bg-[#5E35B1] text-white border-[#5E35B1]' },
      ]).map(opt => (
        <button key={opt.k} onClick={() => setBagFilter(opt.k)}
          className={`flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition ${
            bagFilter === opt.k ? opt.active : 'border-sap-border text-sap-muted hover:bg-sap-bg'
          }`}
        >
          {opt.label}
          {opt.k !== 'all' && opt.count > 0 && (
            <span className="text-[10px] font-normal opacity-80">({opt.count})</span>
          )}
        </button>
      ))}
      {bagFilter !== 'all' && (
        <button onClick={() => setBagFilter('all')} className="text-[11px] text-sap-blue hover:underline">Clear</button>
      )}
    </div>
  )
}
