import { useState, useCallback } from 'react'
import { FilenamePrompt } from '../components/FilenamePrompt'

/**
 * Returns a wrapper for any download action that shows a filename prompt first.
 * Usage:
 *   const { prompt, promptElement } = useFilenamePrompt()
 *   ...
 *   <button onClick={() => prompt('report.xlsx', name => exportToExcel(rows, name, ...))}
 *   {promptElement}
 */
export function useFilenamePrompt() {
  const [state, setState] = useState<{ defaultName: string; onConfirm: (n: string) => void } | null>(null)

  const prompt = useCallback((defaultName: string, onConfirm: (name: string) => void) => {
    setState({ defaultName, onConfirm })
  }, [])

  const promptElement = state ? (
    <FilenamePrompt
      defaultName={state.defaultName}
      onConfirm={name => { setState(null); state.onConfirm(name) }}
      onCancel={() => setState(null)}
    />
  ) : null

  return { prompt, promptElement }
}
