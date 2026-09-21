// @ts-nocheck
import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { SectionLabel } from '../components/SectionLabel'
import { IndustryPropensityTab } from './_IndustryPropensityTab'
import { AudienceTab } from './_AudienceTab'
import { useAuth } from '../context/AuthContext'
import { formatAcvK } from '../lib/utils'
import { Download, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { exportToExcel } from '../lib/exportExcel'
import { ContactsDrawerInline } from '../components/ContactsDrawer'

// ── SAP solution catalog for the "add suggestion" picker ──────────────────────
const SAP_SOLUTIONS = [
  'S/4HANA Cloud','S/4HANA Finance','S/4HANA Retail','S/4HANA Utilities','S/4HANA Public Cloud',
  'SAP SuccessFactors','SAP Analytics Cloud','SAP IBP','SAP Ariba','SAP Concur',
  'SAP Commerce Cloud','SAP Emarsys','SAP Customer Data Platform','SAP Sales Cloud',
  'SAP Service Cloud','SAP Joule','SAP BTP','SAP Sustainability','SAP PM/EAM',
  'SAP QM','SAP PLM','SAP EHS','SAP TM','SAP EWM','SAP PS','SAP TPM',
  'SAP LO-SER','SAP Risk & Compliance','SAP Fieldglass','SAP Spend Management',
]

// ── Multi-select with search (for high-cardinality filters like AE / FLSM) ───
function SearchMultiSel({ label, options, value, onChange }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const toggle = (v) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
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
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar ${label}...`}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
          {/* Selected chips */}
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 max-h-20 overflow-y-auto">
              {value.map(v => (
                <span key={v} className="flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                  {v.split(',')[0].trim()}
                  <button onClick={() => toggle(v)}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          {/* Options list */}
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-gray-400 px-3 py-2">Nenhum resultado</div>
            ) : filtered.map(o => (
              <label key={o} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="rounded flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">{o}</span>
              </label>
            ))}
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

// ── Simple multi-select (low-cardinality options) ─────────────────────────────
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
                Clear ({value.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Industry card ──────────────────────────────────────────────────────────────
function IndustryCard({ data, extraSugs, onAddSug, onRemoveSug, onSelectIndustry, selected }) {
  const { industry, icon, color, opps, acv_total, solutions_l1 = [], solutions_l2 = [], gaps = [] } = data
  const allGaps = [...gaps, ...(extraSugs || []).map(s => ({ label: s, priority: 3 }))]
  const p1 = allGaps.filter(g => g.priority === 1)
  const p2 = allGaps.filter(g => g.priority === 2)
  const p3 = allGaps.filter(g => g.priority === 3)
  return (
    <div
      onClick={() => onSelectIndustry(industry)}
      className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="text-lg">{icon || '🏭'}</div>
          <div className="text-xs font-600 text-gray-900 leading-tight truncate" title={industry}>{industry}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-700 text-blue-700">{opps}</div>
          <div className="text-[10px] text-gray-400">opps</div>
        </div>
      </div>
      {(solutions_l1.length > 0 || solutions_l2.length > 0) && (
        <div className="flex flex-wrap gap-0.5 mb-1.5">
          {(solutions_l2.length > 0 ? solutions_l2 : solutions_l1).slice(0,3).map(s => (
            <span key={s} className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1 py-0.5 truncate max-w-[80px]" title={s}>{s}</span>
          ))}
        </div>
      )}
      {allGaps.length > 0 && (
        <div className="mt-1.5 border-t border-gray-100 pt-1.5">
          <div className="text-[9px] font-600 text-gray-400 mb-1 uppercase tracking-wide">SAP Suggestions</div>
          <div className="flex flex-col gap-0.5">
            {p1.map(g => <span key={g.label} className="text-[9px] bg-orange-100 text-orange-800 border border-orange-200 rounded px-1 py-0.5"><span className="font-700">P1</span> {g.label}</span>)}
            {p2.slice(0,1).map(g => <span key={g.label} className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 rounded px-1 py-0.5"><span className="font-700">P2</span> {g.label}</span>)}
            {p3.slice(0,1).map(g => <span key={g.label} className="text-[9px] bg-gray-50 text-gray-600 border border-gray-200 rounded px-1 py-0.5"><span className="font-700">P3</span> {g.label}</span>)}
          </div>
        </div>
      )}
      {/* Add suggestion button */}
      <AddSuggestion industry={industry} current={allGaps.map(g=>g.label)} onAdd={onAddSug} onRemove={onRemoveSug} extras={extraSugs||[]} />
    </div>
  )
}

// ── Add/remove custom suggestions ─────────────────────────────────────────────
function AddSuggestion({ industry, current, onAdd, onRemove, extras }) {
  const [open, setOpen] = useState(false)
  const available = SAP_SOLUTIONS.filter(s => !current.includes(s))
  return (
    <div className="relative mt-1.5" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o=>!o)}
        className="text-[9px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
        <Plus size={9}/> Add suggestion
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-52">
          <div className="p-1 text-[10px] text-gray-400 px-2 py-1.5 font-600 uppercase border-b">Add to {industry.split(' - ')[0]}</div>
          <div className="max-h-40 overflow-y-auto p-1">
            {extras.map(s => (
              <div key={s} className="flex items-center justify-between px-2 py-1 text-xs bg-blue-50 rounded mb-0.5">
                {s}<button onClick={() => { onRemove(industry, s); setOpen(false) }}><X size={9}/></button>
              </div>
            ))}
            {available.slice(0,15).map(s => (
              <label key={s} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs">
                <button className="text-blue-600" onClick={() => { onAdd(industry, s); setOpen(false) }}><Plus size={10}/></button>{s}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AEAnalysisPage() {
  const { currency, fxRate, user } = useAuth()
  const canExport = ['admin', 'manager'].includes(user?.role)

  const [selAEs,     setSelAEs]     = useState([])
  const [selFLSMs,   setSelFLSMs]   = useState([])
  const [selRegions, setSelRegions] = useState([])
  const [selReg4,    setSelReg4]    = useState([])
  const [selQtrs,    setSelQtrs]    = useState([])
  const [selISS,     setSelISS]     = useState([])
  const [selDRM,     setSelDRM]     = useState([])
  const [selPriorities, setSelPriorities] = useState<string[]>([])
  const [probMin,    setProbMin]    = useState('')
  const [probMax,    setProbMax]    = useState('')
  const [selIAEs,    setSelIAEs]    = useState<string[]>([])
  const [selSpecCX,  setSelSpecCX]  = useState<string[]>([])
  const [selSpecHXM, setSelSpecHXM] = useState<string[]>([])
  const [selSpecProcurement, setSelSpecProcurement] = useState<string[]>([])
  const [selSpecDSC, setSelSpecDSC] = useState<string[]>([])
  const [selSpecBTP, setSelSpecBTP] = useState<string[]>([])
  const [selSpecBDC, setSelSpecBDC] = useState<string[]>([])
  const [selSpecFIN, setSelSpecFIN] = useState<string[]>([])
  const [selSpecPRO, setSelSpecPRO] = useState<string[]>([])
  const [selSolL1,   setSelSolL1]   = useState<string[]>([])
  const [selSolL2,   setSelSolL2]   = useState<string[]>([])

  const [expandedAEs,  setExpandedAEs]  = useState({})
  const [selectedAE,   setSelectedAE]   = useState(null)
  const [selectedInd,  setSelectedInd]  = useState(null)
  const [extraSugs,    setExtraSugs]    = useState({})
  const addSug    = (ind, sol) => setExtraSugs(p => ({ ...p, [ind]: [...(p[ind]||[]), sol] }))
  const removeSug = (ind, sol) => setExtraSugs(p => ({ ...p, [ind]: (p[ind]||[]).filter(s=>s!==sol) }))

  const [activeTab,    setActiveTab]    = useState('territory')
  const [drawerOpp,    setDrawerOpp]    = useState(null)
  const [allExpanded,  setAllExpanded]  = useState(true)
  const [emailModal,   setEmailModal]   = useState(false)
  const [emailTo,      setEmailTo]      = useState('')
  const [emailCc,      setEmailCc]      = useState('')
  const [sending,      setSending]      = useState(false)

  const { data: filters } = useQuery({
    queryKey: ['ae-filters'],
    queryFn: () => api.get('/api/ae-analysis/filters').then(r => r.data),
  })

  const params = new URLSearchParams()
  selAEs.forEach(v => params.append('opp_owners', v))
  selFLSMs.forEach(v => params.append('flsms', v))
  selRegions.forEach(v => params.append('regions', v))
  selReg4.forEach(v => params.append('region_lvl4s', v))
  selQtrs.forEach(v => params.append('closing_qtrs', v))
  selISS.forEach(v => params.append('iss_groups', v))
  selDRM.forEach(v => params.append('drm_cats', v))
  selPriorities.forEach(v => params.append('priorities', v))
  if (probMin) params.set('probability_min', probMin)
  if (probMax) params.set('probability_max', probMax)
  selIAEs.forEach(v => params.append('iaes', v))
  selSpecCX.forEach(v => params.append('spec_cxs', v))
  selSpecHXM.forEach(v => params.append('spec_hxms', v))
  selSpecProcurement.forEach(v => params.append('spec_procurements', v))
  selSpecDSC.forEach(v => params.append('spec_dscs', v))
  selSpecBTP.forEach(v => params.append('spec_btps', v))
  selSpecBDC.forEach(v => params.append('spec_bdcs', v))
  selSpecFIN.forEach(v => params.append('spec_fins', v))
  selSpecPRO.forEach(v => params.append('spec_pros', v))
  selSolL1.forEach(v => params.append('sol_l1s', v))
  selSolL2.forEach(v => params.append('sol_l2s', v))

  const { data: territory, isLoading: loadingTerritory } = useQuery({
    queryKey: ['ae-territory', params.toString()],
    queryFn: () => api.get(`/api/ae-analysis/territory?${params}`).then(r => r.data),
    enabled: selAEs.length > 0 || selFLSMs.length > 0,
  })

  const oppParams = new URLSearchParams(params)
  if (selectedAE)  oppParams.set('ae', selectedAE)
  if (selectedInd) oppParams.set('industry', selectedInd)

  const anyFilterActive = !!(selectedAE || selectedInd || selAEs.length || selFLSMs.length || selRegions.length || selReg4.length || selQtrs.length || selISS.length || selDRM.length || selPriorities.length || probMin || probMax)

  const { data: oppsData, isLoading: loadingOpps } = useQuery({
    queryKey: ['ae-opps', oppParams.toString()],
    queryFn: () => api.get(`/api/ae-analysis/opps?${oppParams}`).then(r => r.data),
    enabled: anyFilterActive,
  })

  const territoryData = territory?.data || {}
  const aeAcv         = territory?.ae_acv || {}
  const opps          = oppsData?.opps || []

  const totalAEs     = Object.keys(territoryData).length
  const totalOpps    = anyFilterActive && opps.length > 0 ? new Set(opps.map(o=>o.opportunity_id)).size : Object.values(territoryData).flat().reduce((s,i)=>s+i.opps,0)
  const totalACV     = anyFilterActive && opps.length > 0 ? opps.reduce((s,o)=>s+(o.acv_total_opp||0),0)*fxRate : Object.values(aeAcv).reduce((s,v)=>s+v,0)*fxRate
  const totalInds    = anyFilterActive && opps.length > 0 ? new Set(opps.map(o=>o.sap_mastercode).filter(Boolean)).size : new Set(Object.values(territoryData).flat().map(i=>i.industry)).size
  const totalBaskets = opps.filter(o=>o.is_basket).length

  // Industry distribution for charts
  const byIndustry = useMemo(() => {
    if (!opps.length) return []
    const map = {}
    opps.forEach(o => {
      const k = o.sap_mastercode || '-'
      if (!map[k]) map[k] = { opps:0, acv:0 }
      map[k].opps++
      map[k].acv += o.acv_total_opp || 0
    })
    return Object.entries(map).map(([name,v]) => ({ name: name.split(' - ').slice(1).join(' - ') || name, ...v }))
      .sort((a,b) => b.acv - a.acv).slice(0,10)
  }, [opps])


  // Top 5 industries by ACV, each with their solution L1 composition
  const industryComposition = useMemo(() => {
    if (!opps.length) return []
    // Build per-industry: acv total + solution breakdown
    const indMap = {}
    opps.forEach(o => {
      const ind = (o.sap_mastercode || '-').split(' - ').slice(1).join(' - ') || o.sap_mastercode || '-'
      if (!indMap[ind]) indMap[ind] = { acv: 0, opps: new Set(), sols: {} }
      indMap[ind].acv += o.acv_total_opp || 0
      indMap[ind].opps.add(o.opportunity_id)
      const sols = o.solutions_l1 || []
      const share = sols.length > 0 ? (o.acv_total_opp || 0) / sols.length : 0
      sols.forEach(s => {
        indMap[ind].sols[s] = (indMap[ind].sols[s] || 0) + share
      })
    })
    // Take top 5 by ACV
    return Object.entries(indMap)
      .map(([name, v]) => ({
        name,
        acv: v.acv,
        opps: v.opps.size,
        sols: Object.entries(v.sols)
          .map(([sol, acv]) => ({ sol, acv }))
          .sort((a, b) => b.acv - a.acv)
          .slice(0, 6),
      }))
      .sort((a, b) => b.acv - a.acv)
      .slice(0, 5)
  }, [opps])

  const [showSolChart, setShowSolChart] = useState(true)

  const handleExport = () => {
    if (!opps.length) return
    exportToExcel(opps.map(o => ({
      'AE': o.opp_owner_name, 'Opp ID': o.opportunity_id, 'Account': o.account_name,
      'Description': o.opp_description, 'Industry': o.sap_mastercode,
      'Phase': o.opp_phase, 'Closing Qtr': o.closing_qtr, 'DRM': o.drm_category,
      'Basket': o.is_basket ? `Yes (${o.solution_lines})` : 'No',
      'Solutions L1': (o.solutions_l1||[]).join(' | '),
      'Solutions L2': (o.solutions_l2||[]).join(' | '),
      'Suggestions': (o.suggestions||[]).map(s=>`[P${s.priority}] ${s.label}`).join(' | '),
      'ACV kUSD': o.acv_total_opp ? (o.acv_total_opp/1000).toFixed(1) : '',
      'Engagement': o.engagement_type, 'DH SA': o.vat_dh, 'FLSM': o.flsm, 'Region': o.region_lvl3,
    })), 'ae_territory_analysis')
  }

  const handleExportOutreachPlan = async () => {
    if (!opps.length) return
    // Collect assignments + contacts for all visible opps
    const rows: any[] = []
    for (const opp of opps) {
      const [assignRes, contactsRes] = await Promise.all([
        api.get(`/api/outreach/assignments/${opp.opportunity_id}`).then(r => r.data).catch(() => ({ assignments: [] })),
        opp.account_bp
          ? api.get(`/api/outreach/contacts/${opp.account_bp}`).then(r => r.data).catch(() => ({ contacts: [] }))
          : Promise.resolve({ contacts: [] }),
      ])
      const assignments = assignRes.assignments || []
      const contacts    = contactsRes.contacts   || []
      const contactMap  = Object.fromEntries(contacts.map(c => [c.prospect_id, c]))

      for (const asgn of assignments) {
        if (!asgn.prospect_id && !asgn.contact_name) continue
        const contact = contactMap[asgn.prospect_id] || {}
        const name    = contact.first_name
          ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
          : asgn.contact_name || '—'
        rows.push({
          'Account':     opp.account_name,
          'Opportunity': opp.opp_description,
          'AE':          opp.opp_owner_name,
          'Industry':    opp.sap_mastercode,
          'SAP Solution': asgn.suggestion,
          'Priority':    '',
          'Contact Name': name,
          'Title':       contact.title || '—',
          'Email':       contact.email || '—',
          'Phone':       contact.work_phone || contact.mobile_phone || '—',
          'Accepted':    asgn.accepted === 1 ? 'Yes' : asgn.accepted === 2 ? 'No' : 'Pending',
        })
      }
      // Also add suggestions without contact assigned yet
      for (const sug of (opp.suggestions || [])) {
        const already = assignments.find(a => a.suggestion === sug.label)
        if (already) continue
        rows.push({
          'Account':     opp.account_name,
          'Opportunity': opp.opp_description,
          'AE':          opp.opp_owner_name,
          'Industry':    opp.sap_mastercode,
          'SAP Solution': sug.label,
          'Priority':    `P${sug.priority}`,
          'Contact Name': '— not assigned —',
          'Title':       '',
          'Email':       '',
          'Phone':       '',
          'Accepted':    'Pending',
        })
      }
    }
    if (!rows.length) { alert('No outreach assignments found. Open an opportunity and assign contacts to solutions first.'); return }
    exportToExcel(rows, 'outreach_plan')
  }

  const handleSendEmail = async () => {
    if (!emailTo.trim()) return
    setSending(true)
    try {
      await api.post('/api/outreach/send-review-email', {
        to: emailTo, cc: emailCc,
        opportunity_ids: [...new Set(opps.map(o=>o.opportunity_id))],
      })
      setEmailModal(false); setEmailTo('')
    } catch (e) {
      alert('Error sending email: ' + (e?.response?.data?.detail || e.message))
    } finally { setSending(false) }
  }

  const toggleAE = (ae) => setExpandedAEs(p => ({ ...p, [ae]: !p[ae] }))
  const handleSelectIndustry = (ae, ind) => {
    if (selectedAE === ae && selectedInd === ind) { setSelectedAE(null); setSelectedInd(null) }
    else { setSelectedAE(ae); setSelectedInd(ind) }
  }

  // Require AE or FLSM filter for territory view (Change 2)
  const canShowTerritory = selAEs.length > 0 || selFLSMs.length > 0

  return (
    <div className="p-5 max-w-screen-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-700 text-gray-900">AE Territory Analysis</h1>
        <p className="text-sm text-gray-500 mt-0.5">Territory view by AE → industry → opportunities · suggests missing SAP solutions</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="text-xs font-700 text-gray-400 uppercase tracking-wide mb-3">Filters</div>
        <div className="flex flex-wrap gap-2">
          {filters && <>
            <SearchMultiSel label="AE (Opp Owner)" options={filters.opp_owners||[]}  value={selAEs}     onChange={setSelAEs} />
            <SearchMultiSel label="FLSM"            options={filters.flsms||[]}       value={selFLSMs}   onChange={setSelFLSMs} />
            <MultiSel label="Region (Lvl 3)"  options={filters.regions||[]}       value={selRegions} onChange={setSelRegions} />
            <MultiSel label="Region (Lvl 4)"  options={filters.region_lvl4s||[]}  value={selReg4}    onChange={setSelReg4} />
            <MultiSel label="Closing Quarter" options={filters.closing_qtrs||[]}  value={selQtrs}    onChange={setSelQtrs} />
            <MultiSel label="ISS Group"       options={filters.iss_groups||[]}    value={selISS}     onChange={setSelISS} />
            <MultiSel label="DRM Category"    options={filters.drm_cats||[]}      value={selDRM}     onChange={setSelDRM} />
            <MultiSel label="Priority" options={['1','2','3','4','5','6','7','8','9','10']} value={selPriorities} onChange={setSelPriorities} />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Probability %</label>
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="100" placeholder="Min"
                  value={probMin} onChange={e => setProbMin(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500" />
                <span className="text-gray-400 text-[11px]">–</span>
                <input type="number" min="0" max="100" placeholder="Max"
                  value={probMax} onChange={e => setProbMax(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <SearchMultiSel label="IAE"              options={filters.iaes||[]}              value={selIAEs}             onChange={setSelIAEs} />
            <SearchMultiSel label="SPEC CX"          options={filters.spec_cxs||[]}          value={selSpecCX}           onChange={setSelSpecCX} />
            <SearchMultiSel label="SPEC HXM"         options={filters.spec_hxms||[]}         value={selSpecHXM}          onChange={setSelSpecHXM} />
            <SearchMultiSel label="SPEC Procurement" options={filters.spec_procurements||[]}  value={selSpecProcurement}  onChange={setSelSpecProcurement} />
            <SearchMultiSel label="SPEC DSC"         options={filters.spec_dscs||[]}         value={selSpecDSC}          onChange={setSelSpecDSC} />
            <SearchMultiSel label="SPEC BTP"         options={filters.spec_btps||[]}         value={selSpecBTP}          onChange={setSelSpecBTP} />
            <SearchMultiSel label="SPEC BDC"         options={filters.spec_bdcs||[]}         value={selSpecBDC}          onChange={setSelSpecBDC} />
            <SearchMultiSel label="SPEC FIN"         options={filters.spec_fins||[]}         value={selSpecFIN}          onChange={setSelSpecFIN} />
            <SearchMultiSel label="SPEC PRO"         options={filters.spec_pros||[]}         value={selSpecPRO}          onChange={setSelSpecPRO} />
            <SearchMultiSel label="Solution L1"      options={filters.solutions_l1||[]}      value={selSolL1}            onChange={setSelSolL1} />
            <SearchMultiSel label="Solution L2"      options={filters.solutions_l2||[]}      value={selSolL2}            onChange={setSelSolL2} />
            {(selAEs.length+selFLSMs.length+selRegions.length+selReg4.length+selQtrs.length+selISS.length+selDRM.length+selPriorities.length+(probMin?1:0)+(probMax?1:0)+selIAEs.length+selSpecCX.length+selSpecHXM.length+selSpecProcurement.length+selSpecDSC.length+selSpecBTP.length+selSpecBDC.length+selSpecFIN.length+selSpecPRO.length+selSolL1.length+selSolL2.length) > 0 && (
              <button onClick={() => { setSelAEs([]); setSelFLSMs([]); setSelRegions([]); setSelReg4([]); setSelQtrs([]); setSelISS([]); setSelDRM([]); setSelPriorities([]); setProbMin(''); setProbMax(''); setSelIAEs([]); setSelSpecCX([]); setSelSpecHXM([]); setSelSpecProcurement([]); setSelSpecDSC([]); setSelSpecBTP([]); setSelSpecBDC([]); setSelSpecFIN([]); setSelSpecPRO([]); setSelSolL1([]); setSelSolL2([]) }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X size={12}/> Clear all
              </button>
            )}
          </>}
        </div>
      </div>

      {/* Page tabs */}
      <div className="flex border-b border-gray-200 mb-5 bg-white rounded-t-xl px-4">
        {[
          { key: 'territory', label: '🗺️ Territory by AE' },
          { key: 'industry',  label: '📊 Industry Propensity 2026–2027' },
          { key: 'audience',  label: '🎯 Audiência' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-3 text-sm font-500 border-b-2 transition-colors ${activeTab===t.key?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}
          >{t.label}</button>
        ))}
      </div>

      {activeTab === 'territory' && <>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'AEs in filter',      value: totalAEs },
          { label: 'Unique Opportunities',value: totalOpps.toLocaleString() },
          { label: `ACV Total (${currency})`, value: formatAcvK(totalACV, currency) },
          { label: 'Industries',          value: totalInds },
          { label: 'Basket Deals',        value: totalBaskets },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-700 text-blue-600">{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Industry distribution charts — always visible (Change 1) */}
      {byIndustry.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl mb-5">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="font-600 text-gray-900 text-sm">📊 Industry Distribution</span>
          </div>
          <div className="grid grid-cols-2 gap-0 p-4">
            <div className="pr-4 border-r border-gray-100">
              <div className="text-xs font-700 text-gray-400 uppercase tracking-wide mb-3">By # Opportunities</div>
              {[...byIndustry].sort((a,b)=>b.opps-a.opps).map((d,i) => (
                <div key={d.name} className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-gray-700 truncate max-w-[200px]" title={d.name}>{d.name}</span>
                    <span className="text-xs font-700 text-blue-700 ml-2">{d.opps}</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full rounded" style={{width:`${(d.opps/byIndustry[0].opps)*100}%`,background:`hsl(${220-i*8},70%,${50+i*3}%)`}} />
                  </div>
                </div>
              ))}
            </div>
            <div className="pl-4">
              <div className="text-xs font-700 text-gray-400 uppercase tracking-wide mb-3">By ACV (k{currency})</div>
              {byIndustry.map((d,i) => (
                <div key={d.name} className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-gray-700 truncate max-w-[200px]" title={d.name}>{d.name}</span>
                    <span className="text-xs font-700 text-blue-700 ml-2">{formatAcvK(d.acv*fxRate, currency)}</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full rounded" style={{width:`${(d.acv/byIndustry[0].acv)*100}%`,background:`hsl(${150-i*8},60%,${45+i*3}%)`}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Solution L1 composition by Industry — show/hide */}
      {industryComposition.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl mb-5">
          <button onClick={() => setShowSolChart(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <span className="font-600 text-gray-900 text-sm">📦 Solution Mix — Top {industryComposition.length} Industries</span>
            <span className="text-xs text-gray-400">{showSolChart ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showSolChart && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {industryComposition.map((ind, ii) => {
                const totalSolAcv = ind.sols.reduce((s, x) => s + x.acv, 0)
                const IND_COLORS = ['#0070f2','#256f3a','#e76500','#5d36ff','#aa0808','#046c7a','#7a5800']
                const SOL_PALETTE = ['#3b82f6','#22c55e','#f97316','#8b5cf6','#ef4444','#06b6d4','#eab308','#ec4899','#14b8a6']
                const indColor = IND_COLORS[ii % IND_COLORS.length]
                return (
                  <div key={ind.name} className="border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-2.5 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-700 text-gray-900 leading-tight truncate" title={ind.name}>{ind.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{ind.opps} opps</div>
                      </div>
                      <div className="text-[11px] font-700 flex-shrink-0" style={{color: indColor}}>{formatAcvK(ind.acv * fxRate, currency)}</div>
                    </div>
                    {/* Stacked proportion bar */}
                    <div className="h-2 rounded-full overflow-hidden flex mb-2.5">
                      {ind.sols.map((s, si) => {
                        const pct = totalSolAcv > 0 ? (s.acv / totalSolAcv) * 100 : 0
                        return pct > 1 ? (
                          <div key={s.sol} title={`${s.sol}: ${Math.round(pct)}%`}
                            className="h-full transition-all"
                            style={{ width: `${pct}%`, background: SOL_PALETTE[si % SOL_PALETTE.length] }} />
                        ) : null
                      })}
                    </div>
                    {/* Solution rows — compact */}
                    <div className="space-y-1">
                      {ind.sols.map((s, si) => {
                        const pct = totalSolAcv > 0 ? Math.round(s.acv / totalSolAcv * 100) : 0
                        if (pct < 1) return null
                        return (
                          <div key={s.sol} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{background: SOL_PALETTE[si % SOL_PALETTE.length]}} />
                            <span className="text-[10px] text-gray-700 flex-1 truncate" title={s.sol}>{s.sol}</span>
                            <span className="text-[10px] font-600 text-gray-500 flex-shrink-0">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Territory Map — requires AE or FLSM (Change 2) */}
      <div className="bg-white border border-gray-200 rounded-xl mb-5">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <div className="font-600 text-gray-900">Territory View by Industry</div>
            <div className="text-xs text-gray-400">Click an AE to expand · click an industry to drill down</div>
          </div>
          <div className="flex gap-2">
            {canShowTerritory && (
              <button onClick={() => { setAllExpanded(e=>!e); setExpandedAEs({}) }}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1">
                {allExpanded ? <><ChevronDown size={12}/> Collapse all</> : <><ChevronRight size={12}/> Expand all</>}
              </button>
            )}
            {opps.length > 0 && canExport && (
              <>
                <button onClick={handleExport} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                  <Download size={12}/> Export Pipeline
                </button>
                <button onClick={handleExportOutreachPlan} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700">
                  <Download size={12}/> Export Outreach Plan
                </button>
              </>
            )}
          </div>
        </div>

        {!canShowTerritory ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">👤</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">Select an AE or FLSM to view territory</div>
            <div className="text-xs text-gray-400">Use the AE (Opp Owner) or FLSM filters above to load the territory map.</div>
          </div>
        ) : loadingTerritory ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading territory...</div>
        ) : Object.keys(territoryData).length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No data for the selected filters.</div>
        ) : (
          <div className="p-4">
            {Object.entries(territoryData).map(([ae, industries]) => {
              const isExpanded = allExpanded ? expandedAEs[ae] !== false : expandedAEs[ae] === true
              const aeTotal = (aeAcv[ae]||0) * fxRate
              const aeOpps  = industries.reduce((s,i)=>s+i.opps,0)
              const totalGaps = industries.reduce((s,i)=>s+(i.gaps?.length||0),0)
              const p1Gaps    = industries.reduce((s,i)=>s+(i.gaps?.filter(g=>g.priority===1).length||0),0)
              return (
                <div key={ae} className="mb-4 border border-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => toggleAE(ae)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>}
                    <div className="flex-1">
                      <span className="font-600 text-gray-900">{ae}</span>
                      <span className="ml-3 text-xs text-gray-500">{industries.length} industries · {aeOpps} opps</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {totalGaps > 0 && (
                        <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 rounded-full px-2 py-0.5">
                          💡 {p1Gaps > 0 ? `${p1Gaps} P1` : `${totalGaps}`} suggestions
                        </span>
                      )}
                      <span className="text-sm font-700 text-blue-700">{formatAcvK(aeTotal, currency)}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {industries.map(ind => (
                        <IndustryCard key={ind.industry} data={ind}
                          extraSugs={extraSugs[ind.industry]}
                          onAddSug={addSug} onRemoveSug={removeSug}
                          onSelectIndustry={(i) => handleSelectIndustry(ae, i)}
                          selected={selectedAE===ae && selectedInd===ind.industry}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Opportunity table */}
      {anyFilterActive && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div>
              <div className="font-600 text-gray-900">
                Opportunities
                {selectedAE && <span className="ml-2 text-blue-600">· {selectedAE}</span>}
                {selectedInd && <span className="ml-2 text-orange-600">· {selectedInd}</span>}
              </div>
              <div className="text-xs text-gray-400">{opps.length} opportunities · click a row to view contacts and suggestions</div>
            </div>
            <div className="flex gap-2">
              {(selectedAE || selectedInd) && (
                <button onClick={() => { setSelectedAE(null); setSelectedInd(null) }} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1">
                  <X size={12}/> Clear selection
                </button>
              )}
              {opps.length > 0 && canExport && (
                <>
                  <button onClick={handleExport} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                    <Download size={12}/> Excel
                  </button>
                  <button onClick={handleExportOutreachPlan} className="flex items-center gap-1.5 text-xs border border-green-300 text-green-700 rounded-lg px-3 py-1.5 hover:bg-green-50">
                    <Download size={12}/> Outreach Plan
                  </button>
                  <button onClick={() => setEmailModal(true)} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700">
                    ✉ Send Email
                  </button>
                </>
              )}
            </div>
          </div>

          {loadingOpps ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading opportunities...</div>
          ) : opps.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No opportunities found.</div>
          ) : (() => {
            const byAccount = opps.reduce((acc, o) => {
              const key = o.account_name || '-'
              if (!acc[key]) acc[key] = []
              acc[key].push(o)
              return acc
            }, {})

            return (
              <div className="overflow-x-auto">
                <table className="w-full" style={{fontSize:'11px'}}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Account / Opportunity','AE','Industry','Qtr','DRM','Solutions L2','SAP Suggestions','ACV k','Eng.','DH SA'].map(h => (
                        <th key={h} className="text-left px-2 py-2 font-700 text-gray-500 uppercase tracking-wide whitespace-nowrap" style={{fontSize:'10px'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byAccount).map(([account, rows]) => {
                      const accountACV = rows.reduce((s,r) => s+(r.acv_total_opp||0), 0)
                      return (
                        <React.Fragment key={account}>
                          <tr className="bg-blue-50 border-b border-blue-100">
                            <td colSpan={10} className="px-2 py-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <span className="font-700 text-blue-900" style={{fontSize:'11px'}}>{account}</span>
                                  {/* Solution chips */}
                                  {(() => {
                                    const sols = [...new Set(rows.flatMap(r => (r.solutions_l2||[]).length > 0 ? r.solutions_l2 : r.solutions_l1||[]))]
                                    if (!sols.length) return null
                                    return (
                                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                                        {sols.slice(0, 8).map(s => (
                                          <span key={s} className="bg-white text-blue-700 border border-blue-200 rounded px-1 py-0 truncate max-w-[140px]" title={s} style={{fontSize:'9px'}}>{s}</span>
                                        ))}
                                        {sols.length > 8 && <span className="text-blue-400" style={{fontSize:'9px'}}>+{sols.length - 8} more</span>}
                                      </div>
                                    )
                                  })()}
                                  {/* Opp IDs + DRM + Owners */}
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                    {/* Opportunity IDs */}
                                    <div className="flex flex-wrap gap-0.5">
                                      {rows.map(r => (
                                        <span key={r.opportunity_id} className="bg-white text-blue-500 border border-blue-100 rounded px-1 py-0 font-mono" title={r.opportunity_id} style={{fontSize:'9px'}}>{r.opportunity_id}</span>
                                      ))}
                                    </div>
                                    {/* DRM breakdown */}
                                    {(() => {
                                      const drm = rows.reduce<Record<string,number>>((acc, r) => {
                                        const cat = r.drm_category || 'Unknown'
                                        acc[cat] = (acc[cat] || 0) + 1
                                        return acc
                                      }, {})
                                      const colors: Record<string,string> = {
                                        'Commit': 'bg-green-100 text-green-700',
                                        'Upside': 'bg-yellow-100 text-yellow-700',
                                        'Pipeline': 'bg-blue-100 text-blue-600',
                                        'Booked/Won': 'bg-emerald-100 text-emerald-700',
                                      }
                                      return Object.entries(drm).map(([cat, cnt]) => (
                                        <span key={cat} className={`rounded px-1 py-0 font-600 ${colors[cat] || 'bg-gray-100 text-gray-600'}`} style={{fontSize:'9px'}}>
                                          {cnt} {cat}
                                        </span>
                                      ))
                                    })()}
                                    {/* AE Owners */}
                                    {[...new Set(rows.map(r => r.opp_owner_name).filter(Boolean))].map(ae => (
                                      <span key={ae} className="text-gray-500 bg-gray-50 border border-gray-200 rounded px-1 py-0" style={{fontSize:'9px'}}>&#128100; {ae}</span>
                                    ))}
                                  </div>
                                </div>
                                <span className="font-700 text-blue-700 flex-shrink-0" style={{fontSize:'11px'}}>
                                  {rows.length} opp{rows.length!==1?'s':''} · {formatAcvK(accountACV*fxRate, currency)}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {rows.map((o, i) => (
                            <React.Fragment key={`${o.opportunity_id}_${i}`}>
                              <tr className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors ${drawerOpp?.opportunity_id===o.opportunity_id?'bg-blue-50':''}`}
                                onClick={() => setDrawerOpp(prev => prev?.opportunity_id===o.opportunity_id ? null : o)}>
                                <td className="px-2 py-1.5 max-w-[200px]">
                                  <div className="text-gray-500 truncate pl-3" title={o.opp_description} style={{fontSize:'10px'}}>
                                    ↳ {o.opp_description || o.opportunity_id}
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{o.opp_owner_name}</td>
                                <td className="px-2 py-1.5 max-w-[150px]">
                                  <div className="text-gray-700 truncate" style={{fontSize:'10px'}}>{o.sap_mastercode || '-'}</div>
                                  {o.sic_description && <div className="text-gray-400 truncate" style={{fontSize:'9px'}}>{o.sic_description}</div>}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-gray-700">{o.closing_qtr}</td>
                                <td className="px-2 py-1.5">
                                  <span className={`font-600 px-1.5 py-0.5 rounded ${o.drm_category==='Booked/Won'?'bg-green-100 text-green-700':o.drm_category==='Upside'?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-600'}`} style={{fontSize:'10px'}}>{o.drm_category}</span>
                                </td>
                                <td className="px-2 py-1.5 max-w-[200px]">
                                  {o.is_basket && <span className="inline-block font-700 bg-purple-100 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 mb-1" style={{fontSize:'9px'}}>Basket ({o.solution_lines})</span>}
                                  <div className="flex flex-wrap gap-0.5">
                                    {((o.solutions_l2||[]).length>0 ? o.solutions_l2 : o.solutions_l1||[]).map(s => (
                                      <span key={s} className="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1 py-0.5 truncate max-w-[150px]" title={s} style={{fontSize:'9px'}}>{s}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 max-w-[200px]">
                                  {(() => {
                                    const all = [...(o.suggestions||[]), ...(extraSugs[o.sap_mastercode]||[]).map(s=>({label:s,priority:3}))]
                                    if (!all.length) return <span style={{fontSize:'9px',color:'#9ca3af'}}>-</span>
                                    return (
                                      <div className="flex flex-col gap-0.5">
                                        {all.filter(g=>g.priority===1).map(g => <span key={g.label} className="flex items-center gap-0.5 bg-orange-100 text-orange-800 border border-orange-300 rounded px-1 py-0.5" style={{fontSize:'9px'}}><span className="font-700 bg-orange-600 text-white rounded px-0.5" style={{fontSize:'8px'}}>P1</span>{g.label}</span>)}
                                        {all.filter(g=>g.priority===2).map(g => <span key={g.label} className="flex items-center gap-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded px-1 py-0.5" style={{fontSize:'9px'}}><span className="font-700 bg-amber-400 text-white rounded px-0.5" style={{fontSize:'8px'}}>P2</span>{g.label}</span>)}
                                        {all.filter(g=>g.priority===3).map(g => <span key={g.label} className="flex items-center gap-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded px-1 py-0.5" style={{fontSize:'9px'}}><span className="font-700 bg-gray-300 text-gray-700 rounded px-0.5" style={{fontSize:'8px'}}>P3</span>{g.label}</span>)}
                                      </div>
                                    )
                                  })()}
                                </td>
                                <td className="px-2 py-1.5 font-700 text-blue-700 whitespace-nowrap">
                                  {o.acv_total_opp ? formatAcvK(o.acv_total_opp*fxRate) : '-'}
                                </td>
                                <td className="px-2 py-1.5">
                                  {o.engagement_type && <span className={`px-1.5 py-0.5 rounded ${o.engagement_type==='Digital'?'bg-blue-50 text-blue-700':o.engagement_type==='Field'?'bg-purple-50 text-purple-700':'bg-gray-100 text-gray-500'}`} style={{fontSize:'9px'}}>{o.engagement_type}</span>}
                                </td>
                                <td className="px-2 py-1.5 text-gray-600 max-w-[130px] truncate" title={o.vat_dh}>{o.vat_dh || '-'}</td>
                              </tr>
                              {/* Inline panel (Change 3) — appears below clicked row */}
                              {drawerOpp?.opportunity_id === o.opportunity_id && (
                                <tr>
                                  <td colSpan={10} className="p-0">
                                    <ContactsDrawerInline opp={o} onClose={() => setDrawerOpp(null)} />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}
      </> /* end territory tab */}

      {activeTab === 'industry' && <IndustryPropensityTab />}

      {activeTab === 'audience' && (
        <AudienceTab
          selAEs={selAEs} selFLSMs={selFLSMs} selRegions={selRegions} selReg4={selReg4}
          selQtrs={selQtrs} selISS={selISS} selDRM={selDRM}
        />
      )}

      {/* Email Modal */}
      {emailModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setEmailModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-[480px] p-6">
            <h3 className="font-700 text-gray-900 text-base mb-1">✉ Send Review Summary</h3>
            <p className="text-xs text-gray-500 mb-4">Sends a summary email with {opps.length} opportunities, SAP suggestions and identified competitors.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-600 text-gray-600 block mb-1">To *</label>
                <input value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="email@company.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-600 text-gray-600 block mb-1">CC (optional)</label>
                <input value={emailCc} onChange={e=>setEmailCc(e.target.value)} placeholder="cc@company.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setEmailModal(false)} className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSendEmail} disabled={!emailTo.trim()||sending}
                className="text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50">
                {sending ? 'Sending...' : '✉ Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
