import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportToExcel } from '../lib/exportExcel'
import { FilenamePrompt } from './FilenamePrompt'

interface Props {
  rows: any[]
  cols: { field?: string; headerName?: string }[]
  defaultFilename: string
  sheetName?: string
  label?: string
  className?: string
}

export function ExcelDownloadButton({ rows, cols, defaultFilename, sheetName, label = 'Download Excel', className }: Props) {
  const [promptOpen, setPromptOpen] = useState(false)

  const handleConfirm = (name: string) => {
    setPromptOpen(false)
    exportToExcel(rows, name, sheetName ?? 'Sheet1', cols as { field: string; headerName?: string }[])
  }

  return (
    <>
      <button
        onClick={() => setPromptOpen(true)}
        className={className ?? 'flex items-center gap-1.5 text-xs font-semibold border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition'}
      >
        <Download size={13} /> {label}
      </button>
      {promptOpen && (
        <FilenamePrompt
          defaultName={defaultFilename}
          onConfirm={handleConfirm}
          onCancel={() => setPromptOpen(false)}
        />
      )}
    </>
  )
}
