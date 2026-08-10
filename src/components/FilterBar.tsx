import { useState, type ReactNode } from 'react'

interface FilterBarProps { children: ReactNode; className?: string; defaultCollapsed?: boolean }

export function FilterBar({ children, className = '', defaultCollapsed = false }: FilterBarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className={`card mb-4 ${className}`}>
      {/* Header — always visible */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-sap-blue flex-shrink-0"
          >
            <line x1="4" y1="6"  x2="20" y2="6" />
            <line x1="8" y1="12" x2="20" y2="12" />
            <line x1="12" y1="18" x2="20" y2="18" />
          </svg>
          <span className="text-[12px] font-semibold text-sap-muted uppercase tracking-wide">
            Filters
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-sap-muted">
            {collapsed ? 'Show' : 'Hide'}
          </span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`text-sap-muted transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Collapsible content */}
      <div
        className={`transition-all duration-200 ${
          collapsed ? 'max-h-0 overflow-hidden' : 'max-h-[2000px]'
        }`}
      >
        <div className="px-4 pb-4 pt-1 border-t border-sap-border">
          {children}
        </div>
      </div>
    </div>
  )
}

export function FilterGrid({ children, cols = 6 }: { children: ReactNode; cols?: number }) {
  return (
    <div className={`grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-${Math.min(cols, 4)} lg:grid-cols-${cols}`}>
      {children}
    </div>
  )
}
