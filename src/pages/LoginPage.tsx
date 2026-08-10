// @ts-nocheck
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

const AZURE_CLIENT_ID = 'd05149f3-407b-4029-b257-57fc36c06e59'
const AZURE_TENANT_ID = '42f7676c-f455-423c-82f6-dc2d99791af7'
const REDIRECT_URI    = `${window.location.origin}/auth/callback`

function getMsalLoginUrl() {
  const params = new URLSearchParams({
    client_id:     AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri:  REDIRECT_URI,
    scope:         'openid profile email User.Read offline_access',
    response_mode: 'query',
    prompt:        'select_account',
  })
  return `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`
}

export function LoginPage() {
  const { login, loginWithToken } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [msalLoading, setMsalLoading] = useState(false)

  // Handle Azure callback code (when redirected back from Microsoft)
  useEffect(() => {
    const url    = new URL(window.location.href)
    const code   = url.searchParams.get('code')
    const errAz  = url.searchParams.get('error_description')
    if (errAz) { setError('Microsoft login failed: ' + errAz); return }
    if (!code) return

    // Clear code from URL to avoid re-processing on refresh
    window.history.replaceState({}, '', '/')
    setMsalLoading(true)

    api.post('/api/auth/azure', { code, redirect_uri: REDIRECT_URI })
      .then(r => {
        loginWithToken(r.data)
        navigate('/', { replace: true })
      })
      .catch(e => {
        setError(e?.response?.data?.detail || 'Microsoft login failed. Try again.')
        setMsalLoading(false)
      })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleMicrosoftLogin = () => {
    setMsalLoading(true)
    window.location.href = getMsalLoginUrl()
  }

  if (msalLoading) {
    return (
      <div className="min-h-screen bg-sap-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-sap-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sap-muted text-sm">Signing in with Microsoft…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sap-bg flex flex-col">
      {/* Shell */}
      <div className="bg-sap-blue text-white flex items-center gap-3 px-6 h-12 shadow-sm">
        <div className="bg-white text-sap-blue text-[11px] font-black px-1.5 py-0.5 rounded">SAP</div>
        <span className="font-bold text-[15px] pr-4 border-r border-white/25">Digital Hub SA Main App</span>
        <span className="text-[13px] opacity-85">LAC Solution Advisor Manager</span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center">
        <div className="card p-10 w-full max-w-sm text-center">
          <div className="bg-sap-blue rounded-[10px] w-12 h-12 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-sm">SAP</span>
          </div>
          <h2 className="text-xl font-bold text-sap-text mb-1">Sign in</h2>
          <p className="text-[13px] text-sap-muted mb-6">Digital Hub Solution Advisor Main App</p>

          {/* Microsoft SSO button */}
          <button
            onClick={handleMicrosoftLogin}
            className="w-full flex items-center justify-center gap-3 border border-sap-border rounded-lg px-3 py-2.5 text-sm font-semibold text-sap-text hover:bg-sap-bg transition mb-4"
          >
            {/* Microsoft logo */}
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft (SAP)
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-sap-border" />
            <span className="text-[11px] text-sap-muted">or</span>
            <div className="flex-1 h-px bg-sap-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email" required autoFocus
              placeholder="your.email@sap.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue focus:ring-2 focus:ring-sap-blue/10"
            />
            <input
              type="password" required
              placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue focus:ring-2 focus:ring-sap-blue/10"
            />
            {error && <p className="text-sap-error text-sm">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="bg-sap-blue hover:bg-sap-blue-d text-white font-semibold py-2 rounded-lg transition disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-[11px] text-sap-subtle mt-4">
            Microsoft SSO uses your SAP corporate account
          </p>
        </div>
      </div>
    </div>
  )
}
