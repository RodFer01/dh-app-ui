// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Plus, Pencil, Trash2, Users, X, Mail, CheckCircle, Clock, Zap, Copy, ChevronDown, ChevronUp, Key } from 'lucide-react'

const STATUS_OPTS = [
  { value: 'active',  label: 'Ativa' },
  { value: 'paused',  label: 'Pausada' },
  { value: 'closed',  label: 'Encerrada' },
]

const STATUS_STYLE = {
  active:  'bg-green-100 text-green-800',
  paused:  'bg-yellow-100 text-yellow-800',
  closed:  'bg-gray-100 text-gray-500',
}

function fmtDate(d) {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

function CampaignModal({ campaign, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!campaign

  const [form, setForm] = useState({
    name:       campaign?.name       ?? '',
    owner:      campaign?.owner      ?? '',
    objective:  campaign?.objective  ?? '',
    start_date: campaign?.start_date ? String(campaign.start_date).slice(0, 10) : '',
    end_date:   campaign?.end_date   ? String(campaign.end_date).slice(0, 10)   : '',
    status:     campaign?.status     ?? 'active',
    results:    campaign?.results    ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [sparkSelIds, setSparkSelIds] = useState([])
  const [showSpark, setShowSpark] = useState(false)

  const { data: allSparkSessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['spark-all-sessions'],
    queryFn: () => api.get('/api/spark/sessions').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.sessions ?? [])
    }),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (isEdit && campaign?.id) {
      api.get(`/api/campaigns/${campaign.id}/sessions`).then(r => {
        setSparkSelIds(r.data ?? [])
      }).catch(() => {})
    }
  }, [isEdit, campaign?.id])

  const sessionsByAreaMonth = useMemo(() => {
    // groups[area][monthKey] = { label, sessions }
    const groups: Record<string, Record<string, { label: string; sessions: any[] }>> = {}
    for (const s of allSparkSessions) {
      const area = s.area || 'Outros'
      if (!groups[area]) groups[area] = {}
      let monthKey = '9999-99'
      let monthLabel = 'Sem data'
      if (s.next_date) {
        monthKey = String(s.next_date).slice(0, 7)
        const d = new Date(String(s.next_date) + 'T00:00:00')
        monthLabel = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
        monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
      }
      if (!groups[area][monthKey]) groups[area][monthKey] = { label: monthLabel, sessions: [] }
      groups[area][monthKey].sessions.push(s)
    }
    return groups
  }, [allSparkSessions])

  const toggleSparkSession = (id) => {
    setSparkSelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true); setErr('')
    try {
      const payload = {
        ...form,
        start_date: form.start_date || null,
        end_date:   form.end_date   || null,
      }
      let campaignId
      if (isEdit) {
        await api.put(`/api/campaigns/${campaign.id}`, payload)
        campaignId = campaign.id
      } else {
        const r = await api.post('/api/campaigns', payload)
        campaignId = r.data.id
      }
      if (campaignId) {
        await api.patch(`/api/campaigns/${campaignId}/sessions`, { session_ids: sparkSelIds })
      }
      await qc.invalidateQueries({ queryKey: ['campaigns'] })
      onClose()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue'
  const labelCls = 'text-[11px] font-semibold text-sap-muted uppercase tracking-wide'

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[92vh] overflow-y-auto border border-sap-border flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border flex-shrink-0">
          <h3 className="text-[16px] font-bold text-sap-text">
            {isEdit ? 'Editar Campanha' : 'Nova Campanha'}
          </h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text text-lg">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome da campanha" />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Responsável</label>
            <input className={inputCls} value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="Nome do owner" />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Objetivo</label>
            <textarea className={inputCls + ' resize-none'} rows={3} value={form.objective} onChange={e => set('objective', e.target.value)} placeholder="Descreva o objetivo da campanha" />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className={labelCls}>Início</label>
              <input type="date" className={inputCls} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className={labelCls}>Fim</label>
              <input type="date" className={inputCls} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Resultados</label>
            <textarea className={inputCls + ' resize-none'} rows={3} value={form.results} onChange={e => set('results', e.target.value)} placeholder="Resultados e observações" />
          </div>

          {/* Spark Meeting Sessions */}
          <div className="border-t border-sap-border pt-4">
            <button
              type="button"
              className="flex items-center justify-between w-full text-left"
              onClick={() => setShowSpark(s => !s)}
            >
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-sap-text">
                <Zap size={13} className="text-amber-500" />
                Spark Meeting Sessions
                {sparkSelIds.length > 0 && (
                  <span className="bg-sap-blue text-white text-[10px] rounded-full px-1.5 py-0.5 normal-case tracking-normal font-semibold">
                    {sparkSelIds.length} selecionada{sparkSelIds.length !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
              {showSpark ? <ChevronUp size={14} className="text-sap-muted flex-shrink-0" /> : <ChevronDown size={14} className="text-sap-muted flex-shrink-0" />}
            </button>

            {showSpark && (
              <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                {loadingSessions ? (
                  <div className="text-[12px] text-sap-muted py-4 text-center">Carregando sessões...</div>
                ) : allSparkSessions.length === 0 ? (
                  <div className="text-[12px] text-sap-muted py-4 text-center">Nenhuma sessão disponível.</div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {Object.entries(sessionsByAreaMonth).map(([area, monthMap]) => (
                      <div key={area}>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-sap-blue mb-2 px-1 border-b border-sap-border pb-1">{area}</div>
                        <div className="flex flex-col gap-3 mt-2">
                          {Object.entries(monthMap)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([monthKey, { label, sessions }]) => (
                              <div key={monthKey}>
                                <div className="flex items-center gap-1.5 mb-1 px-1">
                                  <span className="text-[10px] font-semibold text-sap-muted">{label}</span>
                                  <span className="text-[9px] text-sap-muted bg-sap-bg border border-sap-border rounded-full px-1.5 py-px">{sessions.length}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {(sessions as any[]).map((s: any) => (
                                    <label
                                      key={s.id}
                                      className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                        sparkSelIds.includes(s.id)
                                          ? 'border-sap-blue bg-sap-blue-l'
                                          : 'border-sap-border hover:bg-sap-bg'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={sparkSelIds.includes(s.id)}
                                        onChange={() => toggleSparkSession(s.id)}
                                        className="mt-0.5 flex-shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <div className="text-[12px] font-semibold text-sap-text leading-snug">{s.title}</div>
                                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-sap-muted">
                                          {s.language && <span>{s.language === 'PT' ? '🇧🇷 PT' : '🇪🇸 ES'}</span>}
                                          {s.next_date && <span>📅 {String(s.next_date).slice(0, 10)}</span>}
                                          {s.advisor_name && <span>👤 {s.advisor_name}</span>}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {err && <div className="text-[12px] text-red-500">{err}</div>}
        </div>

        <div className="px-6 py-4 border-t border-sap-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 text-[13px] border border-sap-border rounded-lg hover:bg-sap-bg">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Contacts modal ────────────────────────────────────────────────────────────

function ContactsModal({ campaign, onClose }) {
  const qc = useQueryClient()
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['campaign-contacts', campaign.id],
    queryFn: () => api.get(`/api/campaigns/${campaign.id}/contacts`).then(r => r.data),
  })

  const handleRemove = async (prospectId) => {
    await api.delete(`/api/campaigns/${campaign.id}/contacts/${prospectId}`)
    qc.invalidateQueries({ queryKey: ['campaign-contacts', campaign.id] })
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[640px] max-h-[85vh] overflow-y-auto border border-sap-border flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border flex-shrink-0">
          <div>
            <h3 className="text-[16px] font-bold text-sap-text">{campaign.name}</h3>
            <div className="text-[12px] text-sap-muted mt-0.5">Contatos da campanha</div>
          </div>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && <div className="text-sm text-sap-muted text-center py-8">Carregando...</div>}

          {!isLoading && contacts.length === 0 && (
            <div className="text-sm text-sap-muted text-center py-8">
              Nenhum contato associado a esta campanha ainda.
            </div>
          )}

          {contacts.length > 0 && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-sap-border">
                  {['Contato', 'Conta', 'Adicionado por', 'Data'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[11px] font-semibold text-sap-muted uppercase tracking-wide">{h}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b border-sap-border last:border-0 hover:bg-sap-bg">
                    <td className="py-2 px-2 font-medium text-sap-text">{c.contact_name || c.prospect_id}</td>
                    <td className="py-2 px-2 text-sap-muted">{c.account_name || c.account_bp || '—'}</td>
                    <td className="py-2 px-2 text-sap-muted">{c.added_by || '—'}</td>
                    <td className="py-2 px-2 text-sap-muted">{fmtDate(c.added_at)}</td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleRemove(c.prospect_id)}
                        className="text-sap-muted hover:text-sap-error transition-colors"
                        title="Remover"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-sap-border flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 text-[13px] border border-sap-border rounded-lg hover:bg-sap-bg">
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── ESS Send modal ────────────────────────────────────────────────────────────

function EssSendModal({ campaign, onClose }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('send')       // 'send' | 'history'
  const [cookieVal, setCookieVal] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectErr, setConnectErr] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [subject, setSubject] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState(null)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [editingEmail, setEditingEmail] = useState({})  // {prospect_id: value}
  const [savingEmail, setSavingEmail] = useState({})
  const [showSecret, setShowSecret] = useState(false)
  const [generatingSecret, setGeneratingSecret] = useState(false)

  const { data: connStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['ess-status'],
    queryFn: () => api.get('/api/ess/cookie/status').then(r => r.data),
    retry: false,
  })

  const { data: contacts = [], isLoading: loadingContacts, refetch: refetchContacts } = useQuery({
    queryKey: ['ess-contact-status', campaign.id],
    queryFn: () => api.get(`/api/ess/campaigns/${campaign.id}/contact-status`).then(r => r.data),
  })

  const { data: sends = [] } = useQuery({
    queryKey: ['ess-sends', campaign.id],
    queryFn: () => api.get(`/api/ess/campaigns/${campaign.id}/sends`).then(r => r.data),
  })

  const { data: sessionIds = [] } = useQuery({
    queryKey: ['campaign-sessions', campaign.id],
    queryFn: () => api.get(`/api/campaigns/${campaign.id}/sessions`).then(r => r.data ?? []),
  })

  const { data: allSessions = [] } = useQuery({
    queryKey: ['spark-all-sessions'],
    queryFn: () => api.get('/api/spark/sessions').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.sessions ?? [])
    }),
    staleTime: 5 * 60_000,
    enabled: sessionIds.length > 0,
  })

  const selectedSessions = useMemo(
    () => allSessions.filter((s: any) => sessionIds.includes(s.id)),
    [allSessions, sessionIds]
  )

  useEffect(() => {
    if (sessionIds.length > 0 && !templateId) {
      setTemplateId('ec22e094-61e0-4e46-9a58-80141bf0373b')
      setTemplateName('Discover Expert Series')
    }
  }, [sessionIds])

  const handleConnect = async () => {
    if (!cookieVal.trim()) { setConnectErr('Cole o valor do cookie.'); return }
    setConnecting(true); setConnectErr('')
    try {
      await api.post('/api/ess/cookie', { email_self_service: cookieVal.trim() })
      setCookieVal('')
      refetchStatus()
    } catch (e) {
      setConnectErr(e?.response?.data?.detail || 'Erro ao salvar cookie.')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await api.delete('/api/ess/cookie')
    refetchStatus()
  }

  const { data: extSecretData, refetch: refetchExtSecret } = useQuery({
    queryKey: ['ess-extension-secret'],
    queryFn: () => api.get('/api/ess/extension-secret').then(r => r.data),
    enabled: !!connStatus?.connected,
  })

  const handleGenerateSecret = async () => {
    setGeneratingSecret(true)
    try {
      await api.post('/api/ess/extension-secret/generate')
      refetchExtSecret()
      setShowSecret(true)
    } finally {
      setGeneratingSecret(false)
    }
  }

  const handleSaveEmail = async (prospectId) => {
    const email = editingEmail[prospectId]?.trim()
    if (!email) return
    setSavingEmail(s => ({ ...s, [prospectId]: true }))
    try {
      await api.patch(`/api/campaigns/${campaign.id}/contacts/${prospectId}/email`, { contact_email: email })
      setEditingEmail(s => { const n = { ...s }; delete n[prospectId]; return n })
      refetchContacts()
    } finally {
      setSavingEmail(s => { const n = { ...s }; delete n[prospectId]; return n })
    }
  }

  const handleSend = async () => {
    if (!templateId.trim() || !subject.trim() || !fromEmail.trim()) return
    setSending(true); setSendResults(null)
    try {
      const r = await api.post(`/api/ess/campaigns/${campaign.id}/send`, {
        template_id: templateId.trim(),
        template_name: templateName.trim() || null,
        subject,
        from_email: fromEmail,
      })
      setSendResults(r.data.results)
      qc.invalidateQueries({ queryKey: ['ess-contact-status', campaign.id] })
      qc.invalidateQueries({ queryKey: ['ess-sends', campaign.id] })
    } catch (e) {
      setSendResults([{ email: '—', status: 'failed', error: e?.response?.data?.detail || 'Erro no envio.' }])
    } finally {
      setSending(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail.trim() || !templateId.trim() || !subject.trim() || !fromEmail.trim()) return
    setSendingTest(true); setTestResult(null)
    try {
      await api.post(`/api/ess/campaigns/${campaign.id}/send-test`, {
        template_id: templateId.trim(),
        template_name: templateName.trim() || null,
        subject,
        from_email: fromEmail,
        test_email: testEmail.trim(),
      })
      setTestResult({ ok: true })
    } catch (e) {
      setTestResult({ ok: false, error: e?.response?.data?.detail || 'Erro no envio.' })
    } finally {
      setSendingTest(false)
    }
  }

  const contactsWithEmail = contacts.filter(c => c.contact_email)
  const contactsWithoutEmail = contacts.filter(c => !c.contact_email)

  const inputCls = 'w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue'
  const labelCls = 'text-[11px] font-semibold text-sap-muted uppercase tracking-wide'

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[760px] max-h-[92vh] flex flex-col border border-sap-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border flex-shrink-0">
          <div>
            <h3 className="text-[16px] font-bold text-sap-text flex items-center gap-2">
              <Mail size={16} className="text-sap-blue" />
              Email via ESS
            </h3>
            <div className="text-[12px] text-sap-muted mt-0.5">{campaign.name}</div>
          </div>
          <div className="flex items-center gap-2">
            {['send', 'history'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-[13px] px-3 py-1 rounded-lg transition-colors ${
                  tab === t ? 'bg-sap-blue text-white' : 'text-sap-muted hover:bg-sap-bg'
                }`}
              >
                {t === 'send' ? 'Enviar' : `Histórico${sends.length ? ` (${sends.length})` : ''}`}
              </button>
            ))}
            <button onClick={onClose} className="text-sap-muted hover:text-sap-text ml-1"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

          {/* ESS Connection Banner */}
          <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-[13px] ${
            connStatus?.connected
              ? 'bg-green-50 border border-green-200'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connStatus?.connected ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className={connStatus?.connected ? 'text-green-800' : 'text-amber-800'}>
                {connStatus?.connected
                  ? `Cookie ESS armazenado (salvo em ${connStatus.stored_at})`
                  : 'ESS não conectado — cole seu cookie de sessão para ativar o envio direto'}
              </span>
            </div>
            {connStatus?.connected && (
              <button onClick={handleDisconnect} className="text-[12px] text-sap-muted hover:text-red-600 ml-4 whitespace-nowrap">
                Desconectar
              </button>
            )}
          </div>

          {/* Connect ESS */}
          {!connStatus?.connected && (
            <div className="bg-sap-bg border border-sap-border rounded-lg p-4 flex flex-col gap-3 text-[13px]">
              <div className="font-semibold text-sap-text">Como obter o cookie ESS:</div>
              <ol className="list-decimal list-inside text-sap-muted space-y-1 text-[12px]">
                <li>Abra <a href="https://ess.int.sap" target="_blank" rel="noreferrer" className="text-sap-blue underline">ess.int.sap</a> e faça login com seu SAP SSO</li>
                <li>Pressione <strong>F12</strong> → aba <strong>Application</strong> → <strong>Cookies</strong> → <strong>ess.int.sap</strong></li>
                <li>Copie o valor do cookie <code className="bg-white border border-sap-border px-1 rounded font-mono">EmailSelfService</code></li>
                <li>Cole abaixo e clique em <strong>Salvar</strong></li>
              </ol>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} font-mono text-[11px]`}
                  placeholder="Cole o valor do cookie EmailSelfService aqui..."
                  value={cookieVal}
                  onChange={e => setCookieVal(e.target.value)}
                />
                <button
                  onClick={handleConnect}
                  disabled={connecting || !cookieVal.trim()}
                  className="px-4 py-2 bg-sap-blue text-white rounded-lg text-[13px] font-semibold disabled:opacity-50 whitespace-nowrap"
                >
                  {connecting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              {connectErr && <div className="text-red-500 text-[12px]">{connectErr}</div>}
            </div>
          )}

          {/* Extension auto-renewal */}
          {connStatus?.connected && (
            <div className="bg-sap-bg border border-sap-border rounded-lg p-4 flex flex-col gap-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sap-text flex items-center gap-1.5">
                  <Key size={13} className="text-sap-blue" />
                  Renovação automática (extensão Chrome)
                </span>
                {extSecretData?.secret ? (
                  <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">Ativa</span>
                ) : (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Não configurada</span>
                )}
              </div>
              {!extSecretData?.secret && (
                <div className="text-[12px] text-sap-muted">
                  Gere um secret e configure a extensão Chrome para que o cookie ESS seja renovado automaticamente toda vez que você acessa ess.int.sap.
                </div>
              )}
              <div className="flex gap-2 items-center">
                {extSecretData?.secret && (
                  <>
                    <input
                      type={showSecret ? 'text' : 'password'}
                      readOnly
                      value={extSecretData.secret}
                      className="flex-1 font-mono text-[11px] px-2 py-1.5 border border-sap-border rounded bg-white"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(extSecretData.secret)}
                      className="text-[12px] text-sap-blue hover:underline whitespace-nowrap"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => setShowSecret(s => !s)}
                      className="text-[12px] text-sap-muted hover:text-sap-text whitespace-nowrap"
                    >
                      {showSecret ? 'Ocultar' : 'Ver'}
                    </button>
                  </>
                )}
                <button
                  onClick={handleGenerateSecret}
                  disabled={generatingSecret}
                  className="px-3 py-1.5 bg-sap-blue text-white rounded text-[12px] font-semibold disabled:opacity-50 whitespace-nowrap"
                >
                  {generatingSecret ? '...' : extSecretData?.secret ? 'Regenerar' : 'Gerar secret'}
                </button>
              </div>
              {extSecretData?.secret && (
                <div className="text-[11px] text-sap-muted">
                  Cole este secret na extensão Chrome junto com a URL da API. Extensão: <code className="font-mono bg-white border border-sap-border px-1 rounded">projects/dh-extension/</code>
                </div>
              )}
            </div>
          )}

          {/* SEND TAB */}
          {tab === 'send' && (
            <>
              {/* Sessions preview (shown when campaign has Spark sessions) */}
              {selectedSessions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={13} className="text-amber-500 flex-shrink-0" />
                    <span className="text-[12px] font-semibold text-amber-800">
                      {selectedSessions.length} sessão(ões) Discover Expert Series incluída(s) no email
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSessions.map((s: any) => (
                      <span key={s.id} className="text-[11px] bg-white border border-amber-200 text-amber-700 rounded px-2 py-0.5">
                        {s.title}
                        {s.next_date && <span className="text-amber-400 ml-1">· {String(s.next_date).slice(0, 10)}</span>}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-amber-600 mt-1.5">
                    O email incluirá o nome do contato, texto de convite para o DES e a tabela de sessões acima.
                  </div>
                </div>
              )}

              {/* Template / Subject / From */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Template ID (UUID do ESS) *</label>
                  {selectedSessions.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <input
                        className={`${inputCls} font-mono text-[11px] bg-amber-50 border-amber-300`}
                        value={templateId}
                        onChange={e => setTemplateId(e.target.value)}
                      />
                    </div>
                  ) : (
                    <input
                      className={`${inputCls} font-mono text-[11px]`}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={templateId}
                      onChange={e => setTemplateId(e.target.value)}
                    />
                  )}
                  <div className="text-[11px] text-sap-muted">
                    {selectedSessions.length > 0
                      ? 'Pré-preenchido com o template DES. Edite se necessário.'
                      : 'Visível na URL ao abrir o template no ESS'}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Nome do Template</label>
                  <input
                    className={inputCls}
                    placeholder="Ex: SAP LAC Q3 Invite"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Assunto *</label>
                  <input
                    className={inputCls}
                    placeholder="Assunto do email"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>De (seu email SAP) *</label>
                  <input
                    className={inputCls}
                    placeholder="seu.email@sap.com"
                    value={fromEmail}
                    onChange={e => setFromEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Test email */}
              <div className="border border-sap-border rounded-lg p-3 flex flex-col gap-2">
                <div className={labelCls}>Enviar email de teste</div>
                <div className="flex gap-2 items-start">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="email@sap.com"
                    value={testEmail}
                    onChange={e => { setTestEmail(e.target.value); setTestResult(null) }}
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest || !testEmail.trim() || !templateId.trim() || !subject.trim() || !fromEmail.trim() || !connStatus?.connected}
                    title={
                      !subject.trim() ? 'Preencha o campo Assunto' :
                      !fromEmail.trim() ? 'Preencha o campo De (seu email SAP)' :
                      !connStatus?.connected ? 'ESS não conectado' : ''
                    }
                    className="px-4 py-2 border border-sap-border text-sap-text text-[13px] rounded-lg hover:bg-sap-bg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  >
                    {sendingTest ? 'Enviando...' : 'Enviar teste'}
                  </button>
                </div>
                {(!subject.trim() || !fromEmail.trim()) && testEmail.trim() && (
                  <div className="text-[11px] text-amber-600">
                    Preencha {[!subject.trim() && 'Assunto', !fromEmail.trim() && 'De (seu email SAP)'].filter(Boolean).join(' e ')} antes de enviar o teste.
                  </div>
                )}
                {testResult && (
                  <div className={`text-[12px] flex items-center gap-1.5 ${testResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {testResult.ok
                      ? <><CheckCircle size={12} /> Teste enviado para {testEmail} — assunto prefixado com [TESTE]</>
                      : <>Falhou: {testResult.error}</>}
                  </div>
                )}
              </div>

              {/* Contacts table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={labelCls}>
                    Contatos — {contactsWithEmail.length} prontos,{' '}
                    {contactsWithoutEmail.length > 0 && (
                      <span className="text-amber-600">{contactsWithoutEmail.length} sem email</span>
                    )}
                  </div>
                </div>

                {loadingContacts && (
                  <div className="text-sm text-sap-muted text-center py-6">Carregando...</div>
                )}

                {!loadingContacts && contacts.length === 0 && (
                  <div className="text-sm text-sap-muted text-center py-6">
                    Nenhum contato nesta campanha.
                  </div>
                )}

                {contacts.length > 0 && (
                  <div className="border border-sap-border rounded-lg overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-sap-bg border-b border-sap-border">
                          <th className="text-left px-3 py-2 text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Contato</th>
                          <th className="text-left px-3 py-2 text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Email</th>
                          <th className="text-left px-3 py-2 text-[11px] font-semibold text-sap-muted uppercase tracking-wide">Último envio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map(c => {
                          const isEditing = c.prospect_id in editingEmail
                          return (
                            <tr key={c.id} className="border-b border-sap-border last:border-0 hover:bg-sap-bg/50">
                              <td className="px-3 py-2 font-medium text-sap-text">
                                {c.contact_name || c.prospect_id}
                                {c.account_name && (
                                  <div className="text-[11px] text-sap-muted font-normal">{c.account_name}</div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      autoFocus
                                      className="border border-sap-border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-sap-blue w-48"
                                      value={editingEmail[c.prospect_id]}
                                      onChange={e => setEditingEmail(s => ({ ...s, [c.prospect_id]: e.target.value }))}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveEmail(c.prospect_id)
                                        if (e.key === 'Escape') setEditingEmail(s => { const n = { ...s }; delete n[c.prospect_id]; return n })
                                      }}
                                    />
                                    <button
                                      onClick={() => handleSaveEmail(c.prospect_id)}
                                      disabled={savingEmail[c.prospect_id]}
                                      className="text-sap-blue hover:text-sap-blue-d disabled:opacity-50"
                                    >
                                      <CheckCircle size={14} />
                                    </button>
                                  </div>
                                ) : c.contact_email ? (
                                  <span
                                    className="text-sap-text cursor-pointer hover:underline"
                                    onClick={() => setEditingEmail(s => ({ ...s, [c.prospect_id]: c.contact_email }))}
                                    title="Clique para editar"
                                  >
                                    {c.contact_email}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setEditingEmail(s => ({ ...s, [c.prospect_id]: '' }))}
                                    className="text-amber-600 hover:text-amber-700 italic text-[11px]"
                                  >
                                    + adicionar email
                                  </button>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sap-muted whitespace-nowrap">
                                {c.last_success ? (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle size={11} />
                                    {c.last_success.slice(0, 10)}
                                  </span>
                                ) : (
                                  <span className="text-sap-muted">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Send results */}
              {sendResults && (
                <div className="border border-sap-border rounded-lg overflow-hidden">
                  <div className="bg-sap-bg px-3 py-2 text-[11px] font-semibold text-sap-muted uppercase tracking-wide border-b border-sap-border">
                    Resultado do envio
                  </div>
                  <div className="divide-y divide-sap-border max-h-40 overflow-y-auto">
                    {sendResults.map((r, i) => (
                      <div key={i} className="px-3 py-2 flex items-center gap-3 text-[12px]">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          r.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {r.status === 'sent' ? 'ENVIADO' : 'FALHOU'}
                        </span>
                        <span className="text-sap-text">{r.email}</span>
                        {r.error && <span className="text-sap-muted text-[11px] ml-auto truncate max-w-[240px]">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div>
              {sends.length === 0 && (
                <div className="text-sm text-sap-muted text-center py-8">
                  Nenhum envio registrado para esta campanha.
                </div>
              )}
              {sends.length > 0 && (
                <div className="border border-sap-border rounded-lg overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-sap-bg border-b border-sap-border">
                        {['Data', 'Email', 'Template', 'Enviado por', 'Status'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold text-sap-muted uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sends.map(s => (
                        <tr key={s.id} className="border-b border-sap-border last:border-0 hover:bg-sap-bg">
                          <td className="px-3 py-2 text-sap-muted whitespace-nowrap">
                            {String(s.sent_at || '').slice(0, 16)}
                          </td>
                          <td className="px-3 py-2 text-sap-text">{s.email}</td>
                          <td className="px-3 py-2 text-sap-muted">
                            <span title={s.template_id}>{s.template_name || s.template_id?.slice(0, 8) + '…'}</span>
                          </td>
                          <td className="px-3 py-2 text-sap-muted">{s.sent_by}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              s.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sap-border flex justify-between items-center flex-shrink-0">
          <div className="text-[12px] text-sap-muted">
            {contactsWithEmail.length} contato{contactsWithEmail.length !== 1 ? 's' : ''} com email
            {contactsWithoutEmail.length > 0 && ` · ${contactsWithoutEmail.length} sem email`}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-[13px] border border-sap-border rounded-lg hover:bg-sap-bg">
              Fechar
            </button>
            {tab === 'send' && (
              <button
                onClick={handleSend}
                disabled={
                  sending ||
                  !connStatus?.connected ||
                  !templateId.trim() ||
                  !subject.trim() ||
                  !fromEmail.trim() ||
                  contactsWithEmail.length === 0
                }
                className="px-5 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d disabled:opacity-50 flex items-center gap-2"
              >
                <Mail size={14} />
                {sending ? 'Enviando...' : `Enviar para ${contactsWithEmail.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Spark Invite modal ────────────────────────────────────────────────────────

function SparkInviteModal({ campaign, onClose }) {
  const [lang, setLang] = useState('PT')
  const [copied, setCopied] = useState(false)

  const regLink = lang === 'PT'
    ? 'https://digital-discover-expert-series-esp-5e2d.sites-sap.com/#home'
    : 'https://digital-discover-expert-series-espanol-5e2d.sites-sap.com/#home'

  const { data: sessionIds = [] } = useQuery({
    queryKey: ['campaign-sessions', campaign.id],
    queryFn: () => api.get(`/api/campaigns/${campaign.id}/sessions`).then(r => r.data ?? []),
  })

  const { data: allSessions = [] } = useQuery({
    queryKey: ['spark-all-sessions'],
    queryFn: () => api.get('/api/spark/sessions').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.sessions ?? [])
    }),
    staleTime: 5 * 60_000,
  })

  const selectedSessions = useMemo(
    () => allSessions.filter((s: any) => sessionIds.includes(s.id)),
    [allSessions, sessionIds]
  )

  const generateHtml = () => {
    if (!selectedSessions.length) return ''
    const rows = selectedSessions.map((s: any) => {
      const dates = Array.isArray(s.upcoming_dates) && s.upcoming_dates.length
        ? s.upcoming_dates.slice(0, 2).map((d: any) => String(d).slice(0, 10)).join('<br/>')
        : (s.next_date ? String(s.next_date).slice(0, 10) : 'A definir')
      const desc = s.description
        ? (s.description.length > 120 ? s.description.slice(0, 117) + '...' : s.description)
        : '—'
      return `  <tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;font-weight:600;color:#1a1a1a;">${s.title}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;color:#555;max-width:220px;">${desc}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;color:#555;white-space:nowrap;">${dates}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;color:#555;">${s.advisor_name || '—'}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;"><a href="${regLink}" style="color:#0070B8;font-weight:600;text-decoration:none;">Inscrever-se →</a></td>
  </tr>`
    }).join('\n')

    return `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
  <thead>
    <tr style="background:#0070B8;color:white;">
      <th style="padding:10px 12px;text-align:left;font-weight:600;white-space:nowrap;">Sessão</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;">Descrição</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;white-space:nowrap;">Data</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;white-space:nowrap;">Palestrante</th>
      <th style="padding:10px 12px;text-align:left;font-weight:600;white-space:nowrap;">Inscrição</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`
  }

  const handleCopy = () => {
    const html = generateHtml()
    if (!html) return
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const htmlContent = generateHtml()

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[820px] max-h-[92vh] flex flex-col border border-sap-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border flex-shrink-0">
          <div>
            <h3 className="text-[16px] font-bold text-sap-text flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              Convite Spark Meeting
            </h3>
            <div className="text-[12px] text-sap-muted mt-0.5">{campaign.name}</div>
          </div>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text"><X size={18} /></button>
        </div>

        {/* Lang toggle */}
        <div className="px-6 py-3 border-b border-sap-border flex items-center gap-3 flex-shrink-0 flex-wrap">
          <span className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide whitespace-nowrap">Link de inscrição:</span>
          <div className="flex rounded-lg border border-sap-border overflow-hidden">
            <button
              onClick={() => setLang('PT')}
              className={`px-3 py-1.5 text-[12px] font-semibold transition-colors ${lang === 'PT' ? 'bg-sap-blue text-white' : 'text-sap-muted hover:bg-sap-bg'}`}
            >
              🇧🇷 Português (Brasil)
            </button>
            <button
              onClick={() => setLang('ES')}
              className={`px-3 py-1.5 text-[12px] font-semibold border-l border-sap-border transition-colors ${lang === 'ES' ? 'bg-sap-blue text-white' : 'text-sap-muted hover:bg-sap-bg'}`}
            >
              🇪🇸 Español (MCLA)
            </button>
          </div>
          <a href={regLink} target="_blank" rel="noreferrer"
            className="text-[11px] text-sap-blue hover:underline truncate max-w-[280px]"
          >
            {regLink}
          </a>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {selectedSessions.length === 0 ? (
            <div className="text-center py-12 text-sap-muted text-[13px]">
              {sessionIds.length === 0
                ? 'Nenhuma sessão Spark selecionada para esta campanha. Edite a campanha para adicionar sessões.'
                : 'Carregando sessões...'}
            </div>
          ) : (
            <>
              {/* Preview */}
              <div>
                <div className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-2">
                  Prévia — {selectedSessions.length} sessão(ões)
                </div>
                <div className="border border-sap-border rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-sap-blue text-white">
                        {['Sessão', 'Descrição', 'Data', 'Palestrante', 'Inscrição'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSessions.map((s: any, i) => (
                        <tr key={s.id} className={`border-t border-sap-border ${i % 2 === 1 ? 'bg-sap-bg' : 'bg-white'}`}>
                          <td className="px-3 py-2 font-semibold text-sap-text whitespace-nowrap">{s.title}</td>
                          <td className="px-3 py-2 text-sap-muted max-w-[200px]">
                            <div className="line-clamp-2 text-[11px]">
                              {s.description ? (s.description.length > 80 ? s.description.slice(0, 77) + '...' : s.description) : '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sap-muted whitespace-nowrap text-[11px]">
                            {Array.isArray(s.upcoming_dates) && s.upcoming_dates.length
                              ? s.upcoming_dates.slice(0, 2).map((d: any) => String(d).slice(0, 10)).join(', ')
                              : (s.next_date ? String(s.next_date).slice(0, 10) : '—')}
                          </td>
                          <td className="px-3 py-2 text-sap-muted whitespace-nowrap">{s.advisor_name || '—'}</td>
                          <td className="px-3 py-2">
                            <a href={regLink} target="_blank" rel="noreferrer"
                              className="text-sap-blue hover:underline font-semibold text-[11px] whitespace-nowrap"
                            >
                              Inscrever-se →
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HTML export */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide">HTML para email</span>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-lg border transition-colors ${
                      copied ? 'border-green-300 bg-green-50 text-green-700' : 'border-sap-border text-sap-muted hover:bg-sap-bg'
                    }`}
                  >
                    {copied ? <><CheckCircle size={12} /> Copiado!</> : <><Copy size={12} /> Copiar HTML</>}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={htmlContent}
                  rows={8}
                  className="w-full border border-sap-border rounded-lg px-3 py-2 text-[11px] font-mono text-sap-muted bg-sap-bg resize-none focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-sap-border flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 text-[13px] border border-sap-border rounded-lg hover:bg-sap-bg">
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CampaignsPage() {
  const [editTarget, setEditTarget] = useState(null)  // null=closed, {}=new, campaign=edit
  const [contactsTarget, setContactsTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [essSendTarget, setEssSendTarget] = useState(null)
  const [sparkInviteTarget, setSparkInviteTarget] = useState(null)
  const qc = useQueryClient()

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/api/campaigns').then(r => r.data),
  })

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Excluir "${campaign.name}"? Esta ação não pode ser desfeita.`)) return
    await api.delete(`/api/campaigns/${campaign.id}`)
    qc.invalidateQueries({ queryKey: ['campaigns'] })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-sap-text">Campanhas</h1>
          <p className="text-[13px] text-sap-muted mt-0.5">Gerencie suas campanhas de outreach</p>
        </div>
        <button
          onClick={() => setEditTarget({})}
          className="flex items-center gap-2 px-4 py-2 bg-sap-blue text-white text-[13px] font-semibold rounded-lg hover:bg-sap-blue-d transition-colors"
        >
          <Plus size={15} />
          Nova Campanha
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-sap-border rounded-xl overflow-hidden">
        {isLoading && (
          <div className="py-16 text-center text-sm text-sap-muted">Carregando...</div>
        )}

        {!isLoading && campaigns.length === 0 && (
          <div className="py-16 text-center text-sm text-sap-muted">
            Nenhuma campanha cadastrada. Clique em "Nova Campanha" para começar.
          </div>
        )}

        {campaigns.length > 0 && (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-sap-border bg-sap-bg">
                {['Nome', 'Responsável', 'Objetivo', 'Início', 'Fim', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-sap-muted uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-b border-sap-border last:border-0 hover:bg-sap-bg transition-colors">
                  <td className="px-4 py-3 font-semibold text-sap-text max-w-[180px]">
                    <div className="truncate">{c.name}</div>
                  </td>
                  <td className="px-4 py-3 text-sap-muted whitespace-nowrap">{c.owner || '—'}</td>
                  <td className="px-4 py-3 text-sap-muted max-w-[220px]">
                    <div className="truncate" title={c.objective}>{c.objective || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-sap-muted whitespace-nowrap">{fmtDate(c.start_date)}</td>
                  <td className="px-4 py-3 text-sap-muted whitespace-nowrap">{fmtDate(c.end_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status] || STATUS_STYLE.closed}`}>
                      {STATUS_OPTS.find(o => o.value === c.status)?.label ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setSparkInviteTarget(c)}
                        title="Gerar convite Spark Meeting"
                        className="p-1.5 rounded hover:bg-sap-bg text-sap-muted hover:text-amber-500 transition-colors"
                      >
                        <Zap size={15} />
                      </button>
                      <button
                        onClick={() => setContactsTarget(c)}
                        title="Ver contatos"
                        className="p-1.5 rounded hover:bg-sap-bg text-sap-muted hover:text-sap-blue transition-colors"
                      >
                        <Users size={15} />
                      </button>
                      <button
                        onClick={() => setEssSendTarget(c)}
                        title="Enviar email via ESS"
                        className="p-1.5 rounded hover:bg-sap-bg text-sap-muted hover:text-sap-blue transition-colors"
                      >
                        <Mail size={15} />
                      </button>
                      <button
                        onClick={() => setEditTarget(c)}
                        title="Editar"
                        className="p-1.5 rounded hover:bg-sap-bg text-sap-muted hover:text-sap-blue transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        title="Excluir"
                        className="p-1.5 rounded hover:bg-sap-bg text-sap-muted hover:text-sap-error transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {editTarget !== null && (
        <CampaignModal
          campaign={editTarget?.id ? editTarget : null}
          onClose={() => setEditTarget(null)}
        />
      )}
      {contactsTarget && (
        <ContactsModal
          campaign={contactsTarget}
          onClose={() => setContactsTarget(null)}
        />
      )}
      {essSendTarget && (
        <EssSendModal
          campaign={essSendTarget}
          onClose={() => setEssSendTarget(null)}
        />
      )}
      {sparkInviteTarget && (
        <SparkInviteModal
          campaign={sparkInviteTarget}
          onClose={() => setSparkInviteTarget(null)}
        />
      )}
    </div>
  )
}
