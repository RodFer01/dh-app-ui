import { LogOut, RefreshCw, DollarSign, Euro, Database } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../lib/api'

interface Props { title?: string; subtitle?: string }

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function useProfilePhoto() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  useEffect(() => {
    const token = localStorage.getItem('dh_outlook_token')
    if (!token) return
    fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      if (r.ok) return r.blob()
      throw new Error('no photo')
    }).then(blob => {
      setPhotoUrl(URL.createObjectURL(blob))
    }).catch(() => {})
    return () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }
  }, [])
  return photoUrl
}

export function ShellBar({ title = 'Digital Hub SA Main App', subtitle = 'LAC Solution Advisor Manager' }: Props) {
  const { user, logout, currency, toggleCurrency } = useAuth()
  const qc = useQueryClient()
  const initials  = user?.name.split(/[\s,]+/).slice(0,2).map(p => p[0]?.toUpperCase()).join('') ?? '?'
  const firstName = user?.name.split(',')[0].trim().split(' ')[0] ?? ''
  const photoUrl  = useProfilePhoto()

  const { data: dataStatus } = useQuery({
    queryKey: ['data-status'],
    queryFn: () => api.get('/api/data-status').then(r => r.data),
    staleTime: 10 * 60_000,
    enabled: !!user,
  })

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-sap-border shadow-sm flex items-center gap-4 px-6 py-2.5">
      {/* SAP logo */}
      <img src="/sap-logo.png" alt="SAP" className="h-8 flex-shrink-0" />

      {/* Title */}
      <div className="pr-4 border-r border-sap-border">
        <div className="text-[15px] font-bold text-sap-text whitespace-nowrap">{title}</div>
        <div className="text-[11px] text-sap-muted">{subtitle}</div>
      </div>

      {/* Data freshness badge */}
      {dataStatus?.pipeline_snapshot && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sap-bg border border-sap-border" title={`Pipeline snapshot: ${fmtDate(dataStatus.pipeline_snapshot)}${dataStatus.melody_last_activity ? ' · Melody last activity: ' + fmtDate(dataStatus.melody_last_activity) : ''}`}>
          <Database size={11} className="text-sap-muted flex-shrink-0" />
          <span className="text-[11px] text-sap-muted font-medium whitespace-nowrap">
            Data updated: <span className="text-sap-text font-semibold">{fmtDate(dataStatus.pipeline_snapshot)}</span>
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleCurrency}
          className="flex items-center gap-1 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
        >
          {currency === 'USD' ? <DollarSign size={13} /> : <Euro size={13} />}
          {currency}
        </button>

        <button
          onClick={() => qc.invalidateQueries()}
          title="Refresh data"
          className="flex items-center gap-1 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
        >
          <RefreshCw size={13} /> Refresh
        </button>

        <button
          onClick={logout}
          title="Sign out"
          className="flex items-center gap-1 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
        >
          <LogOut size={13} /> Sign out
        </button>

        {/* User chip */}
        <div className="flex items-center gap-2 bg-sap-bg rounded-full px-3 py-1 text-xs">
          <div className="w-6 h-6 rounded-full bg-sap-blue text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">
            {photoUrl
              ? <img src={photoUrl} alt={initials} className="w-full h-full object-cover" />
              : initials}
          </div>
          <span className="text-sap-text font-medium">{firstName}</span>
        </div>
      </div>
    </header>
  )
}
