// @ts-nocheck
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { EChart } from '../components/EChart'
import { useAuth } from '../context/AuthContext'
import { formatAcvK, formatPercent } from '../lib/utils'
import { Download } from 'lucide-react'
import { exportToExcel } from '../lib/exportExcel'

const ERP_AREAS = ['ERP Cloud BR', 'ERP Cloud MCLA', 'ERP MX MCLA IB']
const QTRS = ['Full Year', 'Q1', 'Q2', 'Q3', 'Q4']
const DATA_QTRS = ['Q1', 'Q2', 'Q3', 'Q4']
const QTR_DIST = { Q1: 0.13, Q2: 0.23, Q3: 0.22, Q4: 0.42 }

function pct(val, bg) {
  if (val >= 100) return '#d4edda'
  if (val >= 50)  return '#fff3cd'
  return '#fde8e8'
}

export function ERPTeamPage() {
  const { currency, fxRate } = useAuth()
  const [selAreas, setSelAreas] = useState(ERP_AREAS)
  const [excludeEnterprise, setExcludeEnterprise] = useState(false)
  const [includePurchase, setIncludePurchase] = useState(false)
  const [selectedSA, setSelectedSA] = useState(null)
  const [selQtrs, setSelQtrs] = useState(['Q1','Q2','Q3','Q4'])
  const toggleQtr = (q) => setSelQtrs(p => p.includes(q) ? (p.length>1 ? p.filter(x=>x!==q) : p) : [...p,q])
  const DISP_QTRS = DATA_QTRS.filter(q => selQtrs.includes(q))
  const toggle = (a) => setSelAreas(p => p.includes(a) ? p.filter(x=>x!==a) : [...p, a])

  // Fetch data for each quarter + full year in parallel
  const fullYear = useQuery({
    queryKey: ['att-erp-fy', selAreas, excludeEnterprise, includePurchase],
    queryFn: () => api.get('/api/attainment/erp', { params: { areas: selAreas, quarter: 'Full Year', exclude_enterprise: excludeEnterprise, include_purchase: includePurchase } }).then(r => r.data),
  })
  const qData = {}
  for (const q of DATA_QTRS) {
    qData[q] = useQuery({
      queryKey: ['att-erp', selAreas, q, excludeEnterprise, includePurchase],
      queryFn: () => api.get('/api/attainment/erp', { params: { areas: selAreas, quarter: q, exclude_enterprise: excludeEnterprise, include_purchase: includePurchase } }).then(r => r.data),
    })
  }

  const fyRows = fullYear.data || []
  const byInumber = {}
  fyRows.forEach(r => { byInumber[r.inumber] = r })
  DATA_QTRS.forEach(q => {
    ;(qData[q].data || []).forEach(r => {
      if (!byInumber[r.inumber]) byInumber[r.inumber] = r
      byInumber[r.inumber][`quota_${q}`]        = r.quota_acv
      byInumber[r.inumber][`booked_${q}`]       = r.booked_acv
      byInumber[r.inumber][`deals_quota_${q}`]  = r.quota_deals
      byInumber[r.inumber][`deals_booked_${q}`] = r.booked_deals
      byInumber[r.inumber][`att_${q}`]          = r.attainment_pct
      byInumber[r.inumber][`deals_att_${q}`]    = r.quota_deals > 0 ? +(r.booked_deals / r.quota_deals * 100).toFixed(1) : 0
      byInumber[r.inumber][`active_acv_${q}`]   = r.active_acv
      byInumber[r.inumber][`active_deals_${q}`] = r.active_deals
    })
  })

  const rows = Object.values(byInumber)

  // Group by area
  const byArea = {}
  rows.forEach(r => { (byArea[r.area] ??= []).push(r) })

  const fx = fxRate
  const teamTarget = fyRows.reduce((s,r) => s + (r.quota_acv||0), 0) * fx
  const teamBooked = fyRows.reduce((s,r) => s + (r.booked_acv||0), 0) * fx
  const teamAttain = teamTarget > 0 ? +((teamBooked/teamTarget)*100).toFixed(1) : 0

  // Chart
  const chartRows = [...fyRows].sort((a,b) => (a.attainment_pct??0)-(b.attainment_pct??0))
  const chartOpt = {
    title: { text: 'Attainment % by Advisor', textStyle:{fontSize:13,fontWeight:600} },
    grid: { left:16,right:80,top:40,bottom:16,containLabel:true },
    xAxis: { type:'value', max: Math.max(150, ...chartRows.map(r=>r.attainment_pct??0))+10 },
    yAxis: { type:'category', data:chartRows.map(r=>r.name) },
    series: [{
      type:'bar',
      data: chartRows.map(r => ({
        value: +(r.attainment_pct||0).toFixed(1),
        itemStyle:{ color: (r.attainment_pct||0)>=100?'#256f3a':'#0070f2' }
      })),
      label:{ show:true, position:'right', formatter: p=>`${p.value.toFixed(1)}%` }
    }],
    markLine:{ data:[{xAxis:100,lineStyle:{color:'#BB0000',type:'dashed',width:1.5}}] }
  }

  const thCls = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sap-muted border-b border-sap-border bg-[#f8f9fa] whitespace-nowrap sticky top-0"
  const tdCls = "px-3 py-2 text-[13px] text-sap-text border-b border-sap-border"
  const tdNum = "px-3 py-2 text-[13px] text-right border-b border-sap-border tabular-nums whitespace-nowrap"

  function AttCell({ val }) {
    const bg = val >= 100 ? '#d4edda' : val >= 50 ? '#fff3cd' : val > 0 ? '#fde8e8' : 'transparent'
    return <td className={tdNum} style={{ background: bg, fontWeight: val > 0 ? 600 : 400 }}>
      {val > 0 ? `${val.toFixed(0)}%` : '—'}
    </td>
  }

  function renderAreaTable(area, areaRows) {
    const totals = {
      quota_fy:   areaRows.reduce((s,r) => s+(r.quota_acv||0),0)*fx,
      booked_fy:  areaRows.reduce((s,r) => s+(r.booked_acv||0),0)*fx,
      active_acv: areaRows.reduce((s,r) => s+(r.active_acv||0),0)*fx,
      active_deals: areaRows.reduce((s,r) => s+(r.active_deals||0),0),
    }
    DATA_QTRS.forEach(q => {
      totals[`quota_${q}`]       = areaRows.reduce((s,r) => s+(r[`quota_${q}`]||0),0)*fx
      totals[`booked_${q}`]      = areaRows.reduce((s,r) => s+(r[`booked_${q}`]||0),0)*fx
      totals[`deals_quota_${q}`] = areaRows.reduce((s,r) => s+(r[`deals_quota_${q}`]||0),0)
      totals[`deals_booked_${q}`]= areaRows.reduce((s,r) => s+(r[`deals_booked_${q}`]||0),0)
      totals[`att_${q}`]         = totals[`quota_${q}`]>0 ? +(totals[`booked_${q}`]/totals[`quota_${q}`]*100).toFixed(1) : 0
      totals[`deals_att_${q}`]   = totals[`deals_quota_${q}`]>0 ? +(totals[`deals_booked_${q}`]/totals[`deals_quota_${q}`]*100).toFixed(1) : 0
    })
    const att_fy = totals.quota_fy>0 ? +(totals.booked_fy/totals.quota_fy*100).toFixed(1) : 0

    return (
      <div key={area} className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-semibold text-sap-text">{area}</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${att_fy>=100?'bg-[#d4edda] text-[#256f3a]':att_fy>=50?'bg-[#fff3cd] text-[#856404]':'bg-[#fde8e8] text-[#aa0808]'}`}>
            {att_fy.toFixed(1)}% YTD
          </span>
        </div>

        {/* ACV Table */}
        <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">ACV Attainment <span className="normal-case font-normal ml-1">— click an advisor row to see individual deals</span></p>
        <div className="overflow-x-auto rounded-xl border border-sap-border shadow-card mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls} rowSpan={2}>Sol. Advisor</th>
                {DISP_QTRS.map(q => (
                  <th key={q} className={`${thCls} text-center`} colSpan={5} style={{borderLeft:'2px solid #e1e2e6'}}>{q}</th>
                ))}
                <th className={`${thCls} text-center`} colSpan={2} style={{borderLeft:'2px solid #e1e2e6'}}>Total YTD</th>
                <th className={`${thCls} text-center bg-[#fffbe6]`} colSpan={2} style={{borderLeft:'2px solid #e76500'}}>Active Pipeline</th>
              </tr>
              <tr>
                {DISP_QTRS.map(q => (<>
                  <th key={`${q}-quota`} className={thCls} style={{borderLeft:'2px solid #e1e2e6'}}>Quota</th>
                  <th key={`${q}-booked`} className={thCls}>ACV Booked</th>
                  <th key={`${q}-att`} className={thCls}>% Qtr</th>
                  <th key={`${q}-aacv`} className={`${thCls} bg-[#fffbe6]`}>Active ACV</th>
                  <th key={`${q}-adls`} className={`${thCls} bg-[#fffbe6]`}># Opps</th>
                </>))}
                <th className={thCls} style={{borderLeft:'2px solid #e1e2e6'}}>Quota</th>
                <th className={thCls}>ACV Booked</th>
                <th className={`${thCls} bg-[#fffbe6]`} style={{borderLeft:'2px solid #e76500'}}>ACV (Commit+Prob+Up)</th>
                <th className={`${thCls} bg-[#fffbe6]`}># Opps</th>
              </tr>
            </thead>
            <tbody>
              {areaRows.sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                <tr key={r.inumber}
                  className={`hover:bg-[#f0f4ff] transition-colors cursor-pointer ${selectedSA?.inumber === r.inumber ? 'bg-[#e8f0fe]' : ''}`}
                  onClick={() => setSelectedSA(selectedSA?.inumber === r.inumber ? null : r)}
                >
                  <td className={tdCls}>{r.name}</td>
                  {DISP_QTRS.map(q => (<>
                    <td key={`${q}-q`} className={tdNum} style={{borderLeft:'2px solid #e1e2e6'}}>{formatAcvK((r[`quota_${q}`]||0)*fx, currency)}</td>
                    <td key={`${q}-b`} className={tdNum}>{formatAcvK((r[`booked_${q}`]||0)*fx, currency)}</td>
                    <AttCell key={`${q}-a`} val={r[`att_${q}`]||0} />
                    <td key={`${q}-aacv`} className={`${tdNum} bg-[#fffde8]`}>{formatAcvK((r[`active_acv_${q}`]||0)*fx,currency)}</td>
                    <td key={`${q}-adls`} className={`${tdNum} bg-[#fffde8]`}>{(r[`active_deals_${q}`]||0).toLocaleString()}</td>
                  </>))}
                  <td className={tdNum} style={{borderLeft:'2px solid #e1e2e6'}}>{formatAcvK((r.quota_acv||0)*fx, currency)}</td>
                  <td className={tdNum}>{formatAcvK((r.booked_acv||0)*fx, currency)}</td>
                  <td className={`${tdNum} bg-[#fffde8]`} style={{borderLeft:'2px solid #e76500'}}>{formatAcvK((r.active_acv||0)*fx, currency)}</td>
                  <td className={`${tdNum} bg-[#fffde8]`}>{(r.active_deals||0).toLocaleString()}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="font-bold bg-[#f8f9fa]">
                <td className={`${tdCls} font-bold`}>Total</td>
                {DISP_QTRS.map(q => (<>
                  <td key={`${q}-tq`} className={`${tdNum} font-bold`} style={{borderLeft:'2px solid #e1e2e6'}}>{formatAcvK(totals[`quota_${q}`], currency)}</td>
                  <td key={`${q}-tb`} className={`${tdNum} font-bold`}>{formatAcvK(totals[`booked_${q}`], currency)}</td>
                  <AttCell key={`${q}-ta`} val={totals[`att_${q}`]||0} />
                  <td key={`${q}-taacv`} className={`${tdNum} font-bold bg-[#fff8d6]`}>{formatAcvK(totals[`active_acv_${q}`]||0,currency)}</td>
                  <td key={`${q}-tadls`} className={`${tdNum} font-bold bg-[#fff8d6]`}>{(totals[`active_deals_${q}`]||0).toLocaleString()}</td>
                </>))}
                <td className={`${tdNum} font-bold`} style={{borderLeft:'2px solid #e1e2e6'}}>{formatAcvK(totals.quota_fy, currency)}</td>
                <td className={`${tdNum} font-bold`}>{formatAcvK(totals.booked_fy, currency)}</td>
                <td className={`${tdNum} font-bold bg-[#fff8d6]`} style={{borderLeft:'2px solid #e76500'}}>{formatAcvK(totals.active_acv, currency)}</td>
                <td className={`${tdNum} font-bold bg-[#fff8d6]`}>{totals.active_deals.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Deals Table */}
        <p className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Deals Attainment</p>
        <div className="overflow-x-auto rounded-xl border border-sap-border shadow-card mb-2">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls} rowSpan={2}>Sol. Advisor</th>
                {DISP_QTRS.map(q => (
                  <th key={q} className={`${thCls} text-center`} colSpan={5} style={{borderLeft:'2px solid #e1e2e6'}}>{q}</th>
                ))}
                <th className={`${thCls} text-center`} colSpan={2} style={{borderLeft:'2px solid #e1e2e6'}}>Total</th>
              </tr>
              <tr>
                {DISP_QTRS.map(q => (<>
                  <th key={`${q}-dq`} className={thCls} style={{borderLeft:'2px solid #e1e2e6'}}>Quota</th>
                  <th key={`${q}-db`} className={thCls}>Booked</th>
                  <th key={`${q}-da`} className={thCls}>%</th>
                </>))}
                <th className={thCls} style={{borderLeft:'2px solid #e1e2e6'}}>Quota</th>
                <th className={thCls}>Booked</th>
              </tr>
            </thead>
            <tbody>
              {areaRows.sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                <tr key={r.inumber}
                  className={`hover:bg-[#f0f4ff] transition-colors cursor-pointer ${selectedSA?.inumber === r.inumber ? 'bg-[#e8f0fe]' : ''}`}
                  onClick={() => setSelectedSA(selectedSA?.inumber === r.inumber ? null : r)}
                >
                  <td className={tdCls}>{r.name}</td>
                  {DISP_QTRS.map(q => (<>
                    <td key={`${q}-dq`} className={tdNum} style={{borderLeft:'2px solid #e1e2e6'}}>{r[`deals_quota_${q}`]||0}</td>
                    <td key={`${q}-db`} className={tdNum}>{r[`deals_booked_${q}`]||0}</td>
                    <AttCell key={`${q}-da`} val={r[`deals_att_${q}`]||0} />
                  </>))}
                  <td className={tdNum} style={{borderLeft:'2px solid #e1e2e6'}}>{r.quota_deals||0}</td>
                  <td className={tdNum}>{r.booked_deals||0}</td>
                </tr>
              ))}
              <tr className="font-bold bg-[#f8f9fa]">
                <td className={`${tdCls} font-bold`}>Total</td>
                {DISP_QTRS.map(q => (<>
                  <td key={`${q}-tdq`} className={`${tdNum} font-bold`} style={{borderLeft:'2px solid #e1e2e6'}}>{totals[`deals_quota_${q}`]||0}</td>
                  <td key={`${q}-tdb`} className={`${tdNum} font-bold`}>{totals[`deals_booked_${q}`]||0}</td>
                  <AttCell key={`${q}-tda`} val={totals[`deals_att_${q}`]||0} />
                </>))}
                <td className={`${tdNum} font-bold`} style={{borderLeft:'2px solid #e1e2e6'}}>{areaRows.reduce((s,r)=>s+(r.quota_deals||0),0)}</td>
                <td className={`${tdNum} font-bold`}>{areaRows.reduce((s,r)=>s+(r.booked_deals||0),0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-sap-text mb-1">ERP Team Dashboard</h2>
      <hr className="border-sap-border mb-4" />

      {/* Filters */}
      <div className="card p-4 mb-4 flex items-center gap-6 flex-wrap">
        <div>
          <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Team / Area</div>
          <div className="flex gap-2">
            {ERP_AREAS.map(a => (
              <button key={a} onClick={() => toggle(a)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition ${selAreas.includes(a)?'bg-sap-blue text-white border-sap-blue':'border-sap-border text-sap-muted hover:bg-sap-bg'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Quarter</div>
          <div className="flex gap-2">
            {DATA_QTRS.map(q => (
              <button key={q} onClick={() => toggleQtr(q)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition ${selQtrs.includes(q) ? 'bg-sap-blue text-white border-sap-blue' : 'border-sap-border text-sap-muted hover:bg-sap-bg'}`}>
                {q}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Enterprise Opps</div>
          <button
            onClick={() => setExcludeEnterprise(e => !e)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${excludeEnterprise ? 'bg-[#aa0808] text-white border-[#aa0808]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'}`}
          >
            {excludeEnterprise ? '✕ Enterprise excluded' : '+ Include Enterprise'}
          </button>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">A-Purchase</div>
        <button
            onClick={() => setIncludePurchase(e => !e)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${includePurchase ? 'bg-[#256f3a] text-white border-[#256f3a]' : 'border-sap-border text-sap-muted hover:bg-sap-bg'}`}
          >
            {includePurchase ? '✓ A-Purchase included' : '+ Include A-Purchase'}
          </button>
        </div>

        {/* Download button */}
        <div className="ml-auto">
          <div className="text-[10px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">Export</div>
          {QTRS.map(q => (
            <button key={q}
              onClick={() => {
                const token = localStorage.getItem('dh_token')
                const areas_qs = selAreas.map(a => `areas=${encodeURIComponent(a)}`).join('&')
                const url = `/api/attainment/deals-export?team_type=erp&quarter=${encodeURIComponent(q)}&exclude_enterprise=${excludeEnterprise}&include_purchase=${includePurchase}&${areas_qs}`
                fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                  .then(r => r.blob())
                  .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `deals_booked_erp_${q.replace(' ','_')}.xlsx`; a.click() })
              }}
              className="mr-1 mb-1 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border border-sap-border rounded-lg hover:bg-sap-bg transition text-sap-muted"
            >
              <Download size={11} /> {q}
            </button>
          ))}
        </div>
      </div>

      {/* Team KPIs */}
      <SectionLabel>Team Summary</SectionLabel>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label={`Annual Quota K (${currency})`}  value={formatAcvK(teamTarget, currency)} />
        <KpiCard label={`Booked K (${currency})`}        value={formatAcvK(teamBooked, currency)} color="green" />
        <KpiCard label="Attainment %"                    value={`${teamAttain.toFixed(1)}%`} color={teamAttain>=100?'green':'blue'} />
      </div>

      {/* Attainment chart */}
      {fyRows.length > 0 && <>
        <SectionLabel>Attainment % by Advisor</SectionLabel>
        <EChart option={chartOpt} height={Math.max(280, fyRows.length*36)} className="mb-6" />
      </>}


      {/* Grand Total across all areas */}
      {!fullYear.isLoading && rows.length > 0 && (() => {
        const grandTotals = {
          quota_fy:     rows.reduce((s,r)=>s+(r.quota_acv||0),0)*fx,
          booked_fy:    rows.reduce((s,r)=>s+(r.booked_acv||0),0)*fx,
          active_acv:   rows.reduce((s,r)=>s+(r.active_acv||0),0)*fx,
          active_deals: rows.reduce((s,r)=>s+(r.active_deals||0),0),
        }
        DATA_QTRS.forEach(q => {
          grandTotals[`quota_${q}`]  = rows.reduce((s,r)=>s+(r[`quota_${q}`]||0),0)*fx
          grandTotals[`booked_${q}`] = rows.reduce((s,r)=>s+(r[`booked_${q}`]||0),0)*fx
          grandTotals[`att_${q}`]    = grandTotals[`quota_${q}`]>0 ? +(grandTotals[`booked_${q}`]/grandTotals[`quota_${q}`]*100).toFixed(1) : 0
        })
        const grandAtt = grandTotals.quota_fy>0 ? +(grandTotals.booked_fy/grandTotals.quota_fy*100).toFixed(1) : 0
        return (
          <div className="rounded-xl border-2 border-sap-blue overflow-hidden shadow-card mb-8">
            <div className="px-4 py-2 bg-sap-blue text-white text-[11px] font-bold uppercase tracking-wide flex items-center justify-between">
              <span>Grand Total — All Areas</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${grandAtt>=100?'bg-[#d4edda] text-[#256f3a]':grandAtt>=50?'bg-[#fff3cd] text-[#856404]':'bg-[#fde8e8] text-[#aa0808]'}`}>
                {grandAtt.toFixed(1)}% YTD
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white">
                <thead>
                  <tr>
                    <th className={thCls} rowSpan={2}>Metric</th>
                    {DISP_QTRS.map(q=>(
                      <th key={q} className={`${thCls} text-center`} colSpan={5} style={{borderLeft:'2px solid #e1e2e6'}}>{q}</th>
                    ))}
                    <th className={`${thCls} text-center`} colSpan={2} style={{borderLeft:'2px solid #e1e2e6'}}>Total YTD</th>
                    <th className={`${thCls} text-center bg-[#fffbe6]`} colSpan={2} style={{borderLeft:'2px solid #e76500'}}>Active Pipeline</th>
                  </tr>
                  <tr>
                    {DISP_QTRS.map(q=>(<>
                      <th key={`${q}-q`} className={thCls} style={{borderLeft:'2px solid #e1e2e6'}}>Quota</th>
                      <th key={`${q}-b`} className={thCls}>ACV Attributed K</th>
                      <th key={`${q}-a`} className={thCls}>% Qtr</th>
                      <th key={`${q}-gaaacv`} className={`${thCls} bg-[#fffbe6]`}>Active ACV</th>
                      <th key={`${q}-gaadls`} className={`${thCls} bg-[#fffbe6]`}># Opps</th>
                    </>))}
                    <th className={thCls} style={{borderLeft:'2px solid #e1e2e6'}}>Quota</th>
                    <th className={thCls}>ACV Attributed K</th>
                    <th className={`${thCls} bg-[#fffbe6]`} style={{borderLeft:'2px solid #e76500'}}>ACV (Commit+Prob+Up)</th>
                    <th className={`${thCls} bg-[#fffbe6]`}># Opps</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[#f0f4ff] font-bold">
                    <td className={tdCls + " font-bold text-sap-blue"}>All Teams</td>
                    {DISP_QTRS.map(q=>(<>
                      <td key={`${q}-q`} className={`${tdNum} font-bold`} style={{borderLeft:'2px solid #e1e2e6'}}>{formatAcvK(grandTotals[`quota_${q}`],currency)}</td>
                      <td key={`${q}-b`} className={`${tdNum} font-bold text-sap-blue`}>{formatAcvK(grandTotals[`booked_${q}`],currency)}</td>
                      <AttCell key={`${q}-a`} val={grandTotals[`att_${q}`]||0} />
                      <td key={`${q}-gaacv`} className={`${tdNum} font-bold bg-[#fff8d6]`}>{formatAcvK(grandTotals[`active_acv_${q}`]||0,currency)}</td>
                      <td key={`${q}-gadls`} className={`${tdNum} font-bold bg-[#fff8d6]`}>{(grandTotals[`active_deals_${q}`]||0).toLocaleString()}</td>
                    </>))}
                    <td className={`${tdNum} font-bold`} style={{borderLeft:'2px solid #e1e2e6'}}>{formatAcvK(grandTotals.quota_fy,currency)}</td>
                    <td className={`${tdNum} font-bold text-sap-blue`}>{formatAcvK(grandTotals.booked_fy,currency)}</td>
                    <td className={`${tdNum} font-bold bg-[#fff8d6]`} style={{borderLeft:'2px solid #e76500'}}>{formatAcvK(grandTotals.active_acv,currency)}</td>
                    <td className={`${tdNum} font-bold bg-[#fff8d6]`}>{grandTotals.active_deals.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Per-area tables */}
      {fullYear.isLoading
        ? <div className="text-sap-muted text-sm py-8 text-center">Loading…</div>
        : selAreas.map(area => {
            const areaRows = rows.filter(r => r.area === area)
            if (!areaRows.length) return null
            return renderAreaTable(area, areaRows)
          })
      }
      {/* ── Deals drill-down panel ── */}
      {selectedSA && (() => {
        const InlineDeals = () => {
          const { currency: cur, fxRate: rate } = useAuth()
          const [dealsData, setDealsData] = React.useState([])
          const [dealsLoading, setDealsLoading] = React.useState(true)
          React.useEffect(() => {
            if (!selectedSA?.inumber) return
            setDealsLoading(true)
            api.get('/api/attainment/deals', { params: {
              sa_inumber: selectedSA.inumber,
              quarter: 'Full Year',
              exclude_enterprise: excludeEnterprise
            }}).then(r => { setDealsData(r.data); setDealsLoading(false) })
          }, [selectedSA?.inumber, excludeEnterprise])
          const fx2 = rate
          const totalAcv = dealsData.reduce((s, r) => s + (r.acv_attributed||0), 0) * fx2
          const uniqOpps = [...new Set(dealsData.map(d => d.opportunity_id))].length
          const exportCsv = () => {
            const cols = [
              { field: 'opportunity_id',       headerName: 'Opp ID' },
              { field: 'account_name',         headerName: 'Account' },
              { field: 'opp_description',      headerName: 'Description' },
              { field: 'closing_qtr',          headerName: 'Closing Qtr' },
              { field: 'drm_category',         headerName: 'DRM' },
              { field: 'segment',              headerName: 'Segment' },
              { field: 'region',               headerName: 'Region' },
              { field: 'solution_area_l1',     headerName: 'Solution L1' },
              { field: 'sub_solution_area_l2', headerName: 'Sub-Solution L2' },
              { field: 'vat_dh',               headerName: 'VAT DH' },
              { field: 'vat_full',             headerName: 'VAT Full' },
              { field: 'vat_size',             headerName: 'VAT Size' },
              { field: 'acv_linha',            headerName: `ACV Line (${cur})` },
              { field: 'acv_atribuido',        headerName: `ACV Attributed (${cur})` },
              { field: 'acv_total',            headerName: `ACV Total Opp (${cur})` },
              { field: 'sub_team',             headerName: 'Sub-Team' },
              { field: 'area',                 headerName: 'Area' },
            ]
            const xlRows = dealsData.map(r => ({
              opportunity_id:       r.opportunity_id,
              account_name:         r.account_name,
              opp_description:      r.opp_description,
              closing_qtr:          r.closing_qtr,
              drm_category:         r.drm_category,
              segment:              r.segment,
              region:               r.region,
              solution_area_l1:     r.solution_area_l1,
              sub_solution_area_l2: r.sub_solution_area_l2,
              vat_dh:               r.vat_dh,
              vat_full:             r.vat_full,
              vat_size:             r.vat_size,
              acv_linha:            +((r.acv_line_usd||0)*fx2).toFixed(2),
              acv_atribuido:        +((r.acv_attributed||0)*fx2).toFixed(2),
              acv_total:            +((r.acv_total_opp||0)*fx2).toFixed(2),
              sub_team:             r.sub_team,
              area:                 r.area,
            }))
            exportToExcel(xlRows, `deals_${selectedSA?.inumber}_YTD`, 'Deals', cols)
          }
          const th2 = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sap-muted border-b border-sap-border bg-[#f8f9fa] whitespace-nowrap text-left sticky top-0"
          const td2 = "px-3 py-2 text-[13px] text-sap-text border-b border-sap-border whitespace-nowrap"
          const tn2 = "px-3 py-2 text-[13px] text-right border-b border-sap-border whitespace-nowrap tabular-nums"
          return (
            <div className="mt-6 rounded-xl border border-sap-border overflow-hidden shadow-card">
              <div className="flex items-center justify-between px-5 py-3 border-b border-sap-border bg-[#f8f9fa]">
                <div>
                  <div className="font-semibold text-sap-text text-[15px]">Deals — {selectedSA.name}</div>
                  <div className="text-[11px] text-sap-muted mt-0.5">
                    {selectedSA.sub_team || selectedSA.area} · Full Year
                    {excludeEnterprise && <span className="ml-2 text-[#aa0808] font-semibold">· Enterprise excluded</span>}
                    {!dealsLoading && <span className="ml-2">· {uniqOpps} opps · {dealsData.length} lines</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition bg-white">
                    ⬇ Export Excel
                  </button>
                  <button onClick={() => setSelectedSA(null)} className="flex items-center gap-1 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition bg-white text-sap-muted">
                    ✕ Close
                  </button>
                </div>
              </div>
              {!dealsLoading && dealsData.length > 0 && (
                <div className="flex gap-8 px-5 py-2.5 border-b border-sap-border bg-white text-[13px]">
                  <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">ACV Attributed</span><strong className="text-sap-blue">{formatAcvK(totalAcv, cur)}</strong></span>
                  <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">Unique Opps</span><strong>{uniqOpps}</strong></span>
                </div>
              )}
              {dealsLoading ? (
                <div className="p-8 text-center text-sap-muted text-sm">Loading deals…</div>
              ) : dealsData.length === 0 ? (
                <div className="p-8 text-center text-sap-muted text-sm">No Booked/Won deals found.</div>
              ) : (
                <div className="overflow-x-auto" style={{maxHeight:'520px',overflowY:'auto'}}>
                  <table className="w-full border-collapse bg-white">
                    <thead>
                      <tr>
                        <th className={th2}>Opp #</th><th className={th2}>Account</th><th className={th2}>Description</th><th className={th2}>Qtr</th>
                        <th className={th2}>Segment</th><th className={th2}>Solution L1</th><th className={th2}>Sub-Solution L2</th>
                        <th className={th2}>VAT_DH</th><th className={th2}>VAT_Size</th>
                        <th className={th2 + " text-right"}>ACV Line K</th>
                        <th className={th2 + " text-right bg-[#e8f0fe]"}>ACV Attributed K</th>
                        <th className={th2 + " text-right"}>ACV Total Opp K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealsData.map((r, i) => (
                        <tr key={i} className="hover:bg-[#f0f4ff] transition-colors">
                          <td className={td2 + " font-mono text-[12px]"}>{r.opportunity_id}</td>
                          <td className={td2 + " max-w-[150px] truncate"} title={r.account_name}>{r.account_name}</td>
                          <td className={td2 + " max-w-[180px] truncate text-sap-muted text-[12px]"} title={r.opp_description}>{r.opp_description}</td>
                          <td className={td2}>{r.closing_qtr}</td>
                          <td className={td2}><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${r.segment==='Enterprise'?'bg-[#fde8e8] text-[#aa0808]':r.segment==='Corporate'?'bg-[#e8f0fe] text-[#0070f2]':'bg-[#f0f2f4] text-sap-muted'}`}>{r.segment}</span></td>
                          <td className={td2 + " text-[12px]"}>{r.solution_area_l1}</td>
                          <td className={td2 + " text-[12px] text-sap-muted max-w-[150px] truncate"} title={r.sub_solution_area_l2}>{r.sub_solution_area_l2}</td>
                          <td className={td2 + " text-[12px] max-w-[150px] truncate"} title={r.vat_dh}>{r.vat_dh}</td>
                          <td className={tn2 + " font-mono"}>{r.vat_size}</td>
                          <td className={tn2}>{formatAcvK((r.acv_line_usd||0)*fx2, cur)}</td>
                          <td className={tn2 + " bg-[#f0f4ff] font-semibold text-sap-blue"}>{formatAcvK((r.acv_attributed||0)*fx2, cur)}</td>
                          <td className={tn2}>{formatAcvK((r.acv_total_opp||0)*fx2, cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        }
        return <InlineDeals />
      })()}

    </div>
  )
}
