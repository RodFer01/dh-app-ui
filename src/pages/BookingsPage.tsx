// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { MultiSelect, SearchMultiSelect } from '../components/MultiSelect'
import { formatAcvK } from '../lib/utils'

interface Booking {
  opportunity_id: string
  account_name: string
  opp_description: string
  region_lvl3: string
  solution_area_l1: string
  sub_solution_area_l2: string
  closing_date: string
  closing_qtr: string
  acv_total_opp: number
  opp_owner_name: string
  vat_dh: string
  vat_full: string
  sde_primary_engagement_name: string
  sde_current_territory_owner: string
  flsm: string
}

function parsePeople(csv: string): string[] {
  return (csv || '').split(',').map(s => s.trim()).filter(Boolean)
}

const fmtCurrency = (n: number): string => formatAcvK(n, 'USD')

function fmtDate(s: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function PersonBadge({ name }: { name: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return (
    <div className="inline-flex items-center gap-1.5 bg-white border border-sap-border rounded-full px-2.5 py-0.5">
      <div className="w-5 h-5 rounded-full bg-sap-blue text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <span className="text-[12px] text-sap-text font-medium">{name}</span>
    </div>
  )
}

function TeamRow({ title, people, titleCls }: { title: string; people: string[]; titleCls: string }) {
  if (!people.length) return null
  return (
    <div>
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${titleCls}`}>{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {people.map(p => <PersonBadge key={p} name={p} />)}
      </div>
    </div>
  )
}

function BookingCard({ b }: { b: Booking }) {
  const dsas = parsePeople(b.vat_dh)
  const vatAll = parsePeople(b.vat_full)
  const dsaSet = new Set(dsas.map(s => s.toLowerCase()))
  const dvas = vatAll.filter(s => !dsaSet.has(s.toLowerCase()))
  const sds = b.opp_owner_name ? [b.opp_owner_name] : []
  const sdes = [b.sde_primary_engagement_name, b.sde_current_territory_owner]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="bg-white border border-sap-border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Account + ACV */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-sap-text leading-snug">{b.account_name}</div>
          {b.opp_description && (
            <div className="text-[12px] text-sap-muted mt-0.5 line-clamp-2">{b.opp_description}</div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[22px] font-black text-sap-blue leading-none">{fmtCurrency(b.acv_total_opp)}</div>
          <div className="text-[10px] text-sap-muted mt-0.5">ACV</div>
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {b.solution_area_l1 && <Chip label={b.solution_area_l1} cls="bg-sap-blue-l text-sap-blue" />}
        {b.sub_solution_area_l2 && <Chip label={b.sub_solution_area_l2} cls="bg-indigo-50 text-indigo-700" />}
        {b.region_lvl3 && <Chip label={b.region_lvl3} cls="bg-emerald-50 text-emerald-700" />}
        {b.closing_qtr && <Chip label={b.closing_qtr} cls="bg-amber-50 text-amber-700" />}
      </div>

      {/* Date */}
      {b.closing_date && (
        <div className="text-[12px] text-sap-muted">
          <span className="font-semibold text-sap-text">Fechado em:</span> {fmtDate(b.closing_date)}
        </div>
      )}

      {/* Team */}
      <div className="border-t border-sap-border pt-3 flex flex-col gap-3">
        <TeamRow title="Sales Development" people={sds} titleCls="text-violet-600" />
        <TeamRow title="Digital Solution Advisors" people={dsas} titleCls="text-sap-blue" />
        <TeamRow title="Digital Value Advisors" people={dvas} titleCls="text-teal-600" />
        <TeamRow title="Solution Dev. Exec. (SDE)" people={sdes} titleCls="text-orange-600" />
      </div>
    </div>
  )
}

const SHADOW_DRM_COLOR: Record<string, string> = {
  'Disc/Lost':              'bg-red-100 text-red-700',
  'Exclude from Pipeline':  'bg-orange-100 text-orange-700',
  'Partner Upside':         'bg-yellow-100 text-yellow-700',
  'Partner Forecasted':     'bg-amber-100 text-amber-700',
}

function ShadowOppsTab({ fOpts }: { fOpts: any }) {
  const qc = useQueryClient()
  const [sf, setSf] = useState({ closing_qtrs: [] as string[], regions: [] as string[], sol_l1s: [] as string[] })
  const [localComments, setLocalComments] = useState<Record<string, string>>({})

  const sfParams = new URLSearchParams()
  sf.closing_qtrs.forEach(v => sfParams.append('closing_qtrs', v))
  sf.regions.forEach(v => sfParams.append('regions', v))
  sf.sol_l1s.forEach(v => sfParams.append('sol_l1s', v))

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['shadow-opps', sf],
    queryFn: () => api.get(`/api/pipeline/bookings/shadow-opps?${sfParams}`).then(r => r.data),
  })

  const { data: savedComments = {} } = useQuery({
    queryKey: ['shadow-comments'],
    queryFn: () => api.get('/api/pipeline/bookings/shadow-comments').then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: ({ closedId, shadowId, comment, corregir }: any) =>
      api.put(`/api/pipeline/bookings/shadow-comments/${closedId}/${shadowId}`, { comment, corregir }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shadow-comments'] }),
  })

  const getKey = (row: any) => `${row.closed_opp_id}|${row.shadow_opp_id}`
  const getSaved = (row: any) => savedComments[getKey(row)] ?? { comment: '', corregir: 0 }

  return (
    <div>
      {/* Shadow filters */}
      <div className="bg-white border border-sap-border rounded-xl p-4 mb-4 flex gap-3">
        <MultiSelect label="Quarter"     selected={sf.closing_qtrs} options={fOpts.closing_qtrs ?? []} onChange={v => setSf(p => ({...p, closing_qtrs: v}))} />
        <MultiSelect label="Região"      selected={sf.regions}      options={fOpts.regions ?? []}      onChange={v => setSf(p => ({...p, regions: v}))} />
        <MultiSelect label="Solution L1" selected={sf.sol_l1s}      options={fOpts.sol_l1s ?? []}      onChange={v => setSf(p => ({...p, sol_l1s: v}))} />
      </div>

      {isLoading ? (
        <div className="text-sm text-sap-muted text-center py-16">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-sap-muted text-center py-16">Nenhum resultado encontrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#f0f4f8] text-[11px] font-semibold uppercase tracking-wide text-[#556b82]">
                <th className="p-2 text-left border-b border-sap-border">Opp Fechada</th>
                <th className="p-2 text-left border-b">Conta</th>
                <th className="p-2 text-left border-b">Descrição (fechada)</th>
                <th className="p-2 text-left border-b">Sol L1</th>
                <th className="p-2 text-right border-b">ACV Fechado</th>
                <th className="p-2 text-left border-b border-l-2 border-l-sap-blue">Opp Shadow</th>
                <th className="p-2 text-left border-b">Descrição (shadow)</th>
                <th className="p-2 text-left border-b">DRM Shadow</th>
                <th className="p-2 text-left border-b">DSA no VAT</th>
                <th className="p-2 text-right border-b">ACV Shadow</th>
                <th className="p-2 text-center border-b">Incluir</th>
                <th className="p-2 text-left border-b">Por quê incluir</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const key = getKey(row)
                const saved = getSaved(row)
                const included = !!saved.corregir
                const commentVal = localComments[key] ?? saved.comment ?? ''
                return (
                  <tr key={key} className={`border-b border-sap-border ${included ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                    <td className="p-2 font-mono text-[11px] text-sap-blue">{row.closed_opp_id}</td>
                    <td className="p-2 font-medium">{row.account_name}</td>
                    <td className="p-2 text-sap-muted max-w-[160px]"><div className="line-clamp-2">{row.closed_description}</div></td>
                    <td className="p-2">{row.closed_sol_l1}</td>
                    <td className="p-2 text-right font-semibold">{fmtCurrency(row.closed_acv)}</td>
                    <td className="p-2 font-mono text-[11px] text-sap-blue border-l-2 border-l-sap-blue">{row.shadow_opp_id}</td>
                    <td className="p-2 text-sap-muted max-w-[160px]"><div className="line-clamp-2">{row.shadow_description}</div></td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SHADOW_DRM_COLOR[row.shadow_drm] ?? 'bg-gray-100 text-gray-600'}`}>
                        {row.shadow_drm}
                      </span>
                    </td>
                    <td className="p-2 text-sap-muted">{row.shadow_vat_dh || '—'}</td>
                    <td className="p-2 text-right font-semibold">{fmtCurrency(row.shadow_acv)}</td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => saveMut.mutate({ closedId: row.closed_opp_id, shadowId: row.shadow_opp_id, comment: commentVal, corregir: included ? 0 : 1 })}
                        className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${included ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-sap-blue hover:text-sap-blue'}`}
                      >
                        {included ? 'Incluído' : 'Incluir'}
                      </button>
                    </td>
                    <td className="p-2">
                      <textarea
                        className="w-full text-[11px] border border-sap-border rounded p-1 resize-none bg-transparent focus:outline-none focus:border-sap-blue"
                        rows={2}
                        maxLength={200}
                        placeholder="Motivo..."
                        value={commentVal}
                        onChange={e => setLocalComments(p => ({...p, [key]: e.target.value}))}
                        onBlur={e => saveMut.mutate({ closedId: row.closed_opp_id, shadowId: row.shadow_opp_id, comment: e.target.value, corregir: saved.corregir })}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function BookingsPage() {
  const [activeTab, setActiveTab] = useState<'bookings' | 'shadow'>('bookings')
  const [filters, setFilters] = useState({
    closing_qtrs: [] as string[],
    regions: [] as string[],
    sol_l1s: [] as string[],
    sol_l2s: [] as string[],
    dsas: [] as string[],
    dvas: [] as string[],
    teams: [] as string[],
  })
  const setF = (k: keyof typeof filters, v: string[]) =>
    setFilters(f => ({ ...f, [k]: v }))

  const { data: fOpts = {} } = useQuery({
    queryKey: ['bookings-filters'],
    queryFn: () => api.get('/api/pipeline/bookings/filters').then(r => r.data),
  })

  const params = new URLSearchParams()
  filters.closing_qtrs.forEach(v => params.append('closing_qtrs', v))
  filters.regions.forEach(v => params.append('regions', v))
  filters.sol_l1s.forEach(v => params.append('sol_l1s', v))
  filters.sol_l2s.forEach(v => params.append('sol_l2s', v))
  filters.dsas.forEach(v => params.append('dsas', v))
  filters.dvas.forEach(v => params.append('dvas', v))
  filters.teams.forEach(v => params.append('teams', v))

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => api.get(`/api/pipeline/bookings?${params}`).then(r => r.data),
  })

  const hasFilters = Object.values(filters).some(v => v.length > 0)

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-black text-sap-text tracking-tight">Bookings</h1>
          <p className="text-[13px] text-sap-muted mt-0.5">
            {activeTab === 'bookings'
              ? (isLoading ? 'Carregando...' : `${bookings.length} oportunidade(s) fechada(s)`)
              : 'Oportunidades shadow — fechadas sem Digital SA com deals abertos em risco no mesmo cliente'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['bookings', 'shadow'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${activeTab === tab ? 'bg-white shadow text-sap-blue' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab === 'bookings' ? 'Bookings' : 'Shadow Opps'}
              </button>
            ))}
          </div>
          {hasFilters && activeTab === 'bookings' && (
            <button
              onClick={() => setFilters({ closing_qtrs: [], regions: [], sol_l1s: [], sol_l2s: [], dsas: [], dvas: [], teams: [] })}
              className="text-[12px] text-sap-blue hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Filters + Cards — Bookings tab */}
      {activeTab === 'bookings' && (<>
        <div className="bg-white border border-sap-border rounded-xl p-4 mb-6 flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-3">
            <MultiSelect label="Quarter"     selected={filters.closing_qtrs} options={fOpts.closing_qtrs ?? []} onChange={v => setF('closing_qtrs', v)} />
            <MultiSelect label="Região"      selected={filters.regions}      options={fOpts.regions ?? []}      onChange={v => setF('regions', v)} />
            <MultiSelect label="Solution L1" selected={filters.sol_l1s}      options={fOpts.sol_l1s ?? []}      onChange={v => setF('sol_l1s', v)} />
            <MultiSelect label="Solution L2" selected={filters.sol_l2s}      options={fOpts.sol_l2s ?? []}      onChange={v => setF('sol_l2s', v)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MultiSelect       label="Team" selected={filters.teams} options={fOpts.teams ?? []} onChange={v => setF('teams', v)} />
            <SearchMultiSelect label="DSA"  selected={filters.dsas}  options={fOpts.dsas ?? []}  onChange={v => setF('dsas', v)} />
            <SearchMultiSelect label="DVA"  selected={filters.dvas}  options={fOpts.dvas ?? []}  onChange={v => setF('dvas', v)} />
          </div>
        </div>
        {isLoading ? (
          <div className="text-sm text-sap-muted text-center py-16">Carregando...</div>
        ) : bookings.length === 0 ? (
          <div className="text-sm text-sap-muted text-center py-16">Nenhum resultado encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(bookings as Booking[]).map(b => <BookingCard key={b.opportunity_id} b={b} />)}
          </div>
        )}
      </>)}

      {/* Shadow Opportunities tab */}
      {activeTab === 'shadow' && <ShadowOppsTab fOpts={fOpts} />}
    </div>
  )
}
