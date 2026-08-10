/**
 * Global registry of EChart instances by chartId.
 * Allows any component to capture chart images for PPT export.
 */
const registry: Map<string, any> = new Map()

export const chartRegistry = {
  register: (id: string, instance: any) => registry.set(id, instance),
  unregister: (id: string) => registry.delete(id),
  getAll: () => Array.from(registry.entries()),
  clear: () => registry.clear(),

  /**
   * Capture all registered charts as { id, title, dataUrl } objects.
   * Uses ECharts getDataURL for high-quality PNG export.
   */
  captureAll: (pixelRatio = 2): { id: string; title: string; dataUrl: string }[] => {
    const results: { id: string; title: string; dataUrl: string }[] = []
    for (const [id, inst] of registry.entries()) {
      try {
        const echarts = inst.getEchartsInstance?.()
        if (!echarts) continue
        const option = echarts.getOption()
        const title = (option?.title as any)?.[0]?.text || id
        const dataUrl = echarts.getDataURL({
          type: 'png',
          pixelRatio,
          backgroundColor: '#ffffff',
        })
        if (dataUrl) results.push({ id, title, dataUrl })
      } catch { /* skip if instance unavailable */ }
    }
    return results
  },
}
