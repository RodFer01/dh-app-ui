// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { X, ExternalLink, Phone, Star, ChevronDown } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const DQ_COLOR = { Valid:'bg-green-100 text-green-700', Aging:'bg-yellow-100 text-yellow-700', Invalid:'bg-red-100 text-red-700' }
const ROLE_COLOR = { Champion:'bg-orange-100 text-orange-700', Ratifier:'bg-blue-100 text-blue-700', Influencer:'bg-gray-100 text-gray-600', User:'bg-gray-50 text-gray-500' }
const ACCEPTED_LABELS = { 0:'—', 1:'✓ Sim', 2:'✗ Não' }
const ACCEPTED_COLORS = { 0:'bg-gray-100 text-gray-500', 1:'bg-green-100 text-green-700', 2:'bg-red-100 text-red-700' }

// Determine which LoB roles/scores are relevant based on suggestion label
const LOB_MAP: Record<string,string> = {
  'erp':'ERP','hcm':'HCM','cx':'CX','scm':'SCM','btp':'BTP','f_s':'F&S',
}
function roleBadges(contact) {
  const badges: React.ReactNode[] = []
  for (const [key, label] of Object.entries(LOB_MAP)) {
    const role = contact[`role_${key}`]
    if (role && role !== '-' && role !== '(Nenhum valor)') {
      const roles = role.split(';').map(r => r.trim()).filter(Boolean)
      roles.forEach(r => {
        const cls = ROLE_COLOR[r] || 'bg-gray-100 text-gray-500'
        badges.push(
          <span key={`${key}-${r}`} className={`text-[9px] rounded px-1 py-0.5 ${cls}`}>
            {label}: {r}
          </span>
        )
      })
    }
  }
  return badges
}

function scoreBadges(contact) {
  return Object.entries(LOB_MAP).flatMap(([key, label]) => {
    const score = contact[`score_${key}`]
    if (!score || score === '-') return []
    const letter = score[0]
    const color = letter === 'A' ? 'text-green-700' : letter === 'B' ? 'text-blue-700' : 'text-gray-500'
    return [<span key={key} className={`text-[9px] font-600 ${color}`}>{label}:{score}</span>]
  })
}

// ── ContactRow ────────────────────────────────────────────────────────────────
function ContactRow({ c, selected, onSelect }) {
  const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'
  const dqCls    = DQ_COLOR[c.contact_dq_status] || 'bg-gray-100 text-gray-500'
  const isExec   = c.key_executive_contact && c.key_executive_contact.trim() !== ''
  const badges   = roleBadges(c)
  const scores   = scoreBadges(c)

  return (
    <tr
      onClick={() => onSelect(c)}
      className={`border-b border-gray-100 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
    >
      <td className="px-2 py-2 max-w-[160px]">
        <div className="flex items-center gap-1">
          {isExec && <Star size={9} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
          <div>
            <div className="font-500 text-gray-900 truncate" style={{fontSize:'11px'}} title={fullName}>{fullName}</div>
            <div className="text-gray-400 truncate" style={{fontSize:'9px'}} title={c.title}>{c.title || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 max-w-[120px]">
        <div className="text-gray-600 truncate" style={{fontSize:'10px'}}>{c.function || '—'}</div>
        <div className="text-gray-400 truncate" style={{fontSize:'9px'}}>{c.department_lob || ''}</div>
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`text-[9px] rounded px-1 py-0.5 font-600 ${dqCls}`}>{c.contact_dq_status || '—'}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <div className="font-700 text-blue-700" style={{fontSize:'11px'}}>{c.engaged_score ?? '—'}</div>
      </td>
      <td className="px-2 py-2 max-w-[160px]">
        <div className="flex flex-wrap gap-0.5">{badges}</div>
        {scores.length > 0 && <div className="flex flex-wrap gap-1 mt-0.5">{scores}</div>}
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1 flex-wrap">
          {c.work_phone && (
            <a href={`tel:${c.work_phone}`} onClick={e=>e.stopPropagation()}
               className="flex items-center gap-0.5 text-gray-400 hover:text-blue-600" title={`Tel: ${c.work_phone}`} style={{fontSize:'9px'}}>
              <Phone size={10} />{c.work_phone}
            </a>
          )}
          {c.mobile_phone && c.mobile_phone !== c.work_phone && (
            <a href={`tel:${c.mobile_phone}`} onClick={e=>e.stopPropagation()}
               className="flex items-center gap-0.5 text-gray-400 hover:text-blue-600" title={`Mobile: ${c.mobile_phone}`} style={{fontSize:'9px'}}>
              📱{c.mobile_phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()}
               className="text-gray-400 hover:text-blue-600 truncate max-w-[140px]" title={c.email} style={{fontSize:'9px'}}>
              ✉ {c.email}
            </a>
          )}
          {c.sales_cloud_prospect_link && (
            <a href={c.sales_cloud_prospect_link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
               className="text-gray-400 hover:text-blue-600" title="Abrir no SAP Sales Cloud">
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── SuggestionRow ─────────────────────────────────────────────────────────────
function SuggestionRow({ sug, contacts, assignment, onSave }) {
  const [accepted,    setAccepted]    = useState(assignment?.accepted ?? 0)
  const [prospectId,  setProspectId]  = useState(assignment?.prospect_id ?? '')
  const [contactName, setContactName] = useState(assignment?.contact_name ?? '')
  const [notes,       setNotes]       = useState(assignment?.notes ?? '')
  const [dirty,       setDirty]       = useState(false)

  useEffect(() => {
    setAccepted(assignment?.accepted ?? 0)
    setProspectId(assignment?.prospect_id ?? '')
    setContactName(assignment?.contact_name ?? '')
    setNotes(assignment?.notes ?? '')
    setDirty(false)
  }, [assignment])

  const prio = sug.priority || 2
  const prioCls = prio === 1 ? 'bg-orange-600 text-white' : prio === 2 ? 'bg-amber-400 text-white' : 'bg-gray-300 text-gray-700'

  const handleContactChange = (pid) => {
    setProspectId(pid)
    const c = contacts.find(c => c.prospect_id === pid)
    setContactName(c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '')
    setDirty(true)
  }

  const handleSave = () => {
    onSave({ suggestion: sug.label, accepted, prospect_id: prospectId || null, contact_name: contactName || null, notes: notes || null })
    setDirty(false)
  }

  return (
    <div className="border border-gray-100 rounded-lg p-2.5 mb-2 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[8px] font-700 rounded px-1 py-0.5 ${prioCls}`}>P{prio}</span>
        <span className="font-600 text-gray-900 flex-1" style={{fontSize:'12px'}}>{sug.label}</span>
        {/* Accepted toggle */}
        <div className="flex gap-1">
          {[1,2,0].map(v => (
            <button key={v} onClick={() => { setAccepted(v); setDirty(true) }}
              className={`text-[9px] px-1.5 py-0.5 rounded font-600 transition-colors ${accepted===v ? ACCEPTED_COLORS[v] : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
              {ACCEPTED_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Contact selector */}
      <div className="flex gap-2 mb-1.5">
        <select
          value={prospectId}
          onChange={e => handleContactChange(e.target.value)}
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-gray-700 outline-none focus:border-blue-400"
          style={{fontSize:'10px'}}
        >
          <option value="">— Selecionar contato —</option>
          {contacts.map(c => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
            const role = c.role_erp || c.role_hcm || c.role_cx || ''
            return (
              <option key={c.prospect_id} value={c.prospect_id}>
                {name}{c.title ? ` · ${c.title}` : ''}{role ? ` [${role}]` : ''}
              </option>
            )
          })}
        </select>
      </div>

      {/* Notes */}
      <input
        value={notes}
        onChange={e => { setNotes(e.target.value); setDirty(true) }}
        placeholder="Notas (opcional)"
        className="w-full border border-gray-200 rounded px-2 py-1 text-gray-700 outline-none focus:border-blue-400 mb-1.5"
        style={{fontSize:'10px'}}
      />

      {dirty && (
        <button onClick={handleSave}
          className="text-[10px] bg-blue-600 text-white rounded px-3 py-1 font-600 hover:bg-blue-700 transition-colors">
          Salvar
        </button>
      )}
    </div>
  )
}

// ── Competitor lists by L2 category ──────────────────────────────────────────
const DEFAULT_COMPETITORS = ["Oracle","Microsoft","Salesforce","Workday","TOTVS","SAP (legacy/on-prem)","ServiceNow","AWS","Google Cloud","Infor","IFS","SAP Competitor"]
const COMPETITORS_MAP: Record<string, string[]> = {
  "Supply Chain":   [...DEFAULT_COMPETITORS, "Manhattan Associates","Blue Yonder","Kinaxis","Infor WMS"],
  "Plan":           [...DEFAULT_COMPETITORS, "Blue Yonder","Kinaxis","o9 Solutions","Anaplan"],
  "Make & Deliver": [...DEFAULT_COMPETITORS, "Manhattan Associates","Blue Yonder"],
  "HCM":            [...DEFAULT_COMPETITORS, "ADP","Gupy","Senior","Totvs RH","Cornerstone"],
  "Core HR":        [...DEFAULT_COMPETITORS, "ADP","Gupy","Senior","Totvs RH"],
  "Learning":       [...DEFAULT_COMPETITORS, "Cornerstone","LMS365","Docebo"],
  "Commerce":       [...DEFAULT_COMPETITORS, "Shopify","Adobe Commerce","VTEX","Linx"],
  "Marketing":      [...DEFAULT_COMPETITORS, "HubSpot","Adobe","Marketo","RD Station"],
  "Sales":          [...DEFAULT_COMPETITORS, "Salesforce","HubSpot","Pipedrive"],
  "Finance":        [...DEFAULT_COMPETITORS, "Oracle","Blackline","Coupa","Kyriba","Sankhya"],
  "Procurement":    [...DEFAULT_COMPETITORS, "Coupa","Oracle","Jaggaer","Ivalua"],
  "Analytics":      [...DEFAULT_COMPETITORS, "Power BI","Tableau","Qlik","Looker"],
  "AI":             [...DEFAULT_COMPETITORS, "OpenAI","Google Vertex","AWS SageMaker","Databricks"],
  "Integration":    [...DEFAULT_COMPETITORS, "MuleSoft","Boomi","Azure Integration","Workato"],
}

function getCompetitors(l2: string): string[] {
  const key = Object.keys(COMPETITORS_MAP).find(k => l2.toLowerCase().includes(k.toLowerCase()))
  return key ? COMPETITORS_MAP[key] : DEFAULT_COMPETITORS
}

// ── CompetitorSection ─────────────────────────────────────────────────────────
function CompetitorSection({ l2, oppId, existing, onSave }) {
  const saved      = existing || {}
  const [selected, setSelected] = useState<string[]>(() => {
    try { return JSON.parse(saved.competitors || '[]') } catch { return [] }
  })
  const [notes,    setNotes]    = useState(saved.notes || '')
  const [open,     setOpen]     = useState(true)
  const [dirty,    setDirty]    = useState(false)
  const options = getCompetitors(l2)

  useEffect(() => {
    try { setSelected(JSON.parse(saved.competitors || '[]')) } catch { setSelected([]) }
    setNotes(saved.notes || '')
    setDirty(false)
  }, [saved.competitors, saved.notes])

  const toggle = (c: string) => {
    setSelected(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
    setDirty(true)
  }

  return (
    <div className="border border-gray-100 rounded-lg mb-3 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-600 text-gray-800" style={{fontSize:'12px'}}>{l2}</span>
          {selected.length > 0 && (
            <span className="text-[9px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-600">
              {selected.length} identificado{selected.length>1?'s':''}
            </span>
          )}
        </div>
        <span className="text-gray-400" style={{fontSize:'10px'}}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {options.map(c => (
              <button key={c} onClick={() => toggle(c)}
                className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                  selected.includes(c)
                    ? 'bg-red-100 text-red-800 border-red-300 font-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {selected.includes(c) ? '⚔ ' : ''}{c}
              </button>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setDirty(true) }}
            placeholder="Observações sobre os concorrentes..."
            rows={2}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-gray-700 outline-none focus:border-blue-400 resize-none mb-1.5"
            style={{fontSize:'10px'}}
          />
          {dirty && (
            <button onClick={() => { onSave({ solution_l2: l2, competitors: selected, notes }); setDirty(false) }}
              className="text-[10px] bg-blue-600 text-white rounded px-3 py-1 font-600 hover:bg-blue-700">
              Salvar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── SuggestionRowInline ───────────────────────────────────────────────────────
function SuggestionRowInline({ s, contacts, assignment, onSave, saving }) {
  const [prospectId,  setProspectId]  = useState(assignment?.prospect_id ? String(assignment.prospect_id) : '')
  const [contactName, setContactName] = useState(assignment?.contact_name || '')
  const [accepted,    setAccepted]    = useState(assignment?.accepted ?? 0)
  const [dirty,       setDirty]       = useState(false)

  useEffect(() => {
    setProspectId(assignment?.prospect_id ? String(assignment.prospect_id) : '')
    setContactName(assignment?.contact_name || '')
    setAccepted(assignment?.accepted ?? 0)
    setDirty(false)
  }, [assignment?.prospect_id, assignment?.contact_name, assignment?.accepted])

  const selectedContact = contacts.find(c => String(c.prospect_id) === prospectId)

  const handleContactChange = (pid) => {
    setProspectId(pid)
    const c = contacts.find(ct => String(ct.prospect_id) === pid)
    setContactName(c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '')
    setDirty(true)
  }

  const prioCls = s.priority === 1 ? 'bg-orange-500 text-white' : s.priority === 2 ? 'bg-amber-400 text-white' : 'bg-gray-300 text-gray-700'

  return (
    <tr className="border-b border-gray-100">
      <td className="px-2 py-2">
        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${prioCls}`}>P{s.priority}</span>
      </td>
      <td className="px-2 py-2 font-semibold text-gray-900 text-[11px]">{s.label}</td>
      <td className="px-2 py-2 min-w-[180px]">
        <select
          value={prospectId}
          onChange={e => handleContactChange(e.target.value)}
          className="w-full border border-gray-200 rounded px-1.5 py-1 text-[10px] bg-white focus:border-blue-400 outline-none"
        >
          <option value="">— Select contact —</option>
          {contacts.map(c => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
            return <option key={c.prospect_id} value={String(c.prospect_id)}>{name}{c.title ? ` · ${c.title}` : ''}</option>
          })}
        </select>
      </td>
      <td className="px-2 py-2 text-[10px] text-gray-500 max-w-[140px]">
        {selectedContact?.email ? (
          <a href={`mailto:${selectedContact.email}`} className="text-blue-600 hover:underline truncate block" title={selectedContact.email}>
            {selectedContact.email}
          </a>
        ) : (contactName && !prospectId ? <span className="text-gray-400">{contactName}</span> : '—')}
      </td>
      <td className="px-2 py-2">
        <select value={accepted}
          onChange={e => { setAccepted(Number(e.target.value)); setDirty(true) }}
          className="border border-gray-200 rounded px-1.5 py-1 text-[10px] bg-white focus:border-blue-400 outline-none">
          <option value={0}>-</option>
          <option value={1}>✓ Yes</option>
          <option value={2}>✗ No</option>
        </select>
      </td>
      <td className="px-2 py-2">
        {dirty ? (
          <button
            onClick={() => { onSave({ suggestion: s.label, accepted, prospect_id: prospectId || null, contact_name: contactName || null }); setDirty(false) }}
            disabled={saving}
            className="text-[10px] bg-blue-600 text-white rounded px-2.5 py-1 font-semibold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? '...' : 'Save'}
          </button>
        ) : (
          <span className="text-[10px] text-gray-300">{assignment?.prospect_id || assignment?.contact_name ? '✓ saved' : ''}</span>
        )}
      </td>
    </tr>
  )
}


export function ContactsDrawer({ opp, onClose }) {
  const qc = useQueryClient()
  const [selectedContact, setSelectedContact] = useState(null)
  const [activeTab, setActiveTab]             = useState<'contacts'|'suggestions'|'competitors'>('contacts')

  const accountBp = opp?.account_bp

  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['outreach-contacts', accountBp],
    queryFn: () => api.get(`/api/outreach/contacts/${accountBp}`).then(r => r.data),
    enabled: !!accountBp,
  })

  const { data: compData, refetch: refetchComp } = useQuery({
    queryKey: ['opp-competitors', opp?.opportunity_id],
    queryFn: () => api.get(`/api/outreach/competitors/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp?.opportunity_id,
  })

  const saveCompetitor = async (body: any) => {
    await api.post('/api/outreach/competitors', { ...body, opportunity_id: opp.opportunity_id })
    refetchComp()
  }

  const { data: assignData } = useQuery({
    queryKey: ['opp-assignments', opp?.opportunity_id],
    queryFn: () => api.get(`/api/outreach/assignments/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp?.opportunity_id,
  })

  const saveMutation = useMutation({
    mutationFn: (body) => api.post('/api/outreach/assignments', { ...body, opportunity_id: opp.opportunity_id }),
    onSuccess:  () => qc.invalidateQueries(['opp-assignments', opp?.opportunity_id]),
  })

  const contacts    = contactsData?.contacts    || []
  const assignments = assignData?.assignments   || []
  const suggestions = opp?.suggestions          || []

  const assignMap = Object.fromEntries(assignments.map(a => [a.suggestion, a]))

  if (!opp) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[560px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex-1 min-w-0">
            <div className="font-700 text-gray-900 truncate" style={{fontSize:'14px'}}>{opp.account_name}</div>
            <div className="text-gray-500 truncate" style={{fontSize:'11px'}}>{opp.opp_description} · {opp.closing_qtr}</div>
            <div className="flex gap-2 mt-1">
              {opp.sap_mastercode && (
                <span className="text-[9px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{opp.sap_mastercode}</span>
              )}
              {accountBp && (
                <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">BP: {accountBp}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 flex-shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-2 font-500 transition-colors ${activeTab==='contacts' ? 'border-b-2 border-blue-600 text-blue-700 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
            style={{fontSize:'11px'}}>
            👤 Contatos {contacts.length > 0 && `(${contacts.length})`}
          </button>
          <button onClick={() => setActiveTab('suggestions')}
            className={`flex-1 py-2 font-500 transition-colors ${activeTab==='suggestions' ? 'border-b-2 border-blue-600 text-blue-700 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
            style={{fontSize:'11px'}}>
            💡 Sugestões {suggestions.length > 0 && `(${suggestions.length})`}
          </button>
          <button onClick={() => setActiveTab('competitors')}
            className={`flex-1 py-2 font-500 transition-colors ${activeTab==='competitors' ? 'border-b-2 border-red-600 text-red-700 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
            style={{fontSize:'11px'}}>
            ⚔️ Concorrentes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'contacts' && (
            <div>
              {!accountBp ? (
                <div className="p-8 text-center text-gray-400" style={{fontSize:'13px'}}>
                  Sem Account BP nesta oportunidade — não é possível buscar contatos do Outreach.
                </div>
              ) : loadingContacts ? (
                <div className="p-8 text-center text-gray-400" style={{fontSize:'13px'}}>Carregando contatos...</div>
              ) : contacts.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 mb-2" style={{fontSize:'13px'}}>Nenhum contato encontrado para BP {accountBp}</div>
                  <div className="text-gray-300" style={{fontSize:'11px'}}>O ETL do Outreach pode ainda não ter sincronizado esta conta.</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        {['Nome / Cargo','Função','DQ','Score','Papéis por LoB',''].map(h => (
                          <th key={h} className="text-left px-2 py-2 font-700 text-gray-400 uppercase tracking-wide" style={{fontSize:'9px'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map(c => (
                        <ContactRow
                          key={c.prospect_id}
                          c={c}
                          selected={selectedContact?.prospect_id === c.prospect_id}
                          onSelect={setSelectedContact}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Selected contact details */}
              {selectedContact && (
                <div className="border-t border-gray-200 bg-blue-50 p-4">
                  <div className="font-700 text-blue-900 mb-2" style={{fontSize:'12px'}}>
                    Detalhes — {[selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' ')}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {selectedContact.last_5_actions && (
                      <div className="col-span-2">
                        <span className="text-gray-500 font-600" style={{fontSize:'9px'}}>Últimas ações: </span>
                        <span className="text-gray-700" style={{fontSize:'10px'}}>{selectedContact.last_5_actions}</span>
                      </div>
                    )}
                    {selectedContact.touched_at && (
                      <div>
                        <span className="text-gray-500 font-600" style={{fontSize:'9px'}}>Último contato: </span>
                        <span className="text-gray-700" style={{fontSize:'10px'}}>
                          {new Date(selectedContact.touched_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {selectedContact.open_count > 0 && (
                      <div>
                        <span className="text-gray-500 font-600" style={{fontSize:'9px'}}>Opens/Replies: </span>
                        <span className="text-gray-700" style={{fontSize:'10px'}}>{selectedContact.open_count}/{selectedContact.reply_count ?? 0}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div className="p-4">
              {suggestions.length === 0 ? (
                <div className="text-center text-gray-400 py-8" style={{fontSize:'13px'}}>
                  Sem sugestões SAP para esta oportunidade.
                </div>
              ) : (
                <>
                  <div className="text-gray-500 mb-3" style={{fontSize:'11px'}}>
                    Marque quais soluções serão abordadas e atribua um contato responsável por cada uma.
                  </div>
                  {suggestions.map(sug => (
                    <SuggestionRow
                      key={sug.label}
                      sug={sug}
                      contacts={contacts}
                      assignment={assignMap[sug.label]}
                      onSave={(body) => saveMutation.mutate(body)}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Competitors tab */}
          {activeTab === 'competitors' && (
            <div className="p-4">
              {(() => {
                const solutions = opp?.solutions_l2?.length ? opp.solutions_l2 : (opp?.solutions_l1 || [])
                const compList  = compData?.competitors || []
                const compMap   = Object.fromEntries(compList.map((c:any) => [c.solution_l2, c]))
                if (!solutions.length) return (
                  <div className="text-center text-gray-400 py-8" style={{fontSize:'13px'}}>
                    Sem soluções identificadas nesta oportunidade.
                  </div>
                )
                return (
                  <>
                    <div className="text-gray-500 mb-3" style={{fontSize:'11px'}}>
                      Marque quais produtos concorrentes o cliente já usa ou está avaliando para cada área de solução.
                    </div>
                    {solutions.map((l2:string) => (
                      <CompetitorSection key={l2} l2={l2} oppId={opp.opportunity_id}
                        existing={compMap[l2]} onSave={saveCompetitor} />
                    ))}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <div className="text-gray-400" style={{fontSize:'10px'}}>
            Outreach cache · {contacts.length} contatos encontrados
          </div>
          <button onClick={onClose} className="text-[11px] border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-100">
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}


// ── AccountSolutionMapTab ──────────────────────────────────────────────────────
function SolutionMapRow({ entry, accountBp, accountName, onSaved }) {
  const [selected, setSelected] = useState<string[]>(() => {
    const base = entry.saved_competitors?.length ? entry.saved_competitors : entry.suggested_competitors || []
    return base
  })
  const [notes, setNotes] = useState(entry.notes || '')
  const [dirty,  setDirty]  = useState(!entry.saved_competitors?.length && entry.suggested_competitors?.length > 0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const base = entry.saved_competitors?.length ? entry.saved_competitors : entry.suggested_competitors || []
    setSelected(base)
    setNotes(entry.notes || '')
    setDirty(!entry.saved_competitors?.length && entry.suggested_competitors?.length > 0)
  }, [entry.solution])

  const allOptions = Array.from(new Set([
    ...entry.tier1, ...entry.tier2, ...entry.lac,
    ...entry.saved_competitors,
  ]))

  const toggle = (c: string) => {
    setSelected(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/api/outreach/account-solution-map', {
        account_bp: accountBp, account_name: accountName,
        solution: entry.solution, competitors: selected, notes,
      })
      setDirty(false)
      onSaved()
    } finally { setSaving(false) }
  }

  const isInPipeline = entry.in_pipeline
  const isSaved      = entry.saved_competitors?.length > 0

  return (
    <div className={`border rounded-lg mb-2 overflow-hidden ${isInPipeline ? 'border-blue-200' : 'border-orange-200'}`}>
      {/* Solution header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${isInPipeline ? 'bg-blue-50' : 'bg-orange-50'}`}>
        <span className="text-[11px]">{isInPipeline ? '✅' : '⚠️'}</span>
        <span className="font-semibold text-[12px] text-gray-800 flex-1">{entry.solution}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${isInPipeline ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
          {isInPipeline ? 'In Pipeline' : 'Gap'}
        </span>
        {isSaved && !dirty && <span className="text-[9px] text-green-600 font-semibold">✓ saved</span>}
        {dirty && (
          <button onClick={save} disabled={saving}
            className="text-[10px] bg-blue-600 text-white rounded px-2.5 py-1 font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? '...' : 'Save'}
          </button>
        )}
      </div>

      {/* Competitor chips */}
      <div className="p-3">
        {/* Tier legend */}
        <div className="flex gap-3 mb-2 text-[9px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-300 inline-block" />Tier 1 Global</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-300 inline-block" />Tier 2</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-300 inline-block" />LAC / Local</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allOptions.map(c => {
            const isSel   = selected.includes(c)
            const isTier1 = entry.tier1.includes(c)
            const isLac   = entry.lac.includes(c)
            const baseCls = isTier1 ? 'border-orange-300' : isLac ? 'border-pink-300' : 'border-gray-200'
            const selCls  = isSel
              ? (isTier1 ? 'bg-orange-100 text-orange-800 border-orange-400 font-semibold'
                : isLac  ? 'bg-pink-100 text-pink-800 border-pink-400 font-semibold'
                : 'bg-blue-100 text-blue-800 border-blue-400 font-semibold')
              : `bg-white text-gray-500 ${baseCls} hover:border-gray-400`
            return (
              <button key={c} onClick={() => toggle(c)}
                className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${selCls}`}>
                {isSel ? '⚔ ' : ''}{c}
              </button>
            )
          })}
        </div>
        <input value={notes} onChange={e => { setNotes(e.target.value); setDirty(true) }}
          placeholder="Notes (optional)"
          className="mt-2 w-full border border-gray-200 rounded px-2 py-1 text-[10px] outline-none focus:border-blue-400" />
      </div>
    </div>
  )
}

function AccountSolutionMapTab({ accountBp, accountName }) {
  const [showAllGaps, setShowAllGaps] = useState(false)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['account-solution-map', accountBp],
    queryFn: () => api.get(`/api/outreach/account-solution-map/${accountBp}`).then(r => r.data),
    enabled: !!accountBp,
    staleTime: 30_000,
  })

  if (!accountBp) return (
    <div className="p-8 text-center text-gray-400 text-xs">
      No Account BP — cannot load solution map.
    </div>
  )
  if (isLoading) return (
    <div className="p-8 text-center text-gray-400 text-xs">Loading account solution map…</div>
  )

  const solutions: any[] = data?.solutions || []
  const inPipeline  = solutions.filter(s => s.in_pipeline)
  // gaps with saved data shown by default; pristine gaps collapsed
  const gapsSaved   = solutions.filter(s => !s.in_pipeline && s.saved_competitors?.length > 0)
  const gapsPristine = solutions.filter(s => !s.in_pipeline && !s.saved_competitors?.length)
  const savedCount  = inPipeline.filter(s => s.saved_competitors?.length > 0).length + gapsSaved.length

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-gray-900 text-[13px]">{data?.account_name || accountName}</div>
          <div className="text-[10px] text-gray-400">BP: {accountBp} · {data?.industry || ''}</div>
        </div>
        <div className="flex gap-3 text-[10px]">
          <span className="text-blue-700 font-semibold">✅ {inPipeline.length} in pipeline</span>
          <span className="text-green-600 font-semibold">💾 {savedCount} mapped</span>
          <span className="text-orange-600 font-semibold">⚠️ {gapsPristine.length} not mapped</span>
        </div>
      </div>

      {solutions.length === 0 ? (
        <div className="text-gray-400 text-center py-6 text-xs">
          No solutions found.
        </div>
      ) : (
        <>
          {/* In pipeline */}
          {inPipeline.length > 0 && (
            <div className="mb-1 text-[10px] font-semibold text-blue-700 uppercase tracking-wide">
              In Pipeline ({inPipeline.length})
            </div>
          )}
          {inPipeline.map(entry => (
            <SolutionMapRow key={entry.solution} entry={entry}
              accountBp={accountBp} accountName={accountName}
              onSaved={() => refetch()} />
          ))}

          {/* Gaps already mapped */}
          {gapsSaved.length > 0 && (
            <div className="mt-3 mb-1 text-[10px] font-semibold text-purple-700 uppercase tracking-wide">
              Not in Pipeline — Mapped ({gapsSaved.length})
            </div>
          )}
          {gapsSaved.map(entry => (
            <SolutionMapRow key={entry.solution} entry={entry}
              accountBp={accountBp} accountName={accountName}
              onSaved={() => refetch()} />
          ))}

          {/* Pristine gaps — collapsed by default */}
          {gapsPristine.length > 0 && (
            <>
              <button
                onClick={() => setShowAllGaps(v => !v)}
                className="mt-3 w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 transition-colors"
              >
                <span>⚠️ Other SAP Solutions — not yet mapped ({gapsPristine.length})</span>
                <span>{showAllGaps ? '▲ hide' : '▼ show all'}</span>
              </button>
              {showAllGaps && gapsPristine.map(entry => (
                <SolutionMapRow key={entry.solution} entry={entry}
                  accountBp={accountBp} accountName={accountName}
                  onSaved={() => refetch()} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Inline variant — renders below a table row (no backdrop/fixed overlay) ────
export function ContactsDrawerInline({ opp, onClose }) {
  const qc = useQueryClient()
  const [selectedContact, setSelectedContact] = useState(null)
  const [activeTab, setActiveTab]             = useState<'contacts'|'suggestions'|'competitors'|'account-map'|'installed-base'>('contacts')

  const accountBp = opp?.account_bp

  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['outreach-contacts', accountBp],
    queryFn: () => api.get(`/api/outreach/contacts/${accountBp}`).then(r => r.data),
    enabled: !!accountBp,
  })
  const { data: compData, refetch: refetchComp } = useQuery({
    queryKey: ['opp-competitors', opp?.opportunity_id],
    queryFn: () => api.get(`/api/outreach/competitors/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp?.opportunity_id,
  })
  const { data: installedBaseData } = useQuery({
    queryKey: ['installed-base', accountBp],
    queryFn: () => api.get(`/api/ae-analysis/installed-base/${accountBp}`).then(r => r.data),
    enabled: !!accountBp && activeTab === 'installed-base',
    staleTime: 5 * 60 * 1000,
  })
  const saveCompetitor = async (body: any) => {
    await api.post('/api/outreach/competitors', { ...body, opportunity_id: opp.opportunity_id })
    refetchComp()
  }
  const { data: assignData } = useQuery({
    queryKey: ['opp-assignments', opp?.opportunity_id],
    queryFn: () => api.get(`/api/outreach/assignments/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp?.opportunity_id,
  })
  const saveMutation = useMutation({
    mutationFn: (body) => api.post('/api/outreach/assignments', { ...body, opportunity_id: opp.opportunity_id }),
    onSuccess:  () => qc.invalidateQueries(['opp-assignments', opp?.opportunity_id]),
  })

  const contacts    = contactsData?.contacts    || []
  const assignments = assignData?.assignments   || []
  const suggestions = opp?.suggestions          || []
  const assignMap   = Object.fromEntries(assignments.map(a => [a.suggestion, a]))
  // Fix: API returns array, not object
  const compList    = compData?.competitors || []
  const competitors = Object.fromEntries((compList as any[]).map((c: any) => [c.solution_l2, c]))

  // Deduplicate contacts by prospect_id, then by name+title
  const dedupedContacts = contacts.filter((c, i, arr) => {
    if (c.prospect_id) return arr.findIndex(x => x.prospect_id === c.prospect_id) === i
    const key = `${c.first_name}|${c.last_name}|${c.title}`
    return arr.findIndex(x => `${x.first_name}|${x.last_name}|${x.title}` === key) === i
  })

  if (!opp) return null

  const TABS = [
    { key: 'contacts',       label: `Contacts (${dedupedContacts.length})` },
    { key: 'suggestions',    label: `Suggestions (${suggestions.length})` },
    { key: 'competitors',    label: 'Competitors' },
    { key: 'account-map',    label: '🗺 Account Map' },
    { key: 'installed-base', label: '📦 Installed Base' },
  ] as const

  return (
    <div className="relative">
      {/* Overlay tint to separate from table rows below */}
      <div className="absolute inset-0 bg-gray-900/10 pointer-events-none" style={{zIndex:0}} />

      <div className="relative z-10 mx-2 my-1 rounded-xl shadow-2xl border border-blue-300 overflow-hidden" style={{background:'#fff'}}>
        {/* Header — solid blue band */}
        <div className="bg-blue-700 px-5 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-[13px] truncate">{opp.account_name}</div>
            <div className="text-blue-200 text-[11px] truncate">{opp.opp_description} · {opp.closing_qtr}</div>
          </div>
          {/* Tabs in header */}
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  activeTab === t.key
                    ? 'bg-white text-blue-700'
                    : 'text-blue-200 hover:bg-blue-600'
                }`}>{t.label}</button>
            ))}
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white ml-2 text-lg leading-none">✕</button>
        </div>

        {/* Content */}
        <div className="max-h-[380px] overflow-y-auto bg-white">

          {/* Contacts tab */}
          {activeTab === 'contacts' && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-100 sticky top-0">
                  {['Name / Title','Function','DQ','Score','LoB Roles','Email'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-blue-700 uppercase text-[10px] tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingContacts ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-gray-400 text-center text-xs">Loading contacts...</td></tr>
                ) : dedupedContacts.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-gray-400 text-center text-xs">No contacts found for this account.</td></tr>
                ) : dedupedContacts.map((ct, ci) => {
                  const fullName = [ct.first_name, ct.last_name].filter(Boolean).join(' ') || '—'
                  const isExec   = ct.key_executive_contact && ct.key_executive_contact.trim() !== ''
                  const dqCls    = DQ_COLOR[ct.contact_dq_status] || 'bg-gray-100 text-gray-500'
                  return (
                    <tr key={ci} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${isExec ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          {isExec && <Star size={10} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
                          {fullName}
                        </div>
                        <div className="text-gray-400 text-[10px] mt-0.5">{ct.title || '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 text-[10px]">{ct.function || '—'}</td>
                      <td className="px-3 py-2.5">
                        {ct.contact_dq_status && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${dqCls}`}>{ct.contact_dq_status}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold text-[12px] ${(ct.engaged_score||0) > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{ct.engaged_score ?? '-'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">{roleBadges(ct)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {ct.email ? (
                          <a href={`mailto:${ct.email}`} className="text-blue-600 hover:underline truncate block max-w-[160px] text-[10px]" title={ct.email}>{ct.email}</a>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

        {/* Suggestions tab */}
        {activeTab === 'suggestions' && (
          <table className="w-full text-[11px]">
            <thead><tr className="bg-blue-50">
              {['P','SAP Solution','Contact to Reach','Email','Accepted',''].map(h => (
                <th key={h} className="text-left px-2 py-1.5 font-semibold text-gray-500 uppercase text-[10px] tracking-wide border-b border-blue-100">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {suggestions.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-4 text-gray-400 text-center text-xs">No suggestions for this opportunity.</td></tr>
              ) : [...suggestions].sort((a,b)=>a.priority-b.priority).map((s, si) => (
                <SuggestionRowInline
                  key={si}
                  s={s}
                  contacts={dedupedContacts}
                  assignment={assignMap[s.label]}
                  saving={saveMutation.isPending}
                  onSave={(body) => saveMutation.mutate(body)}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* Competitors tab */}
        {activeTab === 'competitors' && (() => {
          const solutions = (opp.solutions_l2||[]).length > 0 ? opp.solutions_l2 : opp.solutions_l1 || []
          const compMap = Object.fromEntries(Object.entries(competitors).map(([k,v]) => [k,v]))
          return solutions.length === 0 ? (
            <div className="text-gray-400 text-center py-6 text-xs">No solutions identified for this opportunity.</div>
          ) : <div className="p-4">{solutions.map((l2:string) => (
            <CompetitorSection key={l2} l2={l2} oppId={opp.opportunity_id}
              existing={compMap[l2]} onSave={saveCompetitor} />
          ))}</div>
        })()}

        {/* Account Map tab */}
        {activeTab === 'account-map' && (
          <AccountSolutionMapTab accountBp={opp.account_bp} accountName={opp.account_name} />
        )}

        {/* Installed Base tab */}
        {activeTab === 'installed-base' && (
          <InstalledBaseTab
            data={installedBaseData}
            oppSolutionsL1={opp.solutions_l1 || []}
          />
        )}
        </div>
      </div>
    </div>
  )
}

// ── InstalledBaseTab ──────────────────────────────────────────────────────────
const STATUS_STYLE = {
  'Live':             'bg-green-100 text-green-700 border border-green-200',
  'Project':          'bg-blue-100 text-blue-700 border border-blue-200',
  'Unused/Shelfware': 'bg-amber-100 text-amber-700 border border-amber-200',
}
const STATUS_ICON = { 'Live': '✅', 'Project': '🔧', 'Unused/Shelfware': '⚠️' }

function InstalledBaseTab({ data, oppSolutionsL1 }: { data: any; oppSolutionsL1: string[] }) {
  if (!data) {
    return <div className="flex items-center justify-center py-10 text-xs text-gray-400">Loading installed base…</div>
  }

  const solutions: Record<string, Array<{ product_label: string; status: string }>> = data.solutions || {}
  const entries = Object.entries(solutions)

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
        <span className="text-2xl">📦</span>
        <p className="text-xs text-gray-500">No installed base data for this account.</p>
        <p className="text-[10px] text-gray-400">Run the Innovation Dashboard ETL to populate.</p>
      </div>
    )
  }

  const oppL1Lower = oppSolutionsL1.map(s => s.toLowerCase())
  const isInPipeline = (l1: string) =>
    oppL1Lower.some(s => s.includes(l1.toLowerCase().split(' ')[0]))

  const totalLive    = entries.filter(([, ps]) => ps.some(p => p.status === 'Live')).length
  const totalProject = entries.filter(([, ps]) => ps.some(p => p.status === 'Project')).length
  const totalUnused  = entries.filter(([, ps]) => ps.some(p => p.status === 'Unused/Shelfware')).length
  const netNew       = oppSolutionsL1.filter(s => !entries.some(([l1]) => isInPipeline(l1))).length

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-gray-100">
        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">✅ {totalLive} Live</span>
        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">🔧 {totalProject} In Project</span>
        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">⚠️ {totalUnused} Unused</span>
        {netNew > 0 && (
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">✨ {netNew} Net New in pipeline</span>
        )}
      </div>
      <div className="space-y-3">
        {entries.map(([l1, products]) => {
          const inPipeline = isInPipeline(l1)
          return (
            <div key={l1} className={`rounded-lg border px-3 py-2.5 ${inPipeline ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[12px] font-semibold ${inPipeline ? 'text-blue-700' : 'text-gray-800'}`}>{l1}</span>
                {inPipeline && (
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">🎯 In Pipeline</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {products.map(p => (
                  <span key={p.product_label}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_ICON[p.status]} {p.product_label}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
