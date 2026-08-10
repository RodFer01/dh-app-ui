// @ts-nocheck
/**
 * exportToExcel — formatted Excel export using ExcelJS.
 * Features:
 *   1. Table formatting (header + alternating rows)
 *   2. Digital engagement highlight (blue-tinted row) — detects engagement_type OR vat_dh
 *   3. Deal Qualification Decision color coding (Go/No-Go/Re-Qualify)
 *   4. Presales Status color coding (Red/Yellow/Green/Assigned)
 *   5. ACV heatmap (darker = higher value)
 *   6. Auto-filter + frozen header row
 */

async function getExcelJS() {
  if (typeof (window as any).ExcelJS !== 'undefined') return (window as any).ExcelJS
  await new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[data-exceljs]')) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
    s.setAttribute('data-exceljs', '1')
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
  return (window as any).ExcelJS
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function heatmapColor(value: number, max: number): string {
  if (!value || !max || value <= 0) return 'FFFFFFFF'
  const ratio = Math.min(value / max, 1)
  const r = Math.round(214 - ratio * 214)
  const g = Math.round(234 - ratio * (234 - 112))
  const b = Math.round(248 - ratio * (248 - 184))
  return `FF${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`.toUpperCase()
}

function heatmapFontColor(value: number, max: number): string {
  if (!value || !max) return 'FF000000'
  return Math.min(value / max, 1) > 0.55 ? 'FFFFFFFF' : 'FF0A3D62'
}

const QUAL_COLORS: Record<string, { bg: string; font: string }> = {
  'go':          { bg: 'FF1E8449', font: 'FFFFFFFF' },
  'no-go':       { bg: 'FFC0392B', font: 'FFFFFFFF' },
  'no go':       { bg: 'FFC0392B', font: 'FFFFFFFF' },
  're-qualify':  { bg: 'FFE67E22', font: 'FFFFFFFF' },
  'requalify':   { bg: 'FFE67E22', font: 'FFFFFFFF' },
  'qualify':     { bg: 'FFE67E22', font: 'FFFFFFFF' },
}

const PRESALES_COLORS: Record<string, { bg: string; font: string }> = {
  'red':         { bg: 'FFFDEDEC', font: 'FFC0392B' },
  'yellow':      { bg: 'FFFEF9E7', font: 'FF935116' },
  'green':       { bg: 'FFEAFAF1', font: 'FF1E8449' },
  'assigned':    { bg: 'FFE8EAF6', font: 'FF283593' },
  'in progress': { bg: 'FFEAF4FB', font: 'FF1A5276' },
  'completed':   { bg: 'FFEAFAF1', font: 'FF1E8449' },
}

// ── Style constants ───────────────────────────────────────────────────────────

const HEADER_FILL      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070B8' } } as const
const HEADER_FONT      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' } as const
const DIGITAL_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } } as const
const ROW_EVEN_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6F7' } } as const
const ROW_ODD_FILL     = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } as const
const THIN_BORDER      = { style: 'thin', color: { argb: 'FFBDD7EE' } } as const
const CELL_BORDER      = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportToExcel(
  rows: Record<string, any>[],
  filename: string,
  sheetName = 'Data',
  colDefs?: { field: string; headerName?: string }[]
) {
  if (!rows.length) return

  const ExcelJS = await getExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Digital Hub SA'
  wb.created = new Date()
  const ws = wb.addWorksheet(sheetName.slice(0, 31))

  // Columns
  const fields: { field: string; header: string }[] = colDefs?.filter(c => c.field)
    .map(c => ({ field: c.field, header: c.headerName || c.field }))
    ?? Object.keys(rows[0]).map(k => ({ field: k, header: k }))

  // Identify special columns (case-insensitive partial match)
  const acvFields      = fields.filter(f => /\bacv\b|acv_/i.test(f.field)).map(f => f.field)
  const engField       = fields.find(f => /engagement_type/i.test(f.field))?.field
  const vatDhField     = fields.find(f => /vat_dh|digital_sa/i.test(f.field))?.field
  const qualField      = fields.find(f => /qual.*decision|deal_qual/i.test(f.field))?.field
  const presalesField  = fields.find(f => /presales.*status|presales_lead_status/i.test(f.field))?.field

  // ACV max for heatmap
  const acvMax: Record<string, number> = {}
  for (const af of acvFields) {
    acvMax[af] = Math.max(...rows.map(r => Number(r[af]) || 0), 1)
  }

  // Column widths
  ws.columns = fields.map(f => {
    const maxData = Math.max(...rows.map(r => String(r[f.field] ?? '').length), 0)
    return { header: f.header, key: f.field, width: Math.min(Math.max(f.header.length, maxData) + 3, 52) }
  })

  // Header row
  const headerRow = ws.getRow(1)
  headerRow.height = 24
  fields.forEach((_, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.fill      = HEADER_FILL
    cell.font      = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF005A8E' } } }
  })

  // Data rows
  rows.forEach((r, rowIdx) => {
    const isDigital = (
      (engField  && /digital/i.test(String(r[engField]  ?? ''))) ||
      (vatDhField && String(r[vatDhField] ?? '').trim().length > 0)
    )
    const qualVal      = qualField     ? String(r[qualField]     ?? '').trim().toLowerCase() : ''
    const presalesVal  = presalesField ? String(r[presalesField] ?? '').trim().toLowerCase() : ''
    const qualColor    = QUAL_COLORS[qualVal]
    const presalesColor = PRESALES_COLORS[presalesVal]

    const row = ws.addRow(fields.map(f => r[f.field] ?? ''))
    row.height = 16
    const baseFill = isDigital ? DIGITAL_ROW_FILL : (rowIdx % 2 === 0 ? ROW_EVEN_FILL : ROW_ODD_FILL)

    fields.forEach((f, colIdx) => {
      const cell = row.getCell(colIdx + 1)
      cell.font      = { size: 10, name: 'Calibri', color: { argb: 'FF32363A' } }
      cell.alignment = { vertical: 'middle' }
      cell.border    = CELL_BORDER

      if (acvFields.includes(f.field)) {
        // ACV heatmap
        const val = Number(r[f.field]) || 0
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: heatmapColor(val, acvMax[f.field]) } }
        cell.font      = { size: 10, name: 'Calibri', bold: val / acvMax[f.field] > 0.3, color: { argb: heatmapFontColor(val, acvMax[f.field]) } }
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      } else if (qualField && f.field === qualField && qualColor) {
        // Deal Qualification Decision
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: qualColor.bg } }
        cell.font      = { size: 10, name: 'Calibri', bold: true, color: { argb: qualColor.font } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (presalesField && f.field === presalesField && presalesColor) {
        // Presales Status
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: presalesColor.bg } }
        cell.font      = { size: 10, name: 'Calibri', bold: true, color: { argb: presalesColor.font } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (vatDhField && f.field === vatDhField && String(r[f.field] ?? '').trim()) {
        // Digital SA — highlight the cell itself
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAF8' } }
        cell.font      = { size: 10, name: 'Calibri', bold: true, color: { argb: 'FF1A5276' } }
        cell.alignment = { vertical: 'middle' }
      } else {
        cell.fill = baseFill
      }
    })
  })

  // Auto-filter + frozen header
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: fields.length } }
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  // Legend sheet
  const legend = wb.addWorksheet('Legenda')
  legend.columns = [
    { header: 'Elemento', key: 'elem', width: 28 },
    { header: 'Cor',      key: 'cor',  width: 22 },
    { header: 'Significado', key: 'sig', width: 40 },
  ]
  const legendHeader = legend.getRow(1)
  legendHeader.height = 20
  ;[1,2,3].forEach(i => {
    const c = legendHeader.getCell(i)
    c.fill = HEADER_FILL; c.font = HEADER_FONT
    c.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  const legendRows = [
    ['Digital SA (linha)',   'Azul claro (#EBFEFB)',  'Oportunidade com Digital SA atribuído'],
    ['Deal Qual — Go',       'Verde (#1E8449)',        'Decisão de qualificação aprovada'],
    ['Deal Qual — No-Go',    'Vermelho (#C0392B)',     'Decisão de qualificação reprovada'],
    ['Deal Qual — Re-Qualify','Laranja (#E67E22)',     'Necessita requalificação'],
    ['Presales — Green',     'Verde claro',            'Presales status positivo'],
    ['Presales — Yellow',    'Amarelo claro',          'Presales status de atenção'],
    ['Presales — Red',       'Vermelho claro',         'Presales status crítico'],
    ['ACV (heatmap)',        'Azul gradiente',         'Maior valor = azul mais escuro'],
  ]
  legendRows.forEach(([elem, cor, sig], i) => {
    const row = legend.addRow([elem, cor, sig])
    row.height = 15
    ;[1,2,3].forEach(j => {
      const c = row.getCell(j)
      c.fill = i % 2 === 0 ? ROW_EVEN_FILL : ROW_ODD_FILL
      c.font = { size: 10, name: 'Calibri' }
      c.border = CELL_BORDER
    })
  })

  // Download
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href = url; a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx'; a.click()
  URL.revokeObjectURL(url)
}
