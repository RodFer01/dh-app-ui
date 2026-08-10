import { oppUrl } from '../lib/utils'

function OppLink({ value }: { value: string }) {
  if (!value) return <span>—</span>
  return (
    <a
      href={oppUrl(value)}
      target="_blank"
      rel="noreferrer"
      style={{ color: '#0070f2', fontWeight: 600, fontFamily: 'monospace', textDecoration: 'none' }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
    >
      {value}
    </a>
  )
}

export const oppIdCol = {
  field: 'opportunity_id',
  headerName: 'Opp #',
  width: 160,
  cellRenderer: (p: { value: string }) => <OppLink value={p.value} />,
}
