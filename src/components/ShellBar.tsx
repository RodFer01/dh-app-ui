import { LogOut, RefreshCw, DollarSign, Euro, Database, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'

interface Props { title?: string; subtitle?: string }

interface ActiveUser { email: string; name: string; role: string; last_seen_at: string }
interface Toast { id: number; name: string; email: string }

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtSince(iso: string | null) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'agora mesmo'
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`
  return `${Math.floor(diff / 3600)}h atrás`
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

function useOnlineNotifications(enabled: boolean) {
  const [onlineUsers, setOnlineUsers] = useState<ActiveUser[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const knownEmails = useRef<Set<string> | null>(null)
  const toastCounter = useRef(0)

  useEffect(() => {
    if (!enabled) return

    async function poll() {
      try {
        const res = await api.get<ActiveUser[]>('/api/admin/active-users')
        const users = res.data ?? []
        setOnlineUsers(users)

        const currentEmails = new Set(users.map(u => u.email))

        if (knownEmails.current === null) {
          // first poll — seed without toasting
          knownEmails.current = currentEmails
          return
        }

        // detect new arrivals
        const newUsers = users.filter(u => !knownEmails.current!.has(u.email))
        if (newUsers.length > 0) {
          const newToasts: Toast[] = newUsers.map(u => ({
            id: ++toastCounter.current,
            name: u.name,
            email: u.email,
          }))
          setToasts(prev => [...prev, ...newToasts])
          newToasts.forEach(t => {
            setTimeout(() => dismissToast(t.id), 6000)
          })
        }
        knownEmails.current = currentEmails
      } catch { /* silent */ }
    }

    poll()
    const interval = setInterval(poll, 30_000)
    return () => clearInterval(interval)
  }, [enabled])

  function dismissToast(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { onlineUsers, toasts, dismissToast }
}

export function ShellBar({ subtitle = 'LAC Solution Advisor Manager' }: Props) {
  const { user, logout, currency, toggleCurrency } = useAuth()
  const qc = useQueryClient()
  const initials  = user?.name.split(/[\s,]+/).slice(0,2).map(p => p[0]?.toUpperCase()).join('') ?? '?'
  const firstName = user?.name.split(',')[0].trim().split(' ')[0] ?? ''
  const photoUrl  = useProfilePhoto()
  const [onlineOpen, setOnlineOpen] = useState(false)

  const canSeeOnline = ['admin', 'manager'].includes(user?.role ?? '')
  const { onlineUsers, toasts, dismissToast } = useOnlineNotifications(!!user && canSeeOnline)

  const { data: dataStatus } = useQuery({
    queryKey: ['data-status'],
    queryFn: () => api.get('/api/data-status').then(r => r.data),
    staleTime: 10 * 60_000,
    enabled: !!user,
  })

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-sap-border shadow-sm flex items-center gap-4 px-6 py-2.5">
        {/* Digital Hub logo */}
        <img src="/dh-logo.png" alt="Digital Hub Latin America" className="h-9 flex-shrink-0" />

        {/* Divider + subtitle */}
        <div className="pr-4 border-r border-sap-border">
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

          {/* Online users button (admin/manager only) */}
          {canSeeOnline && (
            <div className="relative">
              <button
                onClick={() => setOnlineOpen(o => !o)}
                className="relative flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
                title="Usuários online agora"
              >
                <Users size={13} />
                <span>Online</span>
                {onlineUsers.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {onlineUsers.length}
                  </span>
                )}
              </button>

              {onlineOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-sap-border rounded-xl shadow-2xl z-[200] py-2">
                  <div className="px-4 py-2 border-b border-sap-border flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sap-muted uppercase tracking-wide">Usuários ativos agora</span>
                    <button onClick={() => setOnlineOpen(false)} className="text-sap-muted hover:text-sap-text">
                      <X size={13} />
                    </button>
                  </div>
                  {onlineUsers.length === 0 ? (
                    <p className="px-4 py-3 text-[12px] text-sap-muted">Nenhum outro usuário ativo nos últimos 10 minutos.</p>
                  ) : (
                    onlineUsers.map(u => (
                      <div key={u.email} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sap-bg">
                        <div className="w-7 h-7 rounded-full bg-sap-blue text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {u.name.split(/[\s,]+/).slice(0,2).map(p => p[0]?.toUpperCase()).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-sap-text truncate">{u.name}</p>
                          <p className="text-[11px] text-sap-muted">{fmtSince(u.last_seen_at)}</p>
                        </div>
                        <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

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

      {/* Login toasts — fixed top-right, below header */}
      <div className="fixed top-16 right-5 z-[300] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 bg-white border border-sap-border rounded-xl shadow-2xl px-4 py-3 min-w-[260px] animate-slide-in"
          >
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
              {t.name.split(/[\s,]+/).slice(0,2).map(p => p[0]?.toUpperCase()).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-sap-text truncate">{t.name}</p>
              <p className="text-[11px] text-sap-muted">entrou no portal agora</p>
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-sap-muted hover:text-sap-text flex-shrink-0">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
