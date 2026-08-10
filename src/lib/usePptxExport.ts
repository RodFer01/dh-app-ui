import { useState } from 'react'
import api from './api'
import { chartRegistry } from './chartRegistry'

interface KpiItem {
  label: string; value: string; sub?: string; color?: string
}

interface PptxPayload {
  page: string
  title: string
  subtitle?: string
  filters?: Record<string, any>
  kpis?: KpiItem[]
  currency?: string
  author?: string
  date_label?: string
  // images captured from live charts
  chart_images?: { title: string; dataUrl: string }[]
}

export function usePptxExport() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportPptx(payload: PptxPayload, filenameOverride?: string) {
    setExporting(true)
    setError(null)
    try {
      // Capture all registered chart instances as PNG images
      const captured = chartRegistry.captureAll(2)
      const chart_images = captured.map(c => ({ title: c.title, dataUrl: c.dataUrl }))

      const resp = await api.post('/api/export/pptx', {
        ...payload,
        chart_images,
        // Keep simple bar_charts as fallback if no images captured
      }, {
        responseType: 'blob',
        timeout: 90000,
      })

      const ct = String(resp.headers['content-type'] || '')
      if (ct.includes('application/json')) {
        const text = await (resp.data as Blob).text()
        const parsed = JSON.parse(text)
        throw new Error(parsed?.detail || 'Export failed')
      }

      const url = URL.createObjectURL(new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }))
      const a   = document.createElement('a')
      const cd  = resp.headers['content-disposition'] || ''
      const m   = cd.match(/filename="([^"]+)"/)
      a.href     = url
      a.download = filenameOverride ?? m?.[1] ?? 'SAP_Export.pptx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text()
          const parsed = JSON.parse(text)
          setError(parsed?.detail || `HTTP ${e.response.status}`)
        } catch {
          setError(`HTTP ${e.response?.status ?? 'error'}`)
        }
      } else {
        setError(e?.response?.data?.detail || e?.message || 'Export failed')
      }
    } finally {
      setExporting(false)
    }
  }

  return { exportPptx, exporting, error }
}
