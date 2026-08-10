// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

const ALL_MODULES = [
  'pipeline','melody','erp_team','lobs_team','melody_requests',
  'etl','scheduler','yoy','qualification','lac_results','opportunities',
  'ae_analysis','feedback','actions','team_agenda','idea_zone','admin',
]
const MODULE_LABELS: Record<string, string> = {
  pipeline: 'ADRM Pipeline', melody: 'Melody Analysis', erp_team: 'ERP Team',
  lobs_team: 'LoBs Team', melody_requests: 'Melody Requests', etl: 'Update Data',
  scheduler: 'Pipeline Scheduler', yoy: '2025 vs 2026', qualification: 'Deal Qualification',
  lac_results: 'LAC Results', opportunities: 'Opportunity List',
  feedback: '1:1 Feedback', actions: 'Actions', team_agenda: 'Team Agenda',
  idea_zone: 'IdeaZone', ae_analysis: 'AE Territory Analysis', admin: 'Administration',
}
const ROLE_COLORS = {
  admin:   { bg: '#fce8e8', color: '#BB0000', label: 'Admin' },
  manager: { bg: '#fff3e0', color: '#E76500', label: 'Manager' },
  viewer:  { bg: '#e8f5e9', color: '#256f3a', label: 'Viewer' },
}
const ROLE_PROFILES: Record<string, { label: string; description: string; role: string; modules: string[] }> = {
  admin:       { label: 'Admin',       description: 'Full access to all modules', role: 'admin', modules: ALL_MODULES },
  erp_manager: { label: 'ERP Manager', description: 'Pipeline, Melody, ERP Team, MR, YoY, Qual, LAC Results, Opp List, AE Territory', role: 'manager', modules: ['pipeline','melody','erp_team','melody_requests','yoy','qualification','lac_results','opportunities','ae_analysis'] },
  lob_manager: { label: 'LoB Manager', description: 'Pipeline, Melody, LoB Team, MR, YoY, Qual, LAC Results, Opp List, AE Territory', role: 'manager', modules: ['pipeline','melody','lobs_team','melody_requests','yoy','qualification','lac_results','opportunities','ae_analysis'] },
  spoc:        { label: 'SPOC',        description: 'Pipeline, Melody, ERP Team, Qualification, Opp List', role: 'viewer', modules: ['pipeline','melody','erp_team','qualification','opportunities'] },
  spoc_lob:    { label: 'SPOC LoB',   description: 'Pipeline, Melody, LoB Team, Qualification, Opp List', role: 'viewer', modules: ['pipeline','melody','lobs_team','qualification','opportunities'] },
  viewer:      { label: 'Viewer',      description: 'No default modules — customize manually', role: 'viewer', modules: [] },
}

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_COLORS[role] || { bg: '#f0f2f4', color: '#556b82', label: role }
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function ModuleChip({ mod, active }: { mod: string; active: boolean }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${active ? 'bg-sap-blue-l text-sap-blue' : 'bg-sap-bg text-sap-subtle line-through'}`}>
      {MODULE_LABELS[mod] ?? mod}
    </span>
  )
}

export function AdminPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'users' | 'logs'>('users')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<any | null>(null)
  const [logEmail, setLogEmail] = useState('')
  const [logAction, setLogAction] = useState('')

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/api/admin/users').then(r => r.data),
  })

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['admin-logs', logEmail, logAction],
    queryFn: () => api.get('/api/admin/logs', {
      params: { limit: 200, email: logEmail || undefined, action: logAction || undefined }
    }).then(r => r.data),
    enabled: tab === 'logs',
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/users/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-sap-muted">
        <p className="text-4xl mb-4">🔒</p>
        <p className="font-semibold text-sap-text">Access Denied</p>
        <p className="text-sm mt-1">This section requires administrator privileges.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-sap-text">Administration</h2>
          <p className="text-sm text-sap-muted mt-0.5">User management, permissions and access logs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-sap-border mb-5">
        {(['users', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-sap-blue text-sap-blue' : 'border-transparent text-sap-muted hover:text-sap-blue'
            }`}>
            {t === 'users' ? `👥 Users (${users.length})` : '📋 Access Logs'}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowCreate(true)}
              className="bg-sap-blue hover:bg-sap-blue-d text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              + Add User
            </button>
          </div>

          {loadingUsers ? <p className="text-sap-muted text-sm">Loading…</p> : (
            <div className="card overflow-hidden">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f8f9fa]">
                    {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Modules', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-sap-muted uppercase tracking-wide border-b border-sap-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-sap-bg transition-colors border-b border-sap-border last:border-0">
                      <td className="px-3 py-2.5 font-semibold">{u.name}</td>
                      <td className="px-3 py-2.5 text-sap-muted text-[12px]">{u.email}</td>
                      <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] font-bold ${u.is_active ? 'text-sap-success' : 'text-sap-error'}`}>
                          {u.is_active ? '● Active' : '○ Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-sap-subtle whitespace-nowrap">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {ALL_MODULES.map(m => (
                            <ModuleChip key={m} mod={m} active={u.modules?.includes(m)} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-2">
                          <button onClick={() => setEditUser(u)}
                            className="text-xs text-sap-blue hover:underline font-semibold">Edit</button>
                          {u.email !== user?.email && (
                            <button
                              onClick={() => { if (confirm(`Delete ${u.name}?`)) deleteMut.mutate(u.id) }}
                              className="text-xs text-sap-error hover:underline font-semibold">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {tab === 'logs' && (
        <div>
          <div className="flex gap-3 mb-3">
            <input value={logEmail} onChange={e => setLogEmail(e.target.value)}
              placeholder="Filter by email…"
              className="border border-sap-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sap-blue w-64" />
            <select value={logAction} onChange={e => setLogAction(e.target.value)}
              className="border border-sap-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sap-blue">
              <option value="">All actions</option>
              {['login','logout','user_created','user_updated','user_deleted','etl_run','data_export'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          {loadingLogs ? <p className="text-sap-muted text-sm">Loading…</p> : (
            <div className="card overflow-hidden">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#f8f9fa]">
                    {['When', 'User', 'Action', 'Module', 'Detail'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-sap-muted uppercase tracking-wide border-b border-sap-border">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id} className="border-b border-sap-border hover:bg-sap-bg last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-sap-subtle">
                        {new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-3 py-2 text-sap-muted">{l.email || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`font-semibold ${
                          l.action === 'login' ? 'text-sap-success' :
                          l.action?.includes('delete') ? 'text-sap-error' :
                          'text-sap-blue'
                        }`}>{l.action}</span>
                      </td>
                      <td className="px-3 py-2 text-sap-muted">{l.module || '—'}</td>
                      <td className="px-3 py-2 text-sap-subtle max-w-[360px] truncate">{l.detail || '—'}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-sap-muted">No logs found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE USER MODAL ── */}
      {showCreate && (
        <UserModal
          title="Add User"
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            await api.post('/api/admin/users', data)
            qc.invalidateQueries({ queryKey: ['admin-users'] })
            setShowCreate(false)
          }}
        />
      )}

      {/* ── EDIT USER MODAL ── */}
      {editUser && (
        <UserModal
          title={`Edit — ${editUser.name}`}
          initialData={editUser}
          onClose={() => setEditUser(null)}
          onSave={async (data) => {
            await api.patch(`/api/admin/users/${editUser.id}`, data)
            qc.invalidateQueries({ queryKey: ['admin-users'] })
            setEditUser(null)
          }}
        />
      )}
    </div>
  )
}

// ── User create/edit modal ────────────────────────────────────────────────────
function UserModal({ title, initialData, onClose, onSave }: {
  title: string
  initialData?: any
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const isEdit = !!initialData
  const [name, setName] = useState(initialData?.name || '')
  const [email, setEmail] = useState(initialData?.email || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(initialData?.role || 'viewer')
  const [profile, setProfile] = useState('')
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true)
  const [modules, setModules] = useState<string[]>(initialData?.modules || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleModule(m: string) {
    setModules(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])
  }

  function applyProfile(key: string) {
    setProfile(key)
    if (!key) return
    const p = ROLE_PROFILES[key]
    if (!p) return
    setRole(p.role)
    setModules([...p.modules])
  }

  function selectByRole(r: string) {
    setRole(r)
    setProfile('')
    if (r === 'admin') setModules([...ALL_MODULES])
    else if (r === 'manager') setModules(ALL_MODULES.filter(m => m !== 'admin'))
    else setModules([])
  }

  async function handleSave() {
    setError('')
    if (!name.trim() || (!isEdit && !email.trim())) { setError('Name and email are required'); return }
    if (!isEdit && !password.trim()) { setError('Password is required'); return }
    setSaving(true)
    try {
      const payload: any = { name: name.trim(), role, modules, profile }
      if (!isEdit) payload.email = email.trim()
      if (!isEdit || password) payload.password = password || undefined
      if (isEdit) payload.is_active = isActive
      await onSave(payload)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Error')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-[580px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sap-border">
          <h3 className="font-bold text-sap-text">{title}</h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">

          {/* Profile selector — only shown on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-sap-muted uppercase tracking-wide mb-1">Role Profile</label>
              <select value={profile} onChange={e => applyProfile(e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sap-blue">
                <option value="">— Select a profile (or configure manually) —</option>
                {Object.entries(ROLE_PROFILES).map(([key, p]) => (
                  <option key={key} value={key}>{p.label} — {p.description}</option>
                ))}
              </select>
              {profile && (
                <p className="text-[11px] text-sap-blue mt-1">
                  Profile applied: <b>{ROLE_PROFILES[profile]?.label}</b> — role set to <b>{ROLE_PROFILES[profile]?.role}</b>, {ROLE_PROFILES[profile]?.modules.length} modules pre-selected. You can still adjust below.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-sap-muted mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sap-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sap-muted mb-1">Email *</label>
              <input value={email} onChange={e => setEmail(e.target.value)} disabled={isEdit}
                className="w-full border border-sap-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sap-blue disabled:bg-sap-bg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-sap-muted mb-1">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sap-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sap-muted mb-1">Role</label>
              <select value={role} onChange={e => selectByRole(e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-sap-blue">
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-sap-blue" />
              <span>Active account</span>
            </label>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-sap-muted uppercase tracking-wide">Module Access</label>
              <div className="flex gap-2">
                <button onClick={() => setModules([...ALL_MODULES])} className="text-[11px] text-sap-blue hover:underline">All</button>
                <button onClick={() => setModules([])} className="text-[11px] text-sap-muted hover:underline">None</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_MODULES.map(m => (
                <label key={m} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer text-[12px] transition-colors ${modules.includes(m) ? 'border-sap-blue bg-sap-blue-l text-sap-blue' : 'border-sap-border text-sap-muted hover:border-sap-blue'}`}>
                  <input type="checkbox" checked={modules.includes(m)} onChange={() => toggleModule(m)} className="accent-sap-blue" />
                  {MODULE_LABELS[m] ?? m}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-sap-error bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-sap-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-sap-border rounded-lg hover:bg-sap-bg transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-sap-blue text-white rounded-lg hover:bg-sap-blue-d disabled:opacity-60 transition">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create User')}
          </button>
        </div>
      </div>
    </div>
  )
}
