import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MultiSelect, SearchMultiSelect } from './MultiSelect'
import { FilterBar, FilterGrid } from './FilterBar'
import api from '../lib/api'
import type { PipelineFilters } from '../lib/usePipelineFilters'
import { PresalesFilterPills, QualDecisionFilterPills } from '../lib/presalesHelpers'

interface Props {
  filters: PipelineFilters
  opts: Record<string, string[]>
  toggle?: (key: keyof PipelineFilters, val: string) => void
  set: (key: keyof PipelineFilters, val: string | string[]) => void
  clear: () => void
  showEngagement?: boolean
}

export function PipelineFilterBar({ filters, opts, set, clear, showEngagement = true }: Props) {
  const [cpExcludeMode, setCpExcludeMode] = useState(false)
  const [cpExcluded, setCpExcluded] = useState<string[]>([])

  // When exclude mode: effective filter = all partners minus excluded ones
  function handleCpChange(vals: string[]) {
    if (cpExcludeMode) {
      setCpExcluded(vals)
      const allPartners = opts.channel_partners ?? []
      const effective = allPartners.filter(p => !vals.includes(p))
      set('channel_partners', effective)
    } else {
      setCpExcluded([])
      set('channel_partners', vals)
    }
  }

  function handleCpModeChange(exclude: boolean) {
    setCpExcludeMode(exclude)
    setCpExcluded([])
    set('channel_partners', [])
  }
  const hasAny =
    Object.entries(filters).some(([k, v]) =>
      k !== 'digital_sa' && k !== 'search' && k !== 'engagement' && k !== 'probability_min' && k !== 'probability_max'
        ? (v as string[]).length > 0
        : (v as string) !== ''
    )

  // When L1 is selected, fetch only matching L2 options
  const { data: filteredL2 } = useQuery({
    queryKey: ['pipeline-l2-by-l1', filters.sol_l1s],
    queryFn: () =>
      api.get('/api/pipeline/filters/l2-by-l1', { params: { sol_l1s: filters.sol_l1s } })
        .then(r => r.data.sol_l2s as string[]),
    enabled: filters.sol_l1s.length > 0,
    staleTime: 2 * 60_000,
  })

  const l2Opts = filters.sol_l1s.length > 0 ? (filteredL2 ?? []) : (opts.sol_l2s ?? [])

  // When L1 changes, remove any selected L2 values that are no longer valid
  useEffect(() => {
    if (filters.sol_l2s.length === 0) return
    const valid = new Set(l2Opts)
    const pruned = filters.sol_l2s.filter(v => valid.has(v))
    if (pruned.length !== filters.sol_l2s.length) {
      set('sol_l2s', pruned)
    }
  }, [l2Opts])

  return (
    <FilterBar>
      <FilterGrid cols={8}>
        <MultiSelect label="Closing Qtr"      selected={filters.closing_qtrs}    options={opts.closing_qtrs    ?? []} onChange={v => set('closing_qtrs', v)} />
        <MultiSelect label="Region"           selected={filters.regions}         options={opts.regions         ?? []} onChange={v => set('regions', v)} />
        <MultiSelect label="Region Lvl 4"    selected={filters.region_lvl4s}   options={opts.region_lvl4s    ?? []} onChange={v => set('region_lvl4s', v)} />
        <MultiSelect label="Solution Area L1" selected={filters.sol_l1s}        options={opts.sol_l1s         ?? []} onChange={v => set('sol_l1s', v)} />
        <MultiSelect
          label={filters.sol_l1s.length > 0 ? `Solution L2 (${l2Opts.length})` : 'Solution L2'}
          selected={filters.sol_l2s}
          options={l2Opts}
          onChange={v => set('sol_l2s', v)}
        />
        <SearchMultiSelect label="Local Acc Owner" selected={filters.local_owners} options={opts.local_owners ?? []} onChange={v => set('local_owners', v)} />
        {showEngagement && (
          <MultiSelect label="Field or Digital" selected={filters.engagement ? [filters.engagement] : []}
            options={opts.engagement_types ?? []}
            onChange={v => set('engagement', v[v.length - 1] ?? '')} />
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">SA_Name (VAT_DH)</label>
          <input value={filters.digital_sa} onChange={e => set('digital_sa', e.target.value)}
            placeholder="Search SA name…"
            className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
        </div>

        <MultiSelect label="Qualification Deci…" selected={filters.qual_decisions} options={opts.qual_decisions ?? []} onChange={v => set('qual_decisions', v)} />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">Presales Status</label>
          <PresalesFilterPills selected={filters.presales_statuses} onChange={v => set('presales_statuses', v)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">Qual Decision</label>
          <QualDecisionFilterPills selected={filters.qual_decisions} onChange={v => set('qual_decisions', v)} />
        </div>
        <MultiSelect label="ISS Group (Segment)" selected={filters.iss_groups}      options={opts.iss_groups       ?? []} onChange={v => set('iss_groups', v)} />
        <MultiSelect label="IAC"                 selected={filters.iacs}            options={opts.iacs             ?? []} onChange={v => set('iacs', v)} />
        <MultiSelect label="Acc Sub Segment" selected={filters.acc_sub_segments} options={opts.acc_sub_segments ?? []} onChange={v => set('acc_sub_segments', v)} />
        <MultiSelect label="Opp Phase"       selected={filters.opp_phases}      options={opts.opp_phases       ?? []} onChange={v => set('opp_phases', v)} />
        <SearchMultiSelect label="Sales Manager"  selected={filters.flsms}      options={opts.flsms           ?? []} onChange={v => set('flsms', v)} />
        <SearchMultiSelect label="Opp Owner Name" selected={filters.opp_owners} options={opts.opp_owners     ?? []} onChange={v => set('opp_owners', v)} />
        <MultiSelect label="DRM Category"    selected={filters.drms}            options={opts.drm_cats         ?? []} onChange={v => set('drms', v)} />
        <SearchMultiSelect
          label="Channel Partner"
          selected={cpExcludeMode ? cpExcluded : filters.channel_partners}
          options={opts.channel_partners ?? []}
          onChange={handleCpChange}
          excludeMode={cpExcludeMode}
          onExcludeModeChange={handleCpModeChange}
        />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">Search</label>
          <input value={filters.search} onChange={e => set('search', e.target.value)}
            placeholder="Opp ID / Account…"
            className="border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">Deal Type</label>
          <div className="flex gap-1.5">
            {[
              { val: '',       label: 'All' },
              { val: 'single', label: '🎯 Single Bag' },
              { val: 'basket', label: '🧺 Basket Deal' },
            ].map(({ val, label }) => (
              <button key={val}
                onClick={() => set('deal_type', val)}
                className={`px-2.5 py-1 text-[12px] font-medium rounded-lg border transition ${
                  filters.deal_type === val
                    ? 'bg-sap-blue text-white border-sap-blue'
                    : 'border-sap-border text-sap-muted hover:border-sap-blue hover:text-sap-blue bg-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <MultiSelect label="Priority"
          selected={filters.priorities}
          options={['1','2','3','4','5','6','7','8','9','10']}
          onChange={v => set('priorities', v)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide">Probability %</label>
          <div className="flex items-center gap-1">
            <input
              type="number" min="0" max="100" placeholder="Min"
              value={filters.probability_min}
              onChange={e => set('probability_min', e.target.value)}
              className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue"
            />
            <span className="text-sap-muted text-[11px]">–</span>
            <input
              type="number" min="0" max="100" placeholder="Max"
              value={filters.probability_max}
              onChange={e => set('probability_max', e.target.value)}
              className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-sap-blue"
            />
          </div>
        </div>

        <SearchMultiSelect label="IAE"              selected={filters.iaes}             options={opts.iaes             ?? []} onChange={v => set('iaes', v)} />
        <SearchMultiSelect label="SPEC CX"          selected={filters.spec_cxs}         options={opts.spec_cxs         ?? []} onChange={v => set('spec_cxs', v)} />
        <SearchMultiSelect label="SPEC HXM"         selected={filters.spec_hxms}        options={opts.spec_hxms        ?? []} onChange={v => set('spec_hxms', v)} />
        <SearchMultiSelect label="SPEC Procurement" selected={filters.spec_procurements} options={opts.spec_procurements ?? []} onChange={v => set('spec_procurements', v)} />
        <SearchMultiSelect label="SPEC DSC"         selected={filters.spec_dscs}        options={opts.spec_dscs        ?? []} onChange={v => set('spec_dscs', v)} />
        <SearchMultiSelect label="SPEC BTP"         selected={filters.spec_btps}        options={opts.spec_btps        ?? []} onChange={v => set('spec_btps', v)} />
        <SearchMultiSelect label="SPEC BDC"         selected={filters.spec_bdcs}        options={opts.spec_bdcs        ?? []} onChange={v => set('spec_bdcs', v)} />
        <SearchMultiSelect label="SPEC FIN"         selected={filters.spec_fins}        options={opts.spec_fins        ?? []} onChange={v => set('spec_fins', v)} />
        <SearchMultiSelect label="SPEC PRO"         selected={filters.spec_pros}        options={opts.spec_pros        ?? []} onChange={v => set('spec_pros', v)} />

        {hasAny && (
          <div className="flex flex-col justify-end">
            <button onClick={clear}
              className="border border-sap-border rounded-lg px-3 py-1.5 text-[12px] text-sap-muted hover:bg-sap-bg transition">
              Clear all
            </button>
          </div>
        )}
      </FilterGrid>
    </FilterBar>
  )
}
