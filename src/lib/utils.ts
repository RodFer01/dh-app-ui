import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format full monetary value: $1,234,567.89 */
export function formatCurrency(value: number | null | undefined, currency: 'USD' | 'EUR' = 'USD'): string {
  if (value == null) return '—'
  return new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Format ACV in thousands: $1,234.6K — divide by 1000 then format */
export function formatAcvK(value: number | null | undefined, currency: 'USD' | 'EUR' = 'USD'): string {
  if (value == null) return '—'
  const k = value / 1000
  const sym = currency === 'EUR' ? '€' : '$'
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(k)
  return `${sym}${formatted}K`
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)}%`
}

const CRM_BASE = 'https://sapit-home-prod-004.launchpad.cfapps.eu10.hana.ondemand.com/site#harmonyquote-Display?sap-ui-app-id-hint=1ff99794-b150-4e6d-ad32-d960c79f9a7a&/Opportunity/'

/** Return the Fiori CRM URL for an opportunity ID */
export function oppUrl(oppId: string | null | undefined): string {
  if (!oppId) return '#'
  return `${CRM_BASE}${oppId}`
}

/**
 * Returns an AG-Grid ColDef for an ACV column with a blue heatmap cellStyle.
 * Intensity is relative to the max ACV in the visible rows — darker = higher value.
 *
 * @param field      - row field name (e.g. 'acv_usd' or 'acv_total_opp')
 * @param fx         - FX rate multiplier
 * @param currency   - display currency
 * @param headerName - optional override (defaults to `ACV K (${currency})`)
 * @param width      - column width in px (default 150)
 */
export function acvCol(
  field: string,
  fx: number,
  currency: 'USD' | 'EUR',
  headerName?: string,
  width = 150,
) {
  return {
    field,
    headerName: headerName ?? `ACV K (${currency})`,
    width,
    valueFormatter: (p: { value: number }) =>
      p.value != null ? formatAcvK(p.value * fx, currency) : '—',
    cellStyle: (p: { value: number; api: { getRenderedNodes: () => { data: Record<string, number> }[] } }) => {
      const val = p.value
      if (val == null || val <= 0) return {}

      // Compute max ACV across all currently rendered rows
      let max = 0
      try {
        p.api.getRenderedNodes().forEach((node) => {
          const v = Number(node.data?.[field] || 0)
          if (v > max) max = v
        })
      } catch {
        // fallback: no styling if API unavailable
        return {}
      }
      if (max <= 0) return {}

      const ratio = Math.min(val / max, 1)   // 0 → 1

      // Interpolate: low = #EBF5FB (very light blue), high = #0070B8 (SAP blue)
      // Using HSL: hue=207, sat 70%, lightness 90% → 35%
      const lightness = Math.round(90 - ratio * 55)   // 90% (lightest) → 35% (darkest)
      const saturation = Math.round(40 + ratio * 55)  // 40% → 95%
      const textColor  = lightness < 60 ? '#ffffff' : '#0A3D62'

      return {
        background: `hsl(207, ${saturation}%, ${lightness}%)`,
        color: textColor,
        fontWeight: ratio > 0.6 ? '700' : ratio > 0.3 ? '600' : '400',
        borderRadius: '4px',
      }
    },
  }
}
