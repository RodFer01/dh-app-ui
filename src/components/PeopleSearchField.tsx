// @ts-nocheck
import { useState, useRef, useEffect } from 'react'

const TEAM_API = 'http://localhost:8765'

interface Person {
  name: string
  email: string
  title?: string
  department?: string
  office?: string
}

interface Props {
  value: string
  onChange: (name: string, email?: string) => void
  placeholder?: string
  className?: string
}

/**
 * Text field that autocompletes against the SAP corporate directory
 * via Outlook /me/people. Typing 2+ chars triggers a search.
 * Selecting a person fills the field with their name; the caller also
 * receives the email address.
 */
export function PeopleSearchField({ value, onChange, placeholder = 'Search name or email…', className }: Props) {
  const [input, setInput]     = useState(value || '')
  const [results, setResults] = useState<Person[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<any>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Keep input in sync when parent updates value externally
  useEffect(() => { setInput(value || '') }, [value])

  // Click-outside to close
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleInput(v: string) {
    setInput(v)
    onChange(v)            // keep parent in sync while typing
    clearTimeout(timer.current)
    if (v.trim().length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`${TEAM_API}/api/people/search?q=${encodeURIComponent(v)}&top=8`)
        if (r.ok) {
          const data = await r.json()
          setResults(data.people || [])
          setOpen(true)
        }
      } catch { /* server offline — degrade gracefully */ }
      finally { setLoading(false) }
    }, 300)
  }

  function select(p: Person) {
    setInput(p.name)
    setOpen(false)
    setResults([])
    onChange(p.name, p.email)
  }

  const baseClass = className || 'w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue'

  return (
    <div ref={ref} className="relative">
      <input
        value={input}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={baseClass}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sap-muted text-[10px]">
          searching…
        </span>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-sap-border rounded-xl shadow-lg max-h-56 overflow-y-auto"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
          {results.map(p => (
            <button key={p.email}
              onMouseDown={e => { e.preventDefault(); select(p) }}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-sap-bg border-b border-sap-border last:border-b-0 transition">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-sap-blue flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-sap-text truncate">{p.name}</div>
                <div className="text-[11px] text-sap-muted truncate">{p.email}</div>
                {(p.title || p.department) && (
                  <div className="text-[10px] text-sap-muted truncate">
                    {[p.title, p.department].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && input.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-sap-border rounded-xl shadow p-3 text-[12px] text-sap-muted">
          No people found — Outlook token may be expired
        </div>
      )}
    </div>
  )
}
