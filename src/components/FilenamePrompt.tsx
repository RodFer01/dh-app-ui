import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  defaultName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function FilenamePrompt({ defaultName, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Select the name portion (without extension) for quick editing
    const input = inputRef.current
    if (!input) return
    input.focus()
    const dot = value.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : value.length)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirm()
    if (e.key === 'Escape') onCancel()
  }

  const confirm = () => {
    const name = value.trim() || defaultName
    onConfirm(name)
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[400px] p-6 border border-sap-border">
        <h3 className="text-[15px] font-bold text-sap-text mb-1">Save file as</h3>
        <p className="text-[12px] text-sap-muted mb-4">Edit the filename before downloading.</p>

        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue font-mono"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg border border-sap-border text-sap-muted hover:bg-sap-bg transition"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="px-4 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d transition"
          >
            Download
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
