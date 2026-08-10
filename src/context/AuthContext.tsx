import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api from '../lib/api'

interface User { email: string; name: string; role?: string; modules?: string[] }
interface AuthCtx {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  loginWithToken: (data: any) => void
  logout: () => void
  currency: 'USD' | 'EUR'
  fxRate: number
  toggleCurrency: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem('dh_user')
    return u ? JSON.parse(u) : null
  })
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD')
  const [fxRate, setFxRate]   = useState(1.0)

  // On mount, refresh user profile from /api/auth/me to pick up permission changes
  useEffect(() => {
    const token = localStorage.getItem('dh_token')
    if (!token) return
    api.get('/api/auth/me').then(r => {
      const u = { email: r.data.email, name: r.data.name, role: r.data.role || 'viewer', modules: r.data.modules || [] }
      localStorage.setItem('dh_user', JSON.stringify(u))
      setUser(u)
    }).catch((err) => {
      // Only clear session on explicit 401 — network errors or 5xx should not log out
      if (err?.response?.status === 401) {
        localStorage.removeItem('dh_token')
        localStorage.removeItem('dh_user')
        setUser(null)
      }
    })
  }, [])

  // Fetch FX rate when currency switches to EUR
  useEffect(() => {
    if (currency === 'EUR' && user) {
      api.get('/api/fx/rate').then(r => setFxRate(r.data?.rate ?? 1))
    } else {
      setFxRate(1.0)
    }
  }, [currency, user])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    loginWithToken(data)
  }

  const loginWithToken = (data: any) => {
    localStorage.setItem('dh_token', data.access_token)
    const u = { email: data.email, name: data.name, role: data.role || 'viewer', modules: data.modules || [] }
    localStorage.setItem('dh_user', JSON.stringify(u))
    // Save Outlook token if provided (from Azure SSO)
    if (data.outlook_token) {
      localStorage.setItem('dh_outlook_token', data.outlook_token)
      localStorage.setItem('dh_outlook_expires', String(Math.floor(Date.now()/1000) + (data.outlook_expires_in || 3600)))
      // Sync to server so background services (team-calendar, mail) can use it
      api.post('/api/auth/sync-outlook-token', {
        outlook_token: data.outlook_token,
        expires_in: data.outlook_expires_in || 3600,
      }, { headers: { Authorization: `Bearer ${data.access_token}` } }).catch(() => {})
    }
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('dh_token')
    localStorage.removeItem('dh_user')
    setUser(null)
  }

  const toggleCurrency = () => setCurrency(c => c === 'USD' ? 'EUR' : 'USD')

  return (
    <AuthContext.Provider value={{ user, login, loginWithToken, logout, currency, fxRate, toggleCurrency }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
