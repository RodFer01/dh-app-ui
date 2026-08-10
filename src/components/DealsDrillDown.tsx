// @ts-nocheck
/* eslint-disable */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatAcvK } from '../lib/utils'
import { Download, X, ChevronDown } from 'lucide-react'

// Hook
export function useDealsPanel() {
  const [selectedSA, setSelectedSA] = useState(null)
  const [excludeEnterprise, setExcludeEnterprise] = useState(false)
  const toggle = (sa) => setSelectedSA(prev => prev?.inumber === sa?.inumber ? null : sa)
  return { selectedSA, setSelectedSA: toggle, excludeEnterprise, setExcludeEnterprise }
}

// Panel component - inlined to prevent tree-shaking
export function DealsDrillDown({ selectedSA, excludeEnterprise, onClose }) {
  const { currency, fxRate } = useAuth()
  const quarter = 'Full Year'

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['att-deals', selectedSA?.inumber, quarter, excludeEnterprise],
    queryFn: () => api.get('/api/attainment/deals', {
      params: { sa_inumber: selectedSA.inumber, quarter, exclude_enterprise: excludeEnterprise }
    }).then(r => r.data),
    enabled: !!selectedSA?.inumber,
  })

  const fx = fxRate
  const totalAcv  = deals.reduce((s, r) => s + (r.acv_attributed || 0), 0) * fx
  const totalLine = deals.reduce((s, r) => s + (r.acv_line_usd   || 0), 0) * fx
  const uniqOpps  = [...new Set(deals.map(d => d.opportunity_id))].length

  const exportCsv = () => {
    const h = ['Opp ID','Account','Description','Closing Qtr','DRM','Segment','Region',
               'Solution L1','Sub-Solution L2','VAT_DH','VAT_Full','VAT_Size',
               `ACV Line (${currency})`,`ACV Attributed (${currency})`,`ACV Total Opp (${currency})`,
               'Sub-Team','Area']
    const body = deals.map(r => [
      r.opportunity_id,
      `"${(r.account_name||'').replace(/"/g,'""')}"`,
      `"${(r.opp_description||'').replace(/"/g,'""')}"`,
      r.closing_qtr, r.drm_category, r.segment, r.region,
      r.solution_area_l1, r.sub_solution_area_l2,
      `"${(r.vat_dh||'').replace(/"/g,'""')}"`,
      `"${(r.vat_full||'').replace(/"/g,'""')}"`,
      r.vat_size,
      ((r.acv_line_usd||0)*fx).toFixed(2),
      ((r.acv_attributed||0)*fx).toFixed(2),
      ((r.acv_total_opp||0)*fx).toFixed(2),
      r.sub_team, r.area
    ].join(','))
    const csv = [h.join(','), ...body].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}))
    a.download = `deals_${selectedSA?.inumber}_YTD.csv`
    a.click()
  }

  if (!selectedSA) return null

  const th = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sap-muted border-b border-sap-border bg-[#f8f9fa] whitespace-nowrap text-left sticky top-0"
  const td = "px-3 py-2 text-[13px] text-sap-text border-b border-sap-border whitespace-nowrap"
  const tn = "px-3 py-2 text-[13px] text-right border-b border-sap-border whitespace-nowrap tabular-nums"

  return (
    <div className="mt-6 rounded-xl border border-sap-border overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-sap-border bg-[#f8f9fa]">
        <div>
          <div className="font-semibold text-sap-text text-[15px]">
            Deals — {selectedSA.name}
          </div>
          <div className="text-[11px] text-sap-muted mt-0.5">
            {selectedSA.sub_team || selectedSA.area} · Full Year
            {excludeEnterprise && <span className="ml-2 text-[#aa0808] font-semibold">· Enterprise excluded</span>}
            {!isLoading && <span className="ml-2">· {uniqOpps} opportunities · {deals.length} lines</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition bg-white">
            <Download size={13}/> Export Excel
          </button>
          <button onClick={onClose}
            className="flex items-center gap-1 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition bg-white text-sap-muted">
            <X size={13}/> Close
          </button>
        </div>
      </div>

      {/* Summary */}
      {!isLoading && deals.length > 0 && (
        <div className="flex gap-8 px-5 py-2.5 border-b border-sap-border bg-white text-[13px]">
          <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">ACV Attributed</span>
            <strong className="text-sap-blue">{formatAcvK(totalAcv, currency)}</strong></span>
          <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">ACV Line Total</span>
            <strong>{formatAcvK(totalLine, currency)}</strong></span>
          <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">Unique Opps</span>
            <strong>{uniqOpps}</strong></span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center text-sap-muted text-sm">Loading deals…</div>
      ) : deals.length === 0 ? (
        <div className="p-8 text-center text-sap-muted text-sm">No Booked/Won deals found for this period.</div>
      ) : (
        <div className="overflow-x-auto" style={{maxHeight:'520px',overflowY:'auto'}}>
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr>
                <th className={th}>Opp #</th>
                <th className={th}>Account</th>
                <th className={th}>Description</th>
                <th className={th}>Qtr</th>
                <th className={th}>Segment</th>
                <th className={th}>Solution L1</th>
                <th className={th}>Sub-Solution L2</th>
                <th className={th}>VAT_DH</th>
                <th className={th}>VAT_Size</th>
                <th className={th + " text-right"}>ACV Line K</th>
                <th className={th + " text-right bg-[#e8f0fe]"}>ACV Attributed K</th>
                <th className={th + " text-right"}>ACV Total Opp K</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((r, i) => (
                <tr key={i} className="hover:bg-[#f0f4ff] transition-colors">
                  <td className={td + " font-mono text-[12px]"}>{r.opportunity_id}</td>
                  <td className={td + " max-w-[150px] truncate"} title={r.account_name}>{r.account_name}</td>
                  <td className={td + " max-w-[180px] truncate text-sap-muted text-[12px]"} title={r.opp_description}>{r.opp_description}</td>
                  <td className={td}>{r.closing_qtr}</td>
                  <td className={td}>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                      r.segment==='Enterprise'?'bg-[#fde8e8] text-[#aa0808]':
                      r.segment==='Corporate'?'bg-[#e8f0fe] text-[#0070f2]':
                      'bg-[#f0f2f4] text-sap-muted'}`}>{r.segment}</span>
                  </td>
                  <td className={td + " text-[12px]"}>{r.solution_area_l1}</td>
                  <td className={td + " text-[12px] text-sap-muted max-w-[150px] truncate"} title={r.sub_solution_area_l2}>{r.sub_solution_area_l2}</td>
                  <td className={td + " text-[12px] max-w-[150px] truncate"} title={r.vat_dh}>{r.vat_dh}</td>
                  <td className={tn + " font-mono"}>{r.vat_size}</td>
                  <td className={tn}>{formatAcvK((r.acv_line_usd||0)*fx,currency)}</td>
                  <td className={tn + " bg-[#f0f4ff] font-semibold text-sap-blue"}>{formatAcvK((r.acv_attributed||0)*fx,currency)}</td>
                  <td className={tn}>{formatAcvK((r.acv_total_opp||0)*fx,currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
