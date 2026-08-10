import { useState } from 'react'
import { usePptxExport } from '../lib/usePptxExport'
import { FilenamePrompt } from './FilenamePrompt'

interface Props {
  getPayload: () => Parameters<ReturnType<typeof usePptxExport>['exportPptx']>[0]
  defaultFilename?: string
  label?: string
}

export function PptxExportButton({ getPayload, defaultFilename = 'SAP_Export.pptx', label = 'Export PPT' }: Props) {
  const { exportPptx, exporting, error } = usePptxExport()
  const [promptOpen, setPromptOpen] = useState(false)

  const handleConfirm = (name: string) => {
    setPromptOpen(false)
    exportPptx(getPayload(), name)
  }

  return (
    <div className="relative inline-flex flex-col items-end">
      <button
        onClick={() => setPromptOpen(true)}
        disabled={exporting}
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
          exporting
            ? 'border-sap-border text-sap-muted bg-sap-bg cursor-not-allowed'
            : 'border-[#C55A11] text-[#C55A11] hover:bg-[#FFF4EE] bg-white'
        }`}
        title="Export current view as SAP PowerPoint"
      >
        {exporting ? (
          <>
            <span style={{ display:'inline-block', width:11, height:11, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
            Generating…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h4v5H7z" fill="currentColor" stroke="none"/><rect x="13" y="8" width="4" height="2" rx=".5" fill="currentColor" stroke="none"/><rect x="13" y="12" width="4" height="2" rx=".5" fill="currentColor" stroke="none"/>
            </svg>
            {label}
          </>
        )}
      </button>
      {error && (
        <span className="absolute top-full mt-1 right-0 text-[10px] text-sap-error bg-white border border-sap-error rounded px-2 py-1 whitespace-nowrap z-50">
          ⚠ {error}
        </span>
      )}
      {promptOpen && (
        <FilenamePrompt
          defaultName={defaultFilename}
          onConfirm={handleConfirm}
          onCancel={() => setPromptOpen(false)}
        />
      )}
    </div>
  )
}

