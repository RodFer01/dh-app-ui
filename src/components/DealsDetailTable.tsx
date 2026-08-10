// @ts-nocheck
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { formatAcvK } from '../lib/utils'
import { Download, X } from 'lucide-react'

interface Props {
  sa: { inumber: string; name: string; sub_team?: string; area?: string } | null
  quarter: string
  excludeEnterprise: boolean
  onClose: () => void
}

export function DealsDetailTable({ sa, quarter, excludeEnterprise, onClose }: Props) {
  const { currency, fxRate } = useAuth()

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['att-deals', sa?.inumber, quarter, excludeEnterprise],
    queryFn: () => api.get('/api/attainment/deals', {
      params: {
        sa_inumber: sa!.inumber,
        quarter,
        exclude_enterprise: excludeEnterprise,
      }
    }).then(r => r.data),
    enabled: !!sa?.inumber,
  })

  const fx = fxRate
  const totalAcv     = deals.reduce((s, r) => s + (r.acv_attributed || 0), 0) * fx
  const totalAcvLine = deals.reduce((s, r) => s + (r.acv_line_usd  || 0), 0) * fx

  const exportExcel = () => {
    // Build CSV (Excel-compatible)
    const headers = [
      'Opportunity ID', 'Account', 'Description', 'Closing Qtr', 'DRM Category',
      'Segment', 'Region', 'Solution L1', 'Sub-Solution L2',
      'VAT_DH', 'VAT_Full', 'VAT_Size',
      `ACV Line (${currency})`, `ACV Attributed (${currency})`, `ACV Total Opp (${currency})`,
      'Sub-Team', 'Area'
    ]
    const rows = deals.map(r => [
      r.opportunity_id,
      `"${(r.account_name  || '').replace(/"/g,'""')}"`,
      `"${(r.opp_description || '').replace(/"/g,'""')}"`,
      r.closing_qtr,
      r.drm_category,
      r.segment,
      r.region,
      r.solution_area_l1,
      r.sub_solution_area_l2,
      `"${(r.vat_dh  || '').replace(/"/g,'""')}"`,
      `"${(r.vat_full || '').replace(/"/g,'""')}"`,
      r.vat_size,
      ((r.acv_line_usd  || 0) * fx).toFixed(2),
      ((r.acv_attributed || 0) * fx).toFixed(2),
      ((r.acv_total_opp  || 0) * fx).toFixed(2),
      r.sub_team,
      r.area,
    ].join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `deals_${sa?.inumber}_${quarter.replace(' ','_')}.csv`
    a.click()
  }

  if (!sa) return null

  const thCls = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sap-muted border-b border-sap-border bg-[#f8f9fa] whitespace-nowrap text-left"
  const tdCls = "px-3 py-2 text-[13px] text-sap-text border-b border-sap-border whitespace-nowrap"
  const tdNum = "px-3 py-2 text-[13px] text-right border-b border-sap-border whitespace-nowrap tabular-nums"

  return (
    <div className="mt-6 card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-sap-border bg-[#f8f9fa]">
        <div>
          <div className="font-semibold text-sap-text text-[15px]">
            Deals — {sa.name}
          </div>
          <div className="text-[11px] text-sap-muted mt-0.5">
            {sa.sub_team || sa.area} · {quarter}
            {excludeEnterprise && <span className="ml-2 text-[#aa0808] font-semibold">· Enterprise excluded</span>}
            {!isLoading && <span className="ml-2">· {deals.length} deals</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition"
          >
            <Download size={13} /> Export Excel
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition text-sap-muted"
          >
            <X size={13} /> Close
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!isLoading && deals.length > 0 && (
        <div className="flex gap-8 px-5 py-2.5 border-b border-sap-border bg-white text-[13px]">
          <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">ACV Attributed</span>
            <strong className="text-sap-blue">{formatAcvK(totalAcv, currency)}</strong></span>
          <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">ACV Line Total</span>
            <strong>{formatAcvK(totalAcvLine, currency)}</strong></span>
          <span><span className="text-sap-muted text-[11px] uppercase tracking-wide font-medium mr-1">Deals</span>
            <strong>{[...new Set(deals.map(d => d.opportunity_id))].length}</strong></span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center text-sap-muted text-sm">Loading deals…</div>
      ) : deals.length === 0 ? (
        <div className="p-8 text-center text-sap-muted text-sm">No Booked/Won deals found for this advisor in the selected period.</div>
      ) : (
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={thCls}>Opp #</th>
                <th className={thCls}>Account</th>
                <th className={thCls}>Description</th>
                <th className={thCls}>Closing Qtr</th>
                <th className={thCls}>Segment</th>
                <th className={thCls}>Solution L1</th>
                <th className={thCls}>Sub-Solution L2</th>
                <th className={thCls}>VAT_DH</th>
                <th className={thCls}>VAT_Size</th>
                <th className={`${thCls} text-right`}>ACV Line K</th>
                <th className={`${thCls} text-right bg-[#e8f0fe]`}>ACV Attributed K</th>
                <th className={`${thCls} text-right`}>ACV Total Opp K</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((r, i) => (
                <tr key={i} className="hover:bg-[#f0f4ff] transition-colors">
                  <td className={`${tdCls} font-mono text-[12px]`}>{r.opportunity_id}</td>
                  <td className={`${tdCls} max-w-[160px] truncate`} title={r.account_name}>{r.account_name}</td>
                  <td className={`${tdCls} max-w-[200px] truncate text-sap-muted text-[12px]`} title={r.opp_description}>{r.opp_description}</td>
                  <td className={tdCls}>{r.closing_qtr}</td>
                  <td className={tdCls}>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                      r.segment === 'Enterprise' ? 'bg-[#fde8e8] text-[#aa0808]' :
                      r.segment === 'Corporate'  ? 'bg-[#e8f0fe] text-[#0070f2]' :
                      'bg-[#f0f2f4] text-sap-muted'
                    }`}>{r.segment}</span>
                  </td>
                  <td className={`${tdCls} text-[12px]`}>{r.solution_area_l1}</td>
                  <td className={`${tdCls} text-[12px] text-sap-muted`}>{r.sub_solution_area_l2}</td>
                  <td className={`${tdCls} text-[12px] max-w-[160px] truncate`} title={r.vat_dh}>{r.vat_dh}</td>
                  <td className={`${tdNum} font-mono`}>{r.vat_size}</td>
                  <td className={tdNum}>{formatAcvK((r.acv_line_usd  || 0) * fx, currency)}</td>
                  <td className={`${tdNum} bg-[#f0f4ff] font-semibold text-sap-blue`}>{formatAcvK((r.acv_attributed || 0) * fx, currency)}</td>
                  <td className={tdNum}>{formatAcvK((r.acv_total_opp || 0) * fx, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
