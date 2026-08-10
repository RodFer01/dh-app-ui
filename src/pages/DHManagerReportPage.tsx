// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { EChart } from '../components/EChart'
import { DataTable } from '../components/DataTable'
import { PipelineFilterBar } from '../components/PipelineFilterBar'
import { usePipelineFilters } from '../lib/usePipelineFilters'
import { useAuth } from '../context/AuthContext'
import { formatAcvK, acvCol } from '../lib/utils'
import { exportToExcel } from '../lib/exportExcel'
import { ExcelDownloadButton } from '../components/ExcelDownloadButton'
import { Download } from 'lucide-react'
import { oppIdCol } from '../components/OppIdCol'
import type { ColDef } from 'ag-grid-community'

const QTRS = ['Q1','Q2','Q3','Q4']
const TEAM_COLORS: Record<string,string> = {
  'LoBs Team':      '#0070f2',
  'ERP Cloud BR':   '#256f3a',
  'ERP Cloud MCLA': '#e76500',
  'ERP MX MCLA IB': '#5d36ff',
}
const LOB_SUB_LABELS: Record<string,string> = {
  BAIP: 'BAIP (Data & AI + TF)',
  HCM:  'HCM',
  FSM:  'FSM (Procurement / Fieldglass)',
  CX:   'CX',
  SCM:  'SCM',
}
const GRID = '210px repeat(4,1fr) repeat(4,1fr) 130px 85px'

function AttPct({ pct }: { pct: number }) {
  const color = pct >= 100 ? '#256f3a' : pct >= 80 ? '#e76500' : '#bb0000'
  const bg    = pct >= 100 ? '#d4edda' : pct >= 80 ? '#fff3cd' : '#fde8e8'
  return <span style={{ padding:'2px 7px', borderRadius:8, fontSize:11, fontWeight:700, background:bg, color }}>{pct.toFixed(1)}%</span>
}

export function DHManagerReportPage() {
  const { currency, fxRate } = useAuth()
  const fx = fxRate

  const [excludeEnterprise, setExcludeEnterprise] = useState(false)
  const [includePurchase,   setIncludePurchase]   = useState(false)
  const [activeView, setActiveView] = useState<'attainment'|'pipeline'>('attainment')
  // Selected team/sub-team for opp filter
  const [selectedTeam, setSelectedTeam] = useState<{label:string;team:string;subTeam?:string}|null>(null)
  const [oppView, setOppView] = useState<'booked'|'active'>('booked')
  const { filters, debouncedParams, set: setFilter, clear: clearFilters } = usePipelineFilters()

  const { data: opts = {} } = useQuery({
    queryKey: ['pipeline-filters'],
    queryFn: () => api.get('/api/pipeline/filters').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const qParams = { exclude_enterprise: excludeEnterprise, include_purchase: includePurchase }

  // ── Attainment + sub-totals + opps (all in parallel) ─────────────────────
  const { data: attData } = useQuery({
    queryKey: ['mgr-att', excludeEnterprise, includePurchase],
    queryFn: () => api.get('/api/attainment/manager', { params: qParams }).then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const { data: lobSubs = {}, isFetched: lobSubsFetched } = useQuery({
    queryKey: ['mgr-lob-subs', excludeEnterprise, includePurchase],
    queryFn: () => api.get('/api/attainment/manager/subtotals', { params: qParams }).then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const { data: allOpps = [], isLoading: oppsLoading } = useQuery({
    queryKey: ['mgr-all-opps', excludeEnterprise, includePurchase],
    queryFn: () => api.get('/api/attainment/manager/all-opps', { params: qParams }).then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // Active pipeline — full pipeline rows (not just booked), using regular pipeline endpoint
  const { data: activePipelineRaw = [], isLoading: activeLoading } = useQuery({
    queryKey: ['mgr-active-pipeline', excludeEnterprise, includePurchase],
    queryFn: () => api.get('/api/pipeline', {
      params: {
        deduplicate: true,
        limit: 20000,
        drms: ['Committed','Probable','Upside'],
        ...(excludeEnterprise ? { exclude_neg: true } : {}),
      }
    }).then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const rows    = attData?.rows ?? []
  const grand   = attData?.grand ?? {}
  const totalBooked = rows.reduce((s:number,r:any) => s + r.booked_acv, 0)
  const totalQuota  = rows.reduce((s:number,r:any) => s + r.quota_acv, 0)

  // Team names by area for active pipeline filtering
  const ERP_TEAM_MEMBERS: Record<string, string[]> = {
    'ERP Cloud BR':   ['Igor Costa','Julio Biancalana','Monica Carnevale','Karin Castro','Juliano Romanato','Debora Mattos','Otilia Batistella','Felipe Gutieri','Tiago Garcia'],
    'ERP Cloud MCLA': ['Carolina Montes','Caterina Parolini','Fabian Rendon','Guillermo Coccioli','Luis Gabriel Escobedo','Maria Morales','Martha Juliana Sales','Milagros Mantella','Nayla Bulens','Pablo Llanes'],
    'ERP MX MCLA IB': ['Carlos Flores','Edgardo Martinez','Fabiola Ramos','Irma Sanchez','Jorge Aranda','Karla Olvera','Monica Ormea','Paola Romero','Rosa Carreno','William Moreno'],
    'LoBs Team':      ['Christian Barrios','Marcelo Ferreira Rossi de Viveiros','Mariane Pacheco','Matias Gomez','Lucas Suassuna','Alison Ferreira','Catalina Clopatofsky','Viviana Ramirez','Cesar Berrios','John Tu','Maria Rosario Sebastian','Alex Santili','Natalia Torres'],
  }

  // ── Filter opps by selected team ─────────────────────────────────────────
  const filteredOpps = useMemo(() => {
    const source = oppView === 'booked' ? allOpps : activePipelineRaw

    if (!selectedTeam) return source

    if (oppView === 'booked') {
      // Booked opps have 'team' field from all-opps endpoint
      if (selectedTeam.subTeam) {
        return source.filter((r:any) => (r.team || '').startsWith(selectedTeam.subTeam))
      }
      return source.filter((r:any) => {
        const t = r.team || ''
        if (selectedTeam.team === 'LoBs Team') return t.includes('LoBs') || ['BAIP','HCM','FSM','CX','SCM'].some(s => t.startsWith(s))
        return t === selectedTeam.team
      })
    } else {
      // Active pipeline rows — filter by vat_dh containing any team member name
      const members = ERP_TEAM_MEMBERS[selectedTeam.team] || []
      if (selectedTeam.subTeam) {
        // Sub-team members by sub-team key
        const subMembers: Record<string,string[]> = {
          BAIP: ['Christian Barrios','Marcelo Ferreira Rossi de Viveiros','Mariane Pacheco','Matias Gomez'],
          HCM:  ['Cesar Berrios','John Tu','Maria Rosario Sebastian'],
          FSM:  ['Alison Ferreira','Catalina Clopatofsky','Viviana Ramirez'],
          CX:   ['Lucas Suassuna'],
          SCM:  ['Alex Santili','Natalia Torres'],
        }
        const subs = subMembers[selectedTeam.subTeam] || []
        return source.filter((r:any) => subs.some(m => (r.vat_dh||'').includes(m) || (r.vat_full||'').includes(m)))
      }
      return source.filter((r:any) => members.some(m => (r.vat_dh||'').includes(m) || (r.vat_full||'').includes(m)))
    }
  }, [allOpps, activePipelineRaw, selectedTeam, oppView])

  // ── Pipeline charts ───────────────────────────────────────────────────────
  const pipelineParams = { ...debouncedParams, deduplicate: true, limit: 10000 }
  const { data: bookedRows = [] } = useQuery({
    queryKey: ['mgr-booked', pipelineParams, qParams],
    queryFn: () => api.get('/api/pipeline', { params: { ...pipelineParams, drms: ['Booked/Won'] } }).then(r => r.data),
    staleTime: 2 * 60_000,
  })

  function aggBy(field: string) {
    const m: Record<string,number> = {}
    for (const r of bookedRows) {
      const k = r[field] || '—'
      m[k] = (m[k]||0) + Number(r.acv_total_opp||0)*fx
    }
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12)
      .map(([label,value]) => ({label, value:+(value/1000).toFixed(1)}))
  }
  const byGeo     = useMemo(() => aggBy('region_lvl3'),      [bookedRows,fx])
  const byLob     = useMemo(() => aggBy('solution_area_l1'), [bookedRows,fx])
  const byIss     = useMemo(() => aggBy('iss_group_text'),    [bookedRows,fx])
  const byOwner   = useMemo(() => aggBy('opp_owner_name'),   [bookedRows,fx])
  const byPartner = useMemo(() => aggBy('channel_partner').filter(d=>d.label!=='—'), [bookedRows,fx])

  function hbarOpt(title:string, data:any[], color='#0070f2') {
    const s = [...data].sort((a,b)=>a.value-b.value)
    return {
      title:{text:title,textStyle:{fontSize:12,fontWeight:600,color:'#32363A'},top:8,left:12},
      grid:{left:16,right:70,top:44,bottom:16,containLabel:true},
      tooltip:{trigger:'axis',formatter:(p:any)=>`<b>${p[0]?.axisValue}</b>: <b>${p[0]?.value>=1000?(p[0].value/1000).toFixed(1)+'M':p[0]?.value+'K'}</b>`},
      xAxis:{type:'value',axisLabel:{formatter:(v:number)=>v>=1000?`${(v/1000).toFixed(0)}M`:`${v}K`,fontSize:10},splitLine:{lineStyle:{type:'dashed',color:'#f0f1f2'}}},
      yAxis:{type:'category',data:s.map(d=>d.label),axisLabel:{fontSize:10,color:'#32363A'}},
      series:[{type:'bar',data:s.map(d=>d.value),itemStyle:{color,borderRadius:[0,3,3,0]},
        label:{show:true,position:'right',fontSize:10,fontWeight:700,color:'#32363A',
          formatter:(p:any)=>p.value>=1000?`${(p.value/1000).toFixed(1)}M`:`${p.value}K`}}],
    }
  }

  // ── Opp table columns — same style as Opportunity List ───────────────────
  const oppCols: ColDef[] = [
    oppIdCol,
    { field:'team',             headerName:'Team',         width:130 },
    { field:'account_name',     headerName:'Account',      flex:1,minWidth:150 },
    { field:'opp_owner_name',   headerName:'Owner',        width:140 },
    { field:'solution_area_l1', headerName:'Solution L1',  width:160 },
    { field:'sub_solution_area_l2', headerName:'Sub-Solution', width:150 },
    { field:'closing_qtr',      headerName:'Qtr',          width:90 },
    { field:'region_lvl3',      headerName:'Region',       width:110 },
    { field:'iss_group_text',   headerName:'ISS Group',    width:110 },
    { field:'drm_category',     headerName:'DRM Cat',      width:120 },
    { field:'engagement_type',  headerName:'Engagement',   width:110,
      cellStyle:(p:any)=>{
        const v=(p.value||'').toLowerCase()
        if(v.includes('digital')) return{color:'#256f3a',fontWeight:700}
        if(v.includes('field'))   return{color:'#BB0000',fontWeight:700}
        if(v.includes('no eng'))  return{color:'#856404',fontWeight:700}
        return{}
      }},
    { field:'deal_qualification_decision', headerName:'Qual Decision', width:130 },
    { field:'team_members',     headerName:'Team Members', flex:1,minWidth:160 },
    { field:'vat_size',         headerName:'VAT Size',     width:80 },
    acvCol('acv_line',       fx, currency, `ACV Line (${currency})`,       130),
    acvCol('acv_recognized', fx, currency, `ACV Recognized (${currency})`, 150),
  ]

  // Active pipeline cols — uses pipeline fields directly
  const activeCols: ColDef[] = [
    oppIdCol,
    { field:'account_name',        headerName:'Account',       flex:1,minWidth:150 },
    { field:'opp_owner_name',      headerName:'Owner',         width:140 },
    { field:'solution_area_l1',    headerName:'Solution L1',   width:160 },
    { field:'sub_solution_area_l2',headerName:'Sub-Solution',  width:150 },
    { field:'drm_category',        headerName:'DRM Cat',       width:120 },
    { field:'opp_phase',           headerName:'Phase',         width:130 },
    { field:'fc_qualification',    headerName:'FC',            width:100 },
    { field:'closing_qtr',         headerName:'Qtr',           width:90 },
    { field:'region_lvl3',         headerName:'Region',        width:110 },
    { field:'iss_group_text',      headerName:'ISS Group',     width:110 },
    { field:'engagement_type',     headerName:'Engagement',    width:110,
      cellStyle:(p:any)=>{
        const v=(p.value||'').toLowerCase()
        if(v.includes('digital')) return{color:'#256f3a',fontWeight:700}
        if(v.includes('field'))   return{color:'#BB0000',fontWeight:700}
        if(v.includes('no eng'))  return{color:'#856404',fontWeight:700}
        return{}
      }},
    { field:'deal_qualification_decision', headerName:'Qual Decision', width:130 },
    { field:'deal_qualification_score',    headerName:'Score',         width:75 },
    { field:'vat_dh',              headerName:'Digital SA',    flex:1,minWidth:160 },
    { field:'vat_size',            headerName:'VAT Size',      width:80 },
    acvCol('acv_total_opp', fx, currency, `ACV Total (${currency})`, 140),
  ]

  // ── Handle team/sub-team click ───────────────────────────────────────────
  function handleTeamClick(label:string, team:string, subTeam?:string) {
    setSelectedTeam(prev =>
      prev?.label === label ? null : {label, team, subTeam}
    )
    // Scroll to opp table
    setTimeout(() => document.getElementById('mgr-opp-table')?.scrollIntoView({behavior:'smooth'}), 100)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-sap-text">DH Manager Report</h2>
          <p className="text-[12px] text-sap-muted mt-0.5">Rodrigo Ribeiro Ferreira · LAC Solution Advisor Manager</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setExcludeEnterprise(e=>!e)}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${excludeEnterprise?'bg-sap-error text-white border-sap-error':'border-sap-border text-sap-muted hover:bg-sap-bg'}`}>
            {excludeEnterprise?'✕ No Enterprise':'≠ Excl. Enterprise'}
          </button>
          <button onClick={()=>setIncludePurchase(e=>!e)}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${includePurchase?'bg-[#256f3a] text-white border-[#256f3a]':'border-sap-border text-sap-muted hover:bg-sap-bg'}`}>
            {includePurchase?'✓ A-Purchase':'+ A-Purchase'}
          </button>
        </div>
      </div>
      <hr className="border-sap-border mb-4" />

      <div className="flex border-b border-sap-border mb-4">
        {([{k:'attainment',l:'📊 Attainment & Results'},{k:'pipeline',l:'🔍 Pipeline & Charts'}] as const).map(t=>(
          <button key={t.k} onClick={()=>setActiveView(t.k)}
            className={`px-5 py-2.5 text-[13px] font-semibold border-b-2 transition ${activeView===t.k?'border-sap-blue text-sap-blue':'border-transparent text-sap-muted hover:text-sap-text'}`}>{t.l}
          </button>
        ))}
      </div>

      {/* ════ ATTAINMENT TAB ════ */}
      {activeView === 'attainment' && (
        <div>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <KpiCard label="Total Booked ACV"  value={formatAcvK(totalBooked*fx,currency)} color="green"
              sub={`${rows.reduce((s:number,r:any)=>s+r.booked_deals,0)} opps`} />
            <KpiCard label="Total Quota"       value={formatAcvK(totalQuota*fx,currency)} />
            <KpiCard label="Grand Attainment"  value={`${grand.attainment_pct?.toFixed(1)??'—'}%`}
              color={(grand.attainment_pct||0)>=100?'green':(grand.attainment_pct||0)>=80?'orange':'red'} />
            <KpiCard label="Active Pipeline"   value={formatAcvK(rows.reduce((s:number,r:any)=>s+r.active_acv,0)*fx,currency)}
              sub={`${rows.reduce((s:number,r:any)=>s+r.active_deals,0).toLocaleString()} opps`} color="blue" />
          </div>

          {/* Attainment table */}
          <div className="card overflow-hidden mb-2">
            {/* Header */}
            <div className="bg-sap-blue px-4 py-2.5 grid text-[11px] font-bold text-white uppercase tracking-wide"
              style={{gridTemplateColumns:GRID}}>
              <div>Manager / Team</div>
              {QTRS.map(q=><div key={q} className="text-center">{q}</div>)}
              {QTRS.map(q=><div key={q+'p'} className="text-center">% {q}</div>)}
              <div className="text-right">Full Year</div>
              <div className="text-center">Att%</div>
            </div>

            {/* Grand Total */}
            <div className="px-4 py-2.5 grid text-[12px] font-bold bg-[#E8F0FA] border-b-2 border-sap-blue"
              style={{gridTemplateColumns:GRID}}>
              <div className="flex items-center gap-2">
                <span className="text-sap-blue font-bold">GRAND TOTAL</span>
                {grand.attainment_pct!=null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{background:grand.attainment_pct>=100?'#d4edda':'#fff3cd',color:grand.attainment_pct>=100?'#256f3a':'#856404'}}>
                    {grand.attainment_pct?.toFixed(1)}% YTD
                  </span>
                )}
              </div>
              {QTRS.map(q=>{
                const qAcv=rows.flatMap((r:any)=>r.breakdown||[]).filter((b:any)=>b.quarter===q).reduce((s:number,b:any)=>s+b.booked_acv,0)
                return <div key={q} className="text-center text-sap-blue">{formatAcvK(qAcv*fx,currency)}</div>
              })}
              {QTRS.map(q=>{
                const qAcv=rows.flatMap((r:any)=>r.breakdown||[]).filter((b:any)=>b.quarter===q).reduce((s:number,b:any)=>s+b.booked_acv,0)
                const qQ  =rows.flatMap((r:any)=>r.breakdown||[]).filter((b:any)=>b.quarter===q).reduce((s:number,b:any)=>s+b.quota_acv,0)
                return <div key={q+'p'} className="text-center"><AttPct pct={qQ>0?qAcv/qQ*100:0}/></div>
              })}
              <div className="text-right text-sap-blue">{formatAcvK(totalBooked*fx,currency)}</div>
              <div className="text-center"><AttPct pct={grand.attainment_pct||0}/></div>
            </div>

            {/* Manager rows */}
            {rows.map((r:any, idx:number) => {
              const color   = TEAM_COLORS[r.label]||'#32363A'
              const isLob   = r.label === 'LoBs Team'
              const isSelected = selectedTeam?.label === r.label && !selectedTeam?.subTeam
              return (
                <div key={r.inumber}>
                  {/* Manager row — clickable */}
                  <div
                    className={`px-4 py-2.5 grid text-[12px] border-b border-sap-border cursor-pointer transition ${
                      isSelected ? 'bg-[#E3F0FF] border-l-4 border-l-sap-blue' : idx%2===0?'bg-white hover:bg-[#f5f8ff]':'bg-[#fafbfc] hover:bg-[#f5f8ff]'}`}
                    style={{gridTemplateColumns:GRID}}
                    onClick={()=>handleTeamClick(r.label, r.label)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:color}}/>
                      <div>
                        <div className="font-semibold" style={{color}}>{r.label}</div>
                        <div className="text-[10px] text-sap-muted">{r.name}</div>
                      </div>
                      <span className="text-[9px] text-sap-subtle ml-auto">click to filter ↓</span>
                    </div>
                    {QTRS.map(q=>{
                      const bd=(r.breakdown||[]).find((b:any)=>b.quarter===q)
                      return <div key={q} className="text-center font-semibold" style={{color}}>{bd?formatAcvK(bd.booked_acv*fx,currency):'—'}</div>
                    })}
                    {QTRS.map(q=>{
                      const bd=(r.breakdown||[]).find((b:any)=>b.quarter===q)
                      return <div key={q+'p'} className="text-center">{bd?<AttPct pct={bd.attainment_pct}/>:<span className="text-sap-subtle">—</span>}</div>
                    })}
                    <div className="text-right font-bold" style={{color}}>{formatAcvK(r.booked_acv*fx,currency)}</div>
                    <div className="text-center"><AttPct pct={r.attainment_pct}/></div>
                  </div>

                  {/* LoB sub-team rows — always visible with values */}
                  {isLob && Object.entries(LOB_SUB_LABELS).map(([st, stLabel])=>{
                    const stData    = (lobSubs as any)[st] || {}
                    const fy        = stData['Full Year'] || {acv:0,deals:0}
                    const isSubSel  = selectedTeam?.subTeam === st
                    return (
                      <div key={st}
                        className={`px-4 py-1.5 grid text-[11px] border-b border-sap-border cursor-pointer transition ${
                          isSubSel ? 'bg-[#D6E8FF] border-l-4 border-l-sap-blue' : 'bg-[#F4F7FF] hover:bg-[#EBF3FF]'}`}
                        style={{gridTemplateColumns:GRID}}
                        onClick={()=>handleTeamClick(st, 'LoBs Team', st)}
                      >
                        <div className="pl-5 flex items-center gap-1.5">
                          <span className="text-sap-muted text-[10px]">↳</span>
                          <span className="font-semibold text-sap-blue">{stLabel}</span>
                          {fy.deals>0 && <span className="text-[9px] text-sap-subtle">({fy.deals} opps)</span>}
                        </div>
                        {QTRS.map(q=>{
                          const qd=(stData[q]||{acv:0})
                          return <div key={q} className="text-center text-sap-blue">
                            {qd.acv>0?formatAcvK(qd.acv*fx,currency):'—'}
                          </div>
                        })}
                        {QTRS.map(q=><div key={q+'p'}/>)}
                        <div className="text-right text-sap-blue font-semibold">
                          {fy.acv>0?formatAcvK(fy.acv*fx,currency):'—'}
                        </div>
                        <div/>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Quota row */}
            <div className="px-4 py-2 grid text-[11px] bg-[#f5f6f7] text-sap-muted border-t border-sap-border"
              style={{gridTemplateColumns:GRID}}>
              <div className="font-semibold uppercase tracking-wide">Quota</div>
              {QTRS.map(q=>{
                const qTotal=rows.reduce((s:number,r:any)=>{const bd=(r.breakdown||[]).find((b:any)=>b.quarter===q);return s+(bd?.quota_acv||0)},0)
                return <div key={q} className="text-center">{formatAcvK(qTotal*fx,currency)}</div>
              })}
              {QTRS.map(q=><div key={q+'p'}/>)}
              <div className="text-right">{formatAcvK(totalQuota*fx,currency)}</div>
              <div/>
            </div>
          </div>

          {/* Opportunities table */}
          <div id="mgr-opp-table" className="mt-6">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div>
                <SectionLabel>
                  {selectedTeam ? `Opportunities — ${selectedTeam.label}` : 'Opportunities — All Teams'}
                </SectionLabel>
                <p className="text-xs text-sap-subtle">
                  {filteredOpps.length} opps
                  {oppView==='booked'
                    ? ` · ${formatAcvK(filteredOpps.reduce((s:number,r:any)=>s+(r.acv_recognized||0)*fx,0),currency)} recognized`
                    : ` · ${formatAcvK(filteredOpps.reduce((s:number,r:any)=>s+(Number(r.acv_total_opp)||0)*fx,0),currency)} ACV`
                  }
                  {selectedTeam && <button onClick={()=>setSelectedTeam(null)} className="ml-2 text-sap-blue hover:underline">✕ Show all</button>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle Booked / Active Pipeline */}
                <div className="flex bg-sap-bg rounded-lg p-1 border border-sap-border">
                  {([
                    {k:'booked' as const, label:'✓ Booked/Won'},
                    {k:'active' as const, label:'📊 Active Pipeline'},
                  ]).map(v=>(
                    <button key={v.k} onClick={()=>setOppView(v.k)}
                      className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition ${
                        oppView===v.k ? 'bg-white text-sap-blue shadow-sm border border-sap-border' : 'text-sap-muted hover:text-sap-text'
                      }`}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <ExcelDownloadButton
                  rows={filteredOpps}
                  cols={oppView==='booked'?oppCols:activeCols}
                  defaultFilename={oppView==='booked'?'mgr_booked_opps.xlsx':'mgr_active_opps.xlsx'}
                  sheetName={oppView==='booked'?'Booked Opps':'Active Pipeline'}
                  className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
                />
              </div>
            </div>
            {(oppView==='booked' ? oppsLoading : activeLoading)
              ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
              : <DataTable rows={filteredOpps} cols={oppView==='booked'?oppCols:activeCols} height={560}/>}
          </div>
        </div>
      )}

      {/* ════ PIPELINE TAB ════ */}
      {activeView === 'pipeline' && (
        <div>
          <PipelineFilterBar filters={filters} opts={opts} set={setFilter} clear={clearFilters}/>
          <SectionLabel>ACV Booked — By Dimension</SectionLabel>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <EChart height={300} option={hbarOpt(`ACV Booked by Region (${currency})`,     byGeo,   '#0070f2')}/>
            <EChart height={300} option={hbarOpt(`ACV Booked by Solution L1 (${currency})`, byLob,   '#256f3a')}/>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <EChart height={300} option={hbarOpt(`ACV Booked by ISS Group (${currency})`,  byIss,   '#e76500')}/>
            <EChart height={300} option={hbarOpt(`ACV Booked by Opp Owner (${currency})`,  byOwner, '#5d36ff')}/>
          </div>
          {byPartner.length>0 && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <EChart height={280} option={hbarOpt(`ACV by Channel Partner (${currency})`, byPartner,'#046c7a')}/>
              <div className="card p-4 flex items-center justify-center text-sap-muted text-[13px]">Use filters above to drill down</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
