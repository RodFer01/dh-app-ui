import type { ColDef } from 'ag-grid-community'

// ── Presales Status — Red / Yellow / Green / N/A ─────────────────────────────
const PRESALES_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  Red:    { bg: '#FFEBEE', text: '#BB0000', label: 'Red' },
  Yellow: { bg: '#FFF8E1', text: '#7A5800', label: 'Yellow' },
  Green:  { bg: '#E8F5E9', text: '#1B5E20', label: 'Green' },
  'N/A':  { bg: '#F5F5F5', text: '#9E9E9E', label: 'N/A' },
}

export const PRESALES_OPTIONS = ['Green', 'Yellow', 'Red', 'N/A']

export function presalesStatusCol(width = 120): ColDef {
  return {
    field: 'presales_lead_status',
    headerName: 'Presales',
    width,
    cellStyle: (p: any): any => {
      const key = p.value ?? 'N/A'
      const c = PRESALES_COLORS[key]
      if (!c) return { background: '#F5F5F5', color: '#9E9E9E', fontWeight: 600 }
      return { background: c.bg, color: c.text, fontWeight: key === 'N/A' ? 400 : 700, borderRadius: '4px' }
    },
    valueFormatter: (p: any) => p.value ?? 'N/A',
  }
}

// ── Deal Qualification Decision — Go / Re-Qualify / No-Go ─────────────────────
const QUAL_COLORS: Record<string, { bg: string; text: string }> = {
  'Go':         { bg: '#E8F5E9', text: '#1B5E20' },
  'Re-Qualify': { bg: '#FFF8E1', text: '#7A5800' },
  'No-Go':      { bg: '#FFEBEE', text: '#BB0000' },
}

export const QUAL_DECISION_OPTIONS = ['Go', 'Re-Qualify', 'No-Go']

export function qualDecisionCol(width = 120): ColDef {
  return {
    field: 'deal_qualification_decision',
    headerName: 'Qual Decision',
    width,
    cellStyle: (p: any): any => {
      const c = QUAL_COLORS[p.value]
      if (!c) return {}
      return { background: c.bg, color: c.text, fontWeight: 700, borderRadius: '4px' }
    },
    valueFormatter: (p: any) => p.value ?? '—',
  }
}

// ── Shared toggle filter UI component helper ───────────────────────────────────
// Returns JSX-like config — used by each page to render pill toggles consistently

export function PresalesFilterPills({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {PRESALES_OPTIONS.map(s => {
        const c = PRESALES_COLORS[s]
        const active = selected.includes(s)
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              border: `1.5px solid ${active ? c.text : '#D0D5DD'}`,
              background: active ? c.bg : '#fff',
              color: active ? c.text : '#888',
              cursor: 'pointer', transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: active ? c.text : '#D0D5DD',
            }} />
            {s}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button onClick={() => onChange([])}
          style={{ fontSize: 10, color: '#BB0000', background: 'none', border: 'none', cursor: 'pointer' }}>
          Clear
        </button>
      )}
    </div>
  )
}

export function QualDecisionFilterPills({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {QUAL_DECISION_OPTIONS.map(s => {
        const c = QUAL_COLORS[s]
        const active = selected.includes(s)
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              border: `1.5px solid ${active ? c.text : '#D0D5DD'}`,
              background: active ? c.bg : '#fff',
              color: active ? c.text : '#888',
              cursor: 'pointer', transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: active ? c.text : '#D0D5DD',
            }} />
            {s}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button onClick={() => onChange([])}
          style={{ fontSize: 10, color: '#BB0000', background: 'none', border: 'none', cursor: 'pointer' }}>
          Clear
        </button>
      )}
    </div>
  )
}
