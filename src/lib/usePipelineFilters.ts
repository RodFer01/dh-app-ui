import { useState, useMemo } from 'react'
import { useDebounce } from './useDebounce'

export interface PipelineFilters {
  closing_qtrs: string[]
  regions: string[]
  region_lvl4s: string[]
  sol_l1s: string[]
  sol_l2s: string[]
  qual_decisions: string[]
  presales_statuses: string[]
  iss_groups: string[]
  iacs: string[]
  acc_sub_segments: string[]
  opp_phases: string[]
  flsms: string[]
  opp_owners: string[]
  local_owners: string[]
  drms: string[]
  channel_partners: string[]
  digital_sa: string
  engagement: string
  search: string
  deal_type: string   // '' | 'single' | 'basket'
}

const EMPTY: PipelineFilters = {
  closing_qtrs: [], regions: [], region_lvl4s: [], sol_l1s: [], sol_l2s: [],
  qual_decisions: [], presales_statuses: [], iss_groups: [], iacs: [], acc_sub_segments: [], opp_phases: [],
  flsms: [], opp_owners: [], local_owners: [], drms: [], channel_partners: [],
  digital_sa: '', engagement: '', search: '', deal_type: '',
}

function buildParams(filters: PipelineFilters): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (filters.closing_qtrs.length)     p.closing_qtrs     = filters.closing_qtrs
  if (filters.regions.length)          p.regions          = filters.regions
  if (filters.region_lvl4s.length)     p.region_lvl4s     = filters.region_lvl4s
  if (filters.sol_l1s.length)          p.sol_l1s          = filters.sol_l1s
  if (filters.sol_l2s.length)          p.sol_l2s          = filters.sol_l2s
  if (filters.qual_decisions.length)   p.qual_decisions   = filters.qual_decisions
  if (filters.presales_statuses.length) p.presales_statuses = filters.presales_statuses
  if (filters.iss_groups.length)       p.iss_groups       = filters.iss_groups
  if (filters.iacs.length)             p.iacs             = filters.iacs
  if (filters.acc_sub_segments.length) p.acc_sub_segments = filters.acc_sub_segments
  if (filters.opp_phases.length)       p.opp_phases       = filters.opp_phases
  if (filters.flsms.length)            p.flsms            = filters.flsms
  if (filters.opp_owners.length)       p.opp_owners       = filters.opp_owners
  if (filters.local_owners.length)     p.local_owners     = filters.local_owners
  if (filters.drms.length)             p.drms             = filters.drms
  if (filters.channel_partners.length) p.channel_partners = filters.channel_partners
  if (filters.digital_sa)              p.digital_sa       = filters.digital_sa
  if (filters.engagement)              p.engagement_type  = filters.engagement
  if (filters.search)                  p.search           = filters.search
  if (filters.deal_type)               p.deal_type        = filters.deal_type
  return p
}

export function usePipelineFilters(debounceMs = 400) {
  const [filters, setFilters] = useState<PipelineFilters>(EMPTY)

  function toggle(key: keyof PipelineFilters, val: string) {
    setFilters(f => {
      const arr = f[key] as string[]
      return { ...f, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }
    })
  }

  function set(key: keyof PipelineFilters, val: string | string[]) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function clear() {
    setFilters(EMPTY)
  }

  const filterKey = useMemo(() => JSON.stringify(filters), [filters])
  const debouncedKey = useDebounce(filterKey, debounceMs)

  const debouncedParams = useMemo(
    () => buildParams(JSON.parse(debouncedKey) as PipelineFilters),
    [debouncedKey]
  )

  const params = useMemo(() => buildParams(filters), [filterKey])

  return { filters, params, debouncedParams, toggle, set, clear }
}
