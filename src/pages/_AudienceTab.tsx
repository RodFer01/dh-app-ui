// @ts-nocheck
import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ExcelJS from 'exceljs'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { ChevronDown, ChevronRight, Download, X } from 'lucide-react'

// ── Re-usable filter components ───────────────────────────────────────────────

const DROPDOWN_CAP = 100

function SearchMultiSel({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const toggle = (v) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const visible = filtered.slice(0, DROPDOWN_CAP)
  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setSearch('') }}
        className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white hover:border-blue-400 transition-colors min-w-[160px]"
      >
        <span className="flex-1 text-left truncate text-gray-700">
          {value.length === 0 ? label : `${label} (${value.length})`}
        </span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-72">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar ${label}...`}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 max-h-20 overflow-y-auto">
              {value.map(v => (
                <span key={v} className="flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                  {v}
                  <button onClick={() => toggle(v)}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1">
            {visible.length === 0 ? (
              <div className="text-xs text-gray-400 px-3 py-2">Nenhum resultado</div>
            ) : visible.map(o => (
              <label key={o} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="rounded flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">{o}</span>
              </label>
            ))}
            {filtered.length > DROPDOWN_CAP && (
              <div className="text-xs text-gray-400 px-3 py-2 text-center">
                {filtered.length - DROPDOWN_CAP} ocultos — digite para filtrar
              </div>
            )}
          </div>
          {value.length > 0 && (
            <div className="border-t p-2">
              <button onClick={() => onChange([])} className="text-xs text-blue-600 hover:underline w-full text-left px-2">
                Limpar todos ({value.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MultiSel({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const toggle = (v) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white hover:border-blue-400 transition-colors min-w-[140px]"
      >
        <span className="flex-1 text-left truncate text-gray-700">
          {value.length === 0 ? label : `${label} (${value.length})`}
        </span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-56">
          <div className="max-h-52 overflow-y-auto p-1">
            {options.map(o => (
              <label key={o} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="rounded flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">{o}</span>
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <div className="border-t p-2">
              <button onClick={() => onChange([])} className="text-xs text-blue-600 hover:underline w-full text-left px-2">
                Limpar ({value.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── LOB chip labels ───────────────────────────────────────────────────────────
const LOB_ROLES = ['ERP', 'HCM', 'CX', 'SCM', 'BTP', 'F&S']

// ── XLS export ────────────────────────────────────────────────────────────────
async function exportXLS(
  accounts: any[],
  contactCampaigns: Record<string, Array<{ id: number; name: string }>>,
  selCampaignId: number | null,
  campaigns: any[],
  sparkRegs: Record<string, any> = {}
) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Audiência')

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  ws.columns = [
    { header: 'Account Name',  key: 'account_name',  width: 36 },
    { header: 'Account BP',    key: 'account_bp',    width: 12 },
    { header: 'AE',            key: 'ae',            width: 22 },
    { header: 'Region',        key: 'region',        width: 15 },
    { header: 'ISS Group',     key: 'iss_group',     width: 22 },
    { header: 'Contact Name',  key: 'contact_name',  width: 28 },
    { header: 'Title',         key: 'title',         width: 32 },
    { header: 'Function',      key: 'func',          width: 22 },
    { header: 'Email',         key: 'email',         width: 34 },
    { header: 'Engaged Score', key: 'score',         width: 14 },
    { header: 'Key Executive', key: 'ke',            width: 14 },
    { header: 'LoB Roles',     key: 'lob_roles',     width: 22 },
    { header: 'Campanhas',     key: 'campanhas',     width: 40 },
    { header: 'Sessão',        key: 'sessao',        width: 35 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B6EC2' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF1B6EC2' } } }
  })

  const BORDER = { style: 'hair' as const, color: { argb: 'FFE2E8F0' } }
  const cellBorder = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }

  for (const acc of accounts) {
    const contacts = selCampaignId !== null
      ? (acc.contacts || []).filter(c =>
          (contactCampaigns[c.prospect_id] || []).some(camp => camp.id === selCampaignId)
        )
      : (acc.contacts || [])

    for (const c of contacts) {
      const lobRoles = [
        c.role_erp && 'ERP', c.role_hcm && 'HCM', c.role_cx && 'CX',
        c.role_scm && 'SCM', c.role_btp && 'BTP', c.role_fs && 'F&S',
      ].filter(Boolean).join(' | ')
      const camps = (contactCampaigns[c.prospect_id] || []).map(x => x.name).join(' | ')
      const reg = sparkRegs[(c.email || '').trim().toLowerCase()]
      const sessao = reg ? `${reg.session || 'Inscrito'}${reg.date ? ` (${reg.date})` : ''}` : ''

      const row = ws.addRow({
        account_name: acc.account_name || '',
        account_bp:   acc.account_bp   || '',
        ae:           acc.opp_owner_name || '',
        region:       acc.region_lvl3  || '',
        iss_group:    acc.iss_group_text || '',
        contact_name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        title:        c.title    || '',
        func:         c.function || '',
        email:        c.email    || '',
        score:        c.engaged_score ?? '',
        ke:           c.key_executive_contact ? 'Yes' : 'No',
        lob_roles:    lobRoles,
        campanhas:    camps,
        sessao:       sessao,
      })
      row.height = 17
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border    = cellBorder
        cell.alignment = { vertical: 'middle' }
        cell.font      = { size: 10 }
      })
    }
  }

  const campName = selCampaignId !== null
    ? (campaigns.find(c => c.id === selCampaignId)?.name || 'campanha')
        .replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    : 'audiencia'
  const date = new Date().toISOString().slice(0, 10)

  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${campName}_${date}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Assign to campaign modal ──────────────────────────────────────────────────
function AssignToCampaignModal({ selectedContacts, onClose, onAssigned }) {
  const [pickedId, setPickedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/api/campaigns').then(r => r.data),
    staleTime: 60_000,
  })

  const contactList = Array.from(selectedContacts.values())

  const handleConfirm = async () => {
    if (!pickedId) { setErr('Selecione uma campanha.'); return }
    setSaving(true); setErr('')
    try {
      const payload = contactList.map(m => ({
        prospect_id:   m.prospect_id,
        contact_name:  [m.first_name, m.last_name].filter(Boolean).join(' '),
        account_bp:    m.account_bp,
        account_name:  m.account_name,
        contact_email: m.email || null,
      }))
      await api.post(`/api/campaigns/${pickedId}/contacts`, payload)
      setDone(true)
      setTimeout(() => { onAssigned(); onClose() }, 1200)
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Erro ao associar contatos.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[480px] max-h-[85vh] overflow-y-auto border border-sap-border flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border flex-shrink-0">
          <h3 className="text-[16px] font-bold text-sap-text">Adicionar à Campanha</h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <div className="text-[13px] text-sap-muted">
            <span className="font-semibold text-sap-text">{contactList.length}</span> contato{contactList.length !== 1 ? 's' : ''} selecionado{contactList.length !== 1 ? 's' : ''}
          </div>

          {done ? (
            <div className="text-center py-4 text-green-600 font-semibold text-[14px]">
              ✓ Contatos adicionados com sucesso!
            </div>
          ) : isLoading ? (
            <div className="text-sm text-sap-muted text-center py-4">Carregando campanhas...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-sm text-sap-muted text-center py-4">
              Nenhuma campanha cadastrada. Crie uma na página Campanhas primeiro.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Selecione a campanha</div>
              {campaigns.map(c => (
                <label
                  key={c.id}
                  className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    pickedId === c.id
                      ? 'border-sap-blue bg-blue-50'
                      : 'border-sap-border hover:border-sap-blue hover:bg-sap-bg'
                  }`}
                >
                  <input
                    type="radio"
                    name="campaign"
                    checked={pickedId === c.id}
                    onChange={() => setPickedId(c.id)}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <div className="text-[13px] font-semibold text-sap-text">{c.name}</div>
                    {c.owner && <div className="text-[11px] text-sap-muted">{c.owner}</div>}
                    {c.objective && (
                      <div className="text-[11px] text-sap-muted truncate max-w-[300px]">{c.objective}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {err && <div className="text-[12px] text-red-500">{err}</div>}
        </div>

        {!done && (
          <div className="px-6 py-4 border-t border-sap-border flex justify-end gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-1.5 text-[13px] border border-sap-border rounded-lg hover:bg-sap-bg">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || !pickedId}
              className="px-5 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d disabled:opacity-50"
            >
              {saving ? 'Adicionando...' : 'Confirmar'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Account row ───────────────────────────────────────────────────────────────
function AccountRow({ acc, selectedContacts, onToggleContact, contactCampaigns, sparkRegs = {}, selCampaignId = null, campFilter = 'all' }) {
  const [expanded, setExpanded] = useState(false)

  const lobOf = (c: any) =>
    [c.role_erp && 'ERP', c.role_hcm && 'HCM', c.role_cx && 'CX',
     c.role_scm && 'SCM', c.role_btp && 'BTP', c.role_fs && 'F&S']
      .filter(Boolean).join(' · ')

  const acvTotal = (acc.opps || []).reduce((s, o) => s + (o.acv_total_opp || 0), 0)

  const visibleContacts = useMemo(() => {
    let cs = acc.contacts || []
    if (selCampaignId !== null) {
      cs = cs.filter(c => (contactCampaigns[c.prospect_id] || []).some(camp => camp.id === selCampaignId))
    }
    if (campFilter === 'in_any') {
      cs = cs.filter(c => (contactCampaigns[c.prospect_id] || []).length > 0)
    } else if (campFilter === 'none') {
      cs = cs.filter(c => (contactCampaigns[c.prospect_id] || []).length === 0)
    }
    return cs
  }, [acc.contacts, selCampaignId, campFilter, contactCampaigns])

  const selectedInAccount = visibleContacts.filter(c => selectedContacts.has(c.prospect_id)).length
  const allSelected = visibleContacts.length > 0 && selectedInAccount === visibleContacts.length

  const toggleAll = () => {
    if (allSelected) {
      visibleContacts.forEach(c => {
        if (selectedContacts.has(c.prospect_id)) onToggleContact(c.prospect_id, null)
      })
    } else {
      visibleContacts.forEach(c => {
        if (!selectedContacts.has(c.prospect_id)) {
          onToggleContact(c.prospect_id, {
            prospect_id: c.prospect_id, first_name: c.first_name, last_name: c.last_name,
            account_bp: acc.account_bp, account_name: acc.account_name, email: c.email,
          })
        }
      })
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <span className="font-600 text-gray-900 text-sm">{acc.account_name}</span>
          <span className="ml-2 text-xs text-gray-400">BP {acc.account_bp}</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 text-xs text-gray-500">
          {acc.opp_owner_name && <span>{acc.opp_owner_name}</span>}
          {acc.region_lvl3 && <span className="text-gray-400">{acc.region_lvl3}</span>}
          <span className={`rounded px-2 py-0.5 ${selectedInAccount > 0 ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}>
            {selectedInAccount > 0 ? `${selectedInAccount}/` : ''}{visibleContacts.length} contato{visibleContacts.length !== 1 ? 's' : ''}
            {visibleContacts.length !== (acc.contacts?.length || 0) && <span className="opacity-70"> ({acc.contacts?.length || 0} total)</span>}
          </span>
          {acc.opps?.length > 0 && (
            <span className="bg-green-50 text-green-700 rounded px-2 py-0.5">
              {acc.opps.length} opp{acc.opps.length !== 1 ? 's' : ''}
              {acvTotal > 0 && <span className="ml-1">· ${(acvTotal / 1000).toFixed(0)}K</span>}
            </span>
          )}
          {acc.installed_solutions?.length > 0 && (
            <span className="bg-purple-50 text-purple-700 rounded px-2 py-0.5">{acc.installed_solutions.length} sol</span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-4">

          {/* Contacts table */}
          {acc.contacts?.length > 0 && (
            <div>
              <div className="text-xs font-700 text-gray-400 uppercase mb-2">Contatos</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1.5 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="rounded"
                          title="Selecionar todos"
                        />
                      </th>
                      {['Nome', 'Título', 'Função', 'LoB Roles', 'Email', 'Score', 'KE', 'Campanha', 'Sessão'].map(h => (
                        <th key={h} className="text-left px-2 py-1.5 text-gray-500 font-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleContacts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-3 text-center text-gray-400 text-xs">
                          Nenhum contato corresponde ao filtro de campanha.
                        </td>
                      </tr>
                    ) : visibleContacts.map((c: any) => {
                      const isSelected = selectedContacts.has(c.prospect_id)
                      const camps = contactCampaigns[c.prospect_id] || []
                      const regInfo = sparkRegs[(c.email || '').trim().toLowerCase()]
                      return (
                        <tr
                          key={c.prospect_id}
                          className={`border-t border-gray-100 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-white'}`}
                          onClick={() => onToggleContact(c.prospect_id, isSelected ? null : {
                            prospect_id: c.prospect_id, first_name: c.first_name, last_name: c.last_name,
                            account_bp: acc.account_bp, account_name: acc.account_name, email: c.email,
                          })}
                        >
                          <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleContact(c.prospect_id, isSelected ? null : {
                                prospect_id: c.prospect_id, first_name: c.first_name, last_name: c.last_name,
                                account_bp: acc.account_bp, account_name: acc.account_name, email: c.email,
                              })}
                              className="rounded"
                            />
                          </td>
                          <td className="px-2 py-1.5 font-500 text-gray-800 whitespace-nowrap">
                            {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-gray-600 max-w-[180px] truncate">{c.title || '—'}</td>
                          <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{c.function || '—'}</td>
                          <td className="px-2 py-1.5">
                            <span className="text-blue-700 font-500">{lobOf(c) || '—'}</span>
                          </td>
                          <td className="px-2 py-1.5">
                            {c.email
                              ? <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>{c.email}</a>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-2 py-1.5 text-center text-gray-600">
                            {c.engaged_score != null ? c.engaged_score : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {c.key_executive_contact
                              ? <span className="text-green-600 font-700">✓</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-1.5">
                            {camps.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {camps.map(camp => (
                                  <span
                                    key={camp.id}
                                    className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5 whitespace-nowrap font-500"
                                  >
                                    {camp.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {regInfo ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 whitespace-nowrap font-500">
                                  ✓ {regInfo.session || 'Inscrito'}
                                </span>
                                {regInfo.date && <span className="text-[10px] text-gray-400">{regInfo.date}</span>}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Opportunities */}
          {acc.opps?.length > 0 && (
            <div>
              <div className="text-xs font-700 text-gray-400 uppercase mb-2">Oportunidades</div>
              <div className="space-y-1">
                {acc.opps.map((o: any) => (
                  <div key={o.opportunity_id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-500 text-gray-800">{o.opp_description || o.opportunity_id}</span>
                        {o.opp_description && <span className="font-mono text-gray-400" style={{fontSize:'10px'}}>{o.opportunity_id}</span>}
                        {o.drm_category && (() => {
                          const drmColors: Record<string,string> = {
                            'Commit':      'bg-green-100 text-green-700',
                            'Upside':      'bg-yellow-100 text-yellow-700',
                            'Pipeline':    'bg-blue-100 text-blue-600',
                            'Booked/Won':  'bg-emerald-100 text-emerald-700',
                          }
                          return <span className={`rounded px-1.5 py-0 font-600 ${drmColors[o.drm_category] || 'bg-gray-100 text-gray-500'}`} style={{fontSize:'10px'}}>{o.drm_category}</span>
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {o.solutions_l1 && <span className="text-gray-400">{Array.isArray(o.solutions_l1) ? o.solutions_l1.join(' · ') : o.solutions_l1}</span>}
                        {o.opp_owner_name && <span className="text-gray-400">&#128100; {o.opp_owner_name}</span>}
                      </div>
                    </div>
                    {o.closing_qtr && <span className="text-gray-500 whitespace-nowrap">{o.closing_qtr}</span>}
                    {o.acv_total_opp > 0 && (
                      <span className="font-600 text-green-700 whitespace-nowrap">
                        ${(o.acv_total_opp / 1000).toFixed(0)}K
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Installed solutions */}
          {acc.installed_solutions?.length > 0 && (
            <div>
              <div className="text-xs font-700 text-gray-400 uppercase mb-2">Soluções instaladas</div>
              <div className="flex flex-wrap gap-1.5">
                {acc.installed_solutions.map((s: string) => (
                  <span key={s} className="text-xs bg-purple-100 text-purple-800 rounded-full px-2.5 py-0.5 font-500">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AudienceTab({ selAEs, selFLSMs, selRegions, selReg4, selQtrs, selISS, selDRM }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const canExport = ['admin', 'manager'].includes(user?.role)
  const [selTitles,    setSelTitles]    = useState<string[]>([])
  const [selFunctions, setSelFunctions] = useState<string[]>([])
  const [selLobRoles,  setSelLobRoles]  = useState<string[]>([])
  const [selSolutions, setSelSolutions] = useState<string[]>([])
  const [selSolL1,     setSelSolL1]     = useState<string[]>([])
  const [selSolL2,     setSelSolL2]     = useState<string[]>([])
  const [hasOpps,      setHasOpps]      = useState(false)
  const [selAccounts,  setSelAccounts]  = useState<string[]>([])
  const [selCampaignId, setSelCampaignId] = useState<number | null>(null)
  const [selCampFilter, setSelCampFilter] = useState<'all' | 'in_any' | 'none'>('all')
  const [page,         setPage]         = useState(1)
  const [selectedContacts, setSelectedContacts] = useState(new Map())
  const [assignModalOpen, setAssignModalOpen] = useState(false)

  // fired snapshot — only updates when the user clicks "Buscar"
  const [fired, setFired] = useState(null)

  const { data: filters } = useQuery({
    queryKey: ['audience-filters'],
    queryFn: () => api.get('/api/ae-analysis/audience-filters').then(r => r.data),
    staleTime: 10 * 60_000,
  })

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/api/campaigns').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: contactCampaigns = {} } = useQuery({
    queryKey: ['campaign-contacts-lookup'],
    queryFn: () => api.get('/api/campaigns/contacts/lookup').then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: sparkRegs = {} } = useQuery({
    queryKey: ['spark-registrations'],
    queryFn: () => api.get('/api/ae-analysis/spark-registrations').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const buildParams = (f) => {
    if (!f) return ''
    const p = new URLSearchParams()
    f.opp_owners.forEach(v => p.append('opp_owners', v))
    f.flsms.forEach(v => p.append('flsms', v))
    f.regions.forEach(v => p.append('regions', v))
    f.region_lvl4s.forEach(v => p.append('region_lvl4s', v))
    f.closing_qtrs.forEach(v => p.append('closing_qtrs', v))
    f.iss_groups.forEach(v => p.append('iss_groups', v))
    f.drm_cats.forEach(v => p.append('drm_cats', v))
    f.titles.forEach(v => p.append('titles', v))
    f.functions.forEach(v => p.append('functions', v))
    f.lob_roles.forEach(v => p.append('lob_roles', v))
    f.solutions.forEach(v => p.append('solutions', v))
    f.sol_l1s.forEach(v => p.append('sol_l1s', v))
    f.sol_l2s.forEach(v => p.append('sol_l2s', v))
    if (f.has_opps) p.set('has_opps', 'true')
    return p.toString()
  }

  const handleSearch = () => {
    setPage(1)
    setSelAccounts([])
    setSelCampaignId(null)
    setSelCampFilter('all')
    setSelectedContacts(new Map())
    setFired({
      opp_owners: selAEs, flsms: selFLSMs, regions: selRegions, region_lvl4s: selReg4,
      closing_qtrs: selQtrs, iss_groups: selISS, drm_cats: selDRM,
      titles: selTitles, functions: selFunctions, lob_roles: selLobRoles,
      solutions: selSolutions, sol_l1s: selSolL1, sol_l2s: selSolL2, has_opps: hasOpps,
    })
  }

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['audience', fired],
    queryFn: () => api.get(`/api/ae-analysis/audience?${buildParams(fired)}`).then(r => r.data),
    enabled: fired !== null,
    staleTime: 3 * 60_000,
    retry: 1,
  })

  const allAccounts = data?.accounts || []

  const accountNameOptions = useMemo(
    () => [...new Set(allAccounts.map(a => a.account_name))].filter(Boolean).sort(),
    [allAccounts]
  )

  // Apply account + campaign filters client-side
  const accounts = useMemo(() => {
    let result = allAccounts
    if (selAccounts.length) {
      result = result.filter(a => selAccounts.includes(a.account_name))
    }
    if (selCampaignId !== null) {
      result = result.filter(a =>
        (a.contacts || []).some(c =>
          (contactCampaigns[c.prospect_id] || []).some(camp => camp.id === selCampaignId)
        )
      )
    }
    if (selCampFilter === 'in_any') {
      result = result.filter(a =>
        (a.contacts || []).some(c => (contactCampaigns[c.prospect_id] || []).length > 0)
      )
    } else if (selCampFilter === 'none') {
      result = result.filter(a =>
        (a.contacts || []).some(c => (contactCampaigns[c.prospect_id] || []).length === 0)
      )
    }
    return result
  }, [allAccounts, selAccounts, selCampaignId, selCampFilter, contactCampaigns])

  const PAGE_SIZE = 50
  const visibleAccounts = accounts.slice(0, page * PAGE_SIZE)

  const toggleLob = (role: string) =>
    setSelLobRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])

  const handleToggleContact = (prospectId, meta) => {
    setSelectedContacts(prev => {
      const next = new Map(prev)
      if (meta === null) {
        next.delete(prospectId)
      } else {
        next.set(prospectId, meta)
      }
      return next
    })
  }

  return (
    <div>
      {/* Filter panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="text-xs font-700 text-gray-400 uppercase">Filtros de contato</div>

        {/* Row 1 — Title + Function */}
        <div className="flex flex-wrap gap-2">
          <SearchMultiSel
            label="Título"
            options={filters?.titles || []}
            value={selTitles}
            onChange={setSelTitles}
          />
          <MultiSel
            label="Função"
            options={filters?.functions || []}
            value={selFunctions}
            onChange={setSelFunctions}
          />
        </div>

        {/* Row 2 — LoB Role chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-500">LoB Role:</span>
          {LOB_ROLES.map(role => (
            <button
              key={role}
              onClick={() => toggleLob(role)}
              className={`text-xs px-3 py-1 rounded-full border font-500 transition-colors ${
                selLobRoles.includes(role)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {role}
            </button>
          ))}
          {selLobRoles.length > 0 && (
            <button onClick={() => setSelLobRoles([])} className="text-xs text-blue-600 hover:underline ml-1">
              Limpar
            </button>
          )}
        </div>

        {/* Row 3 — Solution pipeline filters + Installed solutions + has_opps */}
        <div className="flex flex-wrap gap-3 items-center">
          <SearchMultiSel
            label="Solution L1 (oportunidades)"
            options={filters?.solutions_l1 || []}
            value={selSolL1}
            onChange={setSelSolL1}
          />
          <SearchMultiSel
            label="Solution L2 (oportunidades)"
            options={filters?.solutions_l2 || []}
            value={selSolL2}
            onChange={setSelSolL2}
          />
          <MultiSel
            label="Soluções instaladas"
            options={filters?.solutions || []}
            value={selSolutions}
            onChange={setSelSolutions}
          />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              checked={hasOpps}
              onChange={e => setHasOpps(e.target.checked)}
              className="rounded"
            />
            Somente com oportunidades abertas
          </label>
        </div>

        {/* Search button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSearch}
            disabled={isLoading || isFetching}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading || isFetching ? 'Carregando...' : 'Buscar Audiência'}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!fired && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Configure os filtros e clique em "Buscar Audiência".
        </div>
      )}

      {/* Loading */}
      {fired && isLoading && (
        <div className="text-center py-12 text-gray-400 text-sm">Carregando audiência...</div>
      )}

      {/* Error */}
      {fired && !isLoading && error && (
        <div className="text-center py-10 text-red-500 text-sm space-y-1">
          <div className="font-600">Erro ao buscar audiência</div>
          <div className="text-xs text-red-400">{(error as any)?.response?.data?.detail || (error as any)?.message || 'Erro desconhecido'}</div>
          <div className="text-xs text-gray-400 mt-2">Verifique os filtros ou tente novamente.</div>
        </div>
      )}

      {/* Results */}
      {fired && !isLoading && !error && data && (
        <>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm text-gray-600">
                <span className="font-600 text-gray-900">{data.total_accounts}</span> conta{data.total_accounts !== 1 ? 's' : ''} ·{' '}
                <span className="font-600 text-gray-900">{data.total_contacts}</span> contato{data.total_contacts !== 1 ? 's' : ''}
                {isFetching && <span className="ml-2 text-xs text-gray-400">atualizando…</span>}
              </div>

              {/* Account filter (client-side) */}
              {accountNameOptions.length > 0 && (
                <SearchMultiSel
                  label="Conta"
                  options={accountNameOptions}
                  value={selAccounts}
                  onChange={(val) => { setSelAccounts(val); setPage(1) }}
                />
              )}

              {/* Campaign filter (client-side) */}
              {campaigns.length > 0 && (
                <select
                  value={selCampaignId ?? ''}
                  onChange={e => { setSelCampaignId(e.target.value ? Number(e.target.value) : null); setPage(1) }}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white hover:border-blue-400 transition-colors text-gray-700"
                >
                  <option value="">Campanha (todas)</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {/* Campaign membership filter */}
              <select
                value={selCampFilter}
                onChange={e => { setSelCampFilter(e.target.value as any); setPage(1) }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white hover:border-blue-400 transition-colors text-gray-700"
              >
                <option value="all">Membros (todos)</option>
                <option value="in_any">Em alguma campanha</option>
                <option value="none">Sem campanha</option>
              </select>

              {(selAccounts.length > 0 || selCampaignId !== null || selCampFilter !== 'all') && (
                <span className="text-xs text-gray-500">
                  mostrando {accounts.length} de {allAccounts.length}
                </span>
              )}
            </div>

            {allAccounts.length > 0 && canExport && (
              <button
                onClick={() => exportXLS(accounts, contactCampaigns, selCampaignId, campaigns, sparkRegs)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Download size={13} />
                {selCampaignId !== null ? 'Exportar Campanha' : 'Exportar XLS'}
              </button>
            )}
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Nenhuma conta encontrada com os filtros selecionados.</div>
          ) : (
            <div>
              {visibleAccounts.map((acc: any) => (
                <AccountRow
                  key={acc.account_bp}
                  acc={acc}
                  selectedContacts={selectedContacts}
                  onToggleContact={handleToggleContact}
                  contactCampaigns={contactCampaigns}
                  sparkRegs={sparkRegs}
                  selCampaignId={selCampaignId}
                  campFilter={selCampFilter}
                />
              ))}
              {accounts.length > visibleAccounts.length && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-full mt-2 py-2 text-sm text-blue-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Mostrar mais ({accounts.length - visibleAccounts.length} restantes)
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Floating action bar */}
      {selectedContacts.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[250] bg-white border border-sap-border rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4">
          <span className="text-[13px] text-sap-text font-semibold">
            {selectedContacts.size} contato{selectedContacts.size !== 1 ? 's' : ''} selecionado{selectedContacts.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setAssignModalOpen(true)}
            className="px-4 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d transition-colors"
          >
            Adicionar à Campanha
          </button>
          <button
            onClick={() => setSelectedContacts(new Map())}
            className="px-3 py-1.5 text-[13px] border border-sap-border rounded-lg hover:bg-sap-bg transition-colors text-sap-muted"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Assign modal */}
      {assignModalOpen && (
        <AssignToCampaignModal
          selectedContacts={selectedContacts}
          onClose={() => setAssignModalOpen(false)}
          onAssigned={() => {
            setSelectedContacts(new Map())
            qc.invalidateQueries({ queryKey: ['campaign-contacts-lookup'] })
          }}
        />
      )}
    </div>
  )
}
