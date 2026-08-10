/**
 * Shared logic for pipeline tables:
 *  - Show/Hide columns panel
 *  - LoB badge (Single Bag / Basket Deal) from acv_l1_* fields
 *  - Engagement Type color coding
 */
import { useState, useMemo } from 'react'
import { acvCol } from './utils'

export const LOB_NON_TF_FIELDS = [
  'acv_l1_baip_dai','acv_l1_btm','acv_l1_cloud_erp',
  'acv_l1_cx','acv_l1_finance','acv_l1_hcm','acv_l1_scm','acv_l1_other',
]

export function getLobBadge(data: any): { label: string; bg: string; color: string } | null {
  if (!data) return null
  const nonTFActive = LOB_NON_TF_FIELDS.filter(f => Number(data[f] || 0) > 0)
  const hasTF = Number(data.acv_l1_baip_tf || 0) > 0
  const totalActive = nonTFActive.length + (hasTF ? 1 : 0)
  if (totalActive === 0) return null
  if (nonTFActive.length > 1) return { label: '🧺 Basket Deal', bg: '#EDE7F6', color: '#5E35B1' }
  return { label: '🎯 Single Bag', bg: '#E3F2FD', color: '#1565C0' }
}

export function engagementCellStyle(p: any) {
  const v = (p.value || '').toLowerCase()
  if (v.includes('digital'))      return { color: '#256f3a', fontWeight: 700 }
  if (v.includes('field'))        return { color: '#BB0000', fontWeight: 700 }
  if (v.includes('no engagement')) return { color: '#856404', fontWeight: 700 }
  return {}
}



// LOB columns (hidden by default)
export const LOB_COL_DEFS = [
  { field: 'acv_l1_baip_dai',  label: 'BAIP – Data & AI' },
  { field: 'acv_l1_baip_tf',   label: 'BAIP – Tech Foundation' },
  { field: 'acv_l1_btm',       label: 'BTM' },
  { field: 'acv_l1_cloud_erp', label: 'Cloud ERP Private' },
  { field: 'acv_l1_cx',        label: 'Customer Experience' },
  { field: 'acv_l1_finance',   label: 'Finance & Spend' },
  { field: 'acv_l1_hcm',       label: 'HCM' },
  { field: 'acv_l1_scm',       label: 'Supply Chain' },
  { field: 'acv_l1_other',     label: 'Other' },
]

export function buildLobAcvCols(fx: number, currency: 'USD' | 'EUR'): any[] {
  // Note: hide is NOT set here — visibility is managed by useColVisibility hook
  return LOB_COL_DEFS.map(l => ({
    ...acvCol(l.field, fx, currency, l.label, 130),
  }))
}

/** Hook: column visibility toggle panel */
export function useColVisibility(allKeys: string[], defaultVisible: string[]) {
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(defaultVisible))
  const [panelOpen, setPanelOpen] = useState(false)

  const toggleCol = (k: string) => setVisibleCols(p => {
    const n = new Set(p)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })
  const showAll   = () => setVisibleCols(new Set(allKeys))
  const resetCols = () => setVisibleCols(new Set(defaultVisible))

  return { visibleCols, panelOpen, setPanelOpen, toggleCol, showAll, resetCols }
}

/** Hook: Single Bag / Basket Deal filter */
export function useBagFilter(rows: any[]) {
  const [bagFilter, setBagFilter] = useState<'all' | 'single' | 'basket'>('all')

  const filteredRows = useMemo(() => {
    if (bagFilter === 'all') return rows
    return rows.filter(r => {
      const badge = getLobBadge(r)
      if (bagFilter === 'single') return badge?.label.includes('Single')
      return badge?.label.includes('Basket')
    })
  }, [rows, bagFilter])

  const singleCount = useMemo(() => rows.filter(r => getLobBadge(r)?.label.includes('Single')).length, [rows])
  const basketCount = useMemo(() => rows.filter(r => getLobBadge(r)?.label.includes('Basket')).length, [rows])

  return { bagFilter, setBagFilter, filteredRows, singleCount, basketCount }
}
