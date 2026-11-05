// @ts-nocheck
import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../lib/api'
import { formatAcvK } from '../lib/utils'

export const QUAL_OPTIONS = ['','GO','No-Go','Re-Qualify','In Qualification','Qualified','De-qualified']
export const PS_OPTIONS   = ['','Engaged','Not Engaged','Monitoring','Escalated','Closed']

export const BLANK_NOTE_FORM = {
  deal_qual_status:'', presales_status_override:'',
  presales_comments:'', next_actions:'', next_actions_date:'',
  stage:'', risk:'', next_step:'', next_step_date:'', blockers:'', notes:'',
  digital_asset:'',
  melody_engagement:'', pre_allocated_dsa:'', melody_comments:'',
  todo_status:'', todo_completion_comments:'',
}

export function OppDetailPanel({
  opp,
  noteForm,
  setNoteForm,
  saveMut,
  onClose,
  currency,
  fx,
  QUAL = QUAL_OPTIONS,
  PS   = PS_OPTIONS,
  onSessionsChange = null,
}) {
  const { data: sparkSessions = [] } = useQuery({
    queryKey: ['spark-opp', opp.solution_area_l1, opp.region_lvl3],
    queryFn: () => api.get('/api/spark/sessions/for-opp', {
      params: { sol_l1: opp.solution_area_l1, region: opp.region_lvl3 || '' }
    }).then(r => r.data),
    enabled: !!opp.solution_area_l1,
  })

  const { data: melodyReqs = [] } = useQuery({
    queryKey: ['mr-opp', opp.opportunity_id],
    queryFn: () => api.get(`/api/melody-requests/by-opportunity/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp.opportunity_id,
  })

  const { data: melodyActivities = [] } = useQuery({
    queryKey: ['melody-opp', opp.opportunity_id],
    queryFn: () => api.get(`/api/melody/by-opportunity/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp.opportunity_id,
  })

  const { data: mrCommentsFlat = [] } = useQuery({
    queryKey: ['mr-comments-opp', opp.opportunity_id],
    queryFn: () => api.get(`/api/melody-requests/comments-by-opportunity/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp.opportunity_id,
  })

  const commentsByReq = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const c of mrCommentsFlat) {
      if (!map[c.req_id_sub]) map[c.req_id_sub] = []
      map[c.req_id_sub].push(c)
    }
    return map
  }, [mrCommentsFlat])

  const combinedTimeline = useMemo(() => {
    const acts = (melodyActivities as any[]).map(a => ({ _kind: 'activity', _date: a.activity_date || '', ...a }))
    const reqs = (melodyReqs as any[]).map(r => ({ _kind: 'mr', _date: r.req_create_date || '', ...r }))
    return [...acts, ...reqs].sort((a, b) => {
      if (!a._date) return 1
      if (!b._date) return -1
      return b._date.localeCompare(a._date)
    })
  }, [melodyActivities, melodyReqs])

  const { data: oppLines = [] } = useQuery({
    queryKey: ['opp-lines', opp.opportunity_id],
    queryFn: () => api.get(`/api/pipeline/${opp.opportunity_id}`).then(r => r.data),
    enabled: !!opp.opportunity_id,
    staleTime: 5 * 60_000,
  })

  const { data: presalesData = null } = useQuery({
    queryKey: ['presales-opp', opp.opportunity_id],
    queryFn: () => api.get(`/api/notes/presales/${opp.opportunity_id}`).then(r => r.data).catch(() => null),
    enabled: !!opp.opportunity_id,
    staleTime: 5 * 60_000,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['notes-history', opp.opportunity_id],
    queryFn: () => api.get(`/api/notes/${opp.opportunity_id}/history`).then(r => r.data),
    enabled: !!opp.opportunity_id,
  })

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo]     = useState('')
  const [emailCc, setEmailCc]     = useState('')
  const [selSessions, setSelSessions]   = useState([])
  const [contactRows, setContactRows]   = useState([{ name: '', contact: '' }])

  const toggleSession = (id) => {
    setSelSessions(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (onSessionsChange) {
        onSessionsChange(opp.opportunity_id, sparkSessions.filter(s => next.includes(s.id)))
      }
      return next
    })
  }

  const sendEmailMut = useMutation({
    mutationFn: (payload) => api.post('/api/email/send', payload),
    onSuccess: () => setEmailOpen(false),
  })

  const buildEmailHtml = () => {
    const sessions = sparkSessions.filter(s => selSessions.includes(s.id))
    const sessionsTable = sessions.length > 0 ? `
<h3 style="color:#0070f2;margin-top:24px;">Spark Meeting Sessions</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
  <thead style="background:#0070f2;color:white;">
    <tr><th>Session</th><th>Area</th><th>Audience</th><th>Language</th><th>Next Date</th></tr>
  </thead>
  <tbody>${sessions.map(s => `<tr><td><b>${s.title}</b></td><td>${s.area}</td><td>${s.audience}</td><td>${s.language}</td><td>${s.next_date || 'TBD'}</td></tr>`).join('')}</tbody>
</table>` : ''
    const contactTable = contactRows.filter(r => r.name || r.contact).length > 0 ? `
<h3 style="color:#0070f2;margin-top:24px;">Account Contacts</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
  <thead style="background:#f8f9fa;"><tr><th>Contact Name</th><th>Contact Details</th></tr></thead>
  <tbody>${contactRows.filter(r => r.name || r.contact).map(r => `<tr><td>${r.name}</td><td>${r.contact}</td></tr>`).join('')}</tbody>
</table>` : ''
    return `<div style="font-family:Inter,sans-serif;font-size:14px;color:#32363a;">
<h2 style="color:#0070f2;">Pipeline Review — ${opp.account_name}</h2>
<table border="0" cellpadding="4" cellspacing="0" style="font-size:13px;margin-bottom:16px;">
  <tr><td style="color:#758ca4;width:160px;">Opportunity #</td><td><b>${opp.opportunity_id}</b></td></tr>
  <tr><td style="color:#758ca4;">Account</td><td><b>${opp.account_name}</b></td></tr>
  <tr><td style="color:#758ca4;">Description</td><td>${opp.opp_description || '—'}</td></tr>
  <tr><td style="color:#758ca4;">Solution</td><td>${opp.solution_area_l1 || '—'} › ${opp.sub_solution_area_l2 || '—'}</td></tr>
  <tr><td style="color:#758ca4;">Closing Qtr</td><td>${opp.closing_qtr || '—'}</td></tr>
  <tr><td style="color:#758ca4;">Deal Qualification</td><td><b>${noteForm.deal_qual_status || '—'}</b></td></tr>
  <tr><td style="color:#758ca4;">Presales Status</td><td>${noteForm.presales_status_override || '—'}</td></tr>
  <tr><td style="color:#758ca4;">Comments</td><td>${noteForm.presales_comments || '—'}</td></tr>
  <tr><td style="color:#758ca4;">Next Actions</td><td>${noteForm.next_actions || '—'}</td></tr>
  <tr><td style="color:#758ca4;">Next Action Date</td><td>${noteForm.next_actions_date || '—'}</td></tr>
</table>
${sessionsTable}
${contactTable}
</div>`
  }

  return (
    <div className="card p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[13px] font-bold text-sap-text">{opp.account_name}</div>
          <div className="text-[11px] text-sap-muted">{opp.opportunity_id} · {opp.opp_description}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEmailOpen(e => !e)}
            className="flex items-center gap-1.5 text-[11px] font-semibold bg-sap-blue text-white rounded-lg px-2.5 py-1.5 hover:bg-sap-blue-d transition">
            ✉ Email
          </button>
          <button onClick={onClose}
            className="text-sap-muted hover:text-sap-text text-[11px] border border-sap-border rounded-lg px-2.5 py-1.5 hover:bg-sap-bg transition">
            ✕ Close
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-3 gap-3">

        {/* COL 1 — Opp Info */}
        <div className="space-y-1.5 text-[12px] p-3 bg-sap-bg rounded-lg overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-2">Opportunity Info</div>
          <p><span className="text-sap-muted">Owner:</span> {opp.opp_owner_name || '—'}</p>
          <p><span className="text-sap-muted">Phase:</span> {opp.opp_phase || '—'}</p>
          <p><span className="text-sap-muted">Closing:</span> {opp.closing_qtr || '—'}</p>
          <p><span className="text-sap-muted">DRM:</span> {opp.drm_category || '—'}</p>
          <p><span className="text-sap-muted">ACV:</span> {formatAcvK((opp.acv_total_opp || opp.acv_usd || 0) * fx, currency)}</p>
          <p><span className="text-sap-muted">Engagement:</span> {opp.engagement_type || '—'}</p>
          <p><span className="text-sap-muted">Digital SA:</span> {opp.vat_dh || '—'}</p>
          <p><span className="text-sap-muted">Region:</span> {opp.region_lvl3 || '—'}</p>
          {opp.channel_partner && <p><span className="text-sap-muted">Partner:</span> {opp.channel_partner}</p>}
          {opp.deal_qualification_decision && (
            <p><span className="text-sap-muted">Deal Qual:</span>{' '}
              <span className={`font-semibold ${opp.deal_qualification_decision === 'Go' ? 'text-sap-success' : opp.deal_qualification_decision === 'No Go' ? 'text-sap-error' : 'text-sap-warning'}`}>
                {opp.deal_qualification_decision}
              </span>
              {opp.deal_qualification_score ? <span className="text-sap-muted ml-1">({opp.deal_qualification_score})</span> : null}
            </p>
          )}
          {opp.presales_lead_status && <p><span className="text-sap-muted">Presales Status:</span> {opp.presales_lead_status}</p>}

          {presalesData?.presales_lead_comments && (
            <div className="mt-2 pt-2 border-t border-sap-border">
              <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-1">Presales Comments</div>
              <p className="text-[11px] text-sap-text whitespace-pre-wrap bg-white rounded px-2 py-1.5 border border-sap-border">
                {presalesData.presales_lead_comments}
              </p>
            </div>
          )}

          {oppLines.length > 0 && (
            <div className="mt-2 pt-2 border-t border-sap-border">
              <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-1.5">
                Solutions ({oppLines.length} line{oppLines.length !== 1 ? 's' : ''})
              </div>
              <div className="space-y-1">
                {oppLines.map((line: any, i: number) => (
                  <div key={i} className="text-[11px] bg-white rounded px-2 py-1 border border-sap-border">
                    <div className="font-semibold text-sap-text truncate">{line.solution_area_l1 || '—'}</div>
                    {line.sub_solution_area_l2 && (
                      <div className="text-sap-muted truncate">↳ {line.sub_solution_area_l2}</div>
                    )}
                    {line.acv_usd > 0 && (
                      <div className="text-sap-blue text-[10px] font-medium mt-0.5">
                        {formatAcvK((line.acv_usd || 0) * fx, currency)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* COL 2 — Presales Edit */}
        <div>
          <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-2">Presales Assessment</div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Deal Qualification Status</label>
              <select value={noteForm.deal_qual_status} onChange={e => setNoteForm(f => ({ ...f, deal_qual_status: e.target.value }))}
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue">
                {QUAL.map(q => <option key={q} value={q}>{q || '—'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Presales Status</label>
              <select value={noteForm.presales_status_override} onChange={e => setNoteForm(f => ({ ...f, presales_status_override: e.target.value }))}
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue">
                {PS.map(p => <option key={p} value={p}>{p || '—'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Comments</label>
              <textarea value={noteForm.presales_comments} onChange={e => setNoteForm(f => ({ ...f, presales_comments: e.target.value }))}
                rows={4} placeholder="Add presales context, engagement notes, blockers…"
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue resize-none" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Next Actions</label>
              <textarea value={noteForm.next_actions} onChange={e => setNoteForm(f => ({ ...f, next_actions: e.target.value }))}
                rows={2} placeholder="Key next steps and owner…"
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue resize-none" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Next Action Date</label>
              <input type="date" value={noteForm.next_actions_date} onChange={e => setNoteForm(f => ({ ...f, next_actions_date: e.target.value }))}
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Digital Asset</label>
              <input type="text" value={noteForm.digital_asset || ''} onChange={e => setNoteForm(f => ({ ...f, digital_asset: e.target.value }))}
                placeholder="Ex: Digital Discovery, Joule Demo…"
                className="w-full border border-sap-border rounded-lg px-2 py-1.5 text-[12px] focus:outline-none focus:border-sap-blue" />
            </div>
            <button onClick={() => saveMut.mutate(noteForm)} disabled={saveMut.isPending}
              className="w-full bg-sap-blue hover:bg-sap-blue-d text-white font-semibold py-2 rounded-lg transition disabled:opacity-60 text-[12px]">
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </button>
            {saveMut.isSuccess && (
              <div className="text-center">
                <p className="text-sap-success text-[11px]">✓ Saved</p>
                {noteForm.author && (
                  <p className="text-[10px] text-sap-muted mt-0.5">
                    by {noteForm.author}{noteForm.updated_at ? ` · ${new Date(noteForm.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* COL 3 — Unified Melody Timeline (Activities + Requests) */}
        <div>
          <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            🎵 Melody Timeline
            <span className="font-normal normal-case">({combinedTimeline.length})</span>
          </div>

          {(opp?.sde_primary_engagement_name || opp?.sde_handover_date) && (
            <div className="mb-3 rounded-xl border p-2.5 text-[11px]"
              style={{
                background: opp?.sde_handover_date ? '#E8F5E9' : '#FFEBEE',
                borderColor: opp?.sde_handover_date ? '#43A047' : '#EF9A9A',
              }}>
              <div className="font-bold mb-1 flex items-center gap-1.5"
                style={{ color: opp?.sde_handover_date ? '#1B5E20' : '#BB0000' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%',
                  background: opp?.sde_handover_date ? '#43A047' : '#BB0000', display: 'inline-block' }} />
                SDE Engagement
              </div>
              {opp?.sde_primary_engagement_name && (
                <div><span className="text-sap-muted">Primary: </span><span className="font-semibold">{opp.sde_primary_engagement_name}</span></div>
              )}
              {opp?.sde_initial_engagement_date && (
                <div><span className="text-sap-muted">Start: </span><span>{opp.sde_initial_engagement_date}</span></div>
              )}
              {opp?.sde_handover_date ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span style={{ color: '#1B5E20', fontWeight: 700 }}>✓ Handover: </span>
                  <span>{opp.sde_handover_date}</span>
                  {opp?.sde_handover_name && <span className="text-sap-muted">· {opp.sde_handover_name}</span>}
                </div>
              ) : (
                <div className="mt-0.5" style={{ color: '#BB0000', fontWeight: 600 }}>⏳ Handover pending</div>
              )}
            </div>
          )}

          {combinedTimeline.length === 0 ? (
            <p className="text-[12px] text-sap-muted">No activities or requests recorded.</p>
          ) : (
            <div className="relative overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
              <div className="absolute left-[6px] top-0 bottom-0 w-0.5 bg-sap-border" />
              <div className="space-y-2.5 pl-1">
                {combinedTimeline.map((item: any, i: number) => {
                  if (item._kind === 'activity') {
                    const statusColor = item.activity_status === 'Completed' ? '#256f3a'
                      : item.activity_status === 'In Progress' ? '#0070f2' : '#E76500'
                    const dateLabel = item.activity_date
                      ? new Date(item.activity_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'
                    return (
                      <div key={`act-${i}`} className="flex gap-2 items-start">
                        <div className="w-3 h-3 rounded-full border-2 flex-shrink-0 mt-1 z-10 bg-white"
                          style={{ borderColor: statusColor }} />
                        <div className="flex-1 bg-sap-bg rounded-lg px-2.5 py-1.5 text-[11px]">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="font-semibold text-sap-text leading-tight">{item.activ_type || '—'}</span>
                            <span className="text-sap-subtle text-[10px] flex-shrink-0 whitespace-nowrap">{dateLabel}</span>
                          </div>
                          <div className="text-sap-muted truncate">{item.sa_name || '—'}</div>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                            style={{ background: statusColor + '22', color: statusColor }}>
                            {item.activity_status}
                          </span>
                          {item.notes && <p className="text-sap-subtle mt-1 text-[10px] line-clamp-2">{item.notes}</p>}
                        </div>
                      </div>
                    )
                  } else {
                    // MR Request item
                    const mrStatus = item.req_status_main
                    const statusColor = mrStatus === 'Closed' ? '#256f3a'
                      : mrStatus === 'In Review' ? '#0070f2' : '#E76500'
                    const dateLabel = item.req_create_date
                      ? new Date(item.req_create_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'
                    const comments: any[] = commentsByReq[item.req_id_sub] || []
                    return (
                      <div key={`mr-${i}`} className="flex gap-2 items-start">
                        <div className="w-3 h-3 rounded-full border-2 flex-shrink-0 mt-1 z-10 bg-white"
                          style={{ borderColor: statusColor, borderStyle: 'dashed' }} />
                        <div className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] border"
                          style={{ background: statusColor + '0d', borderColor: statusColor + '33' }}>
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="font-semibold text-sap-text leading-tight">{item.req_type || '—'}</span>
                            <span className="text-sap-subtle text-[10px] flex-shrink-0 whitespace-nowrap">{dateLabel}</span>
                          </div>
                          <div className="text-sap-muted truncate text-[10px]">
                            {[item.req_processor, item.req_task_owner].filter(Boolean).join(' · ') || '—'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block"
                              style={{ background: statusColor + '22', color: statusColor }}>
                              {mrStatus}
                            </span>
                            {item.sub_status && (
                              <span className="text-[10px] text-sap-muted">{item.sub_status}</span>
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wide text-sap-muted bg-white border border-sap-border rounded px-1 py-0.5 ml-auto">MR</span>
                          </div>
                          {comments.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-sap-border space-y-1.5">
                              {comments.map((c: any, ci: number) => {
                                const cDate = c.created_at
                                  ? (() => {
                                      try {
                                        return new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                      } catch { return c.created_at }
                                    })()
                                  : '—'
                                return (
                                  <div key={ci} className="text-[10px]">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className="font-semibold text-sap-blue">{c.author || 'Unknown'}</span>
                                      <span className="text-sap-subtle">{cDate}</span>
                                    </div>
                                    <p className="text-sap-text leading-snug">{c.body}</p>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            </div>
          )}
        </div>
      </div>{/* end 3-col */}

      {/* Notes History */}
      {history.length > 0 && (
        <div className="mt-4 border-t border-sap-border pt-3">
          <div className="text-[10px] font-bold text-sap-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            📋 History de Atualizações
            <span className="font-normal normal-case">({history.length} versions)</span>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {history.map((h: any, i: number) => {
              const d = h.data || {}
              const date = h.updated_at
                ? new Date(h.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <div key={h.id} className={`rounded-lg border px-3 py-2.5 text-[12px] ${i === 0 ? 'border-sap-blue bg-[#EBF5FB]' : 'border-sap-border bg-white'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {i === 0 && <span className="text-[10px] font-bold text-sap-blue bg-sap-blue-l px-1.5 py-0.5 rounded">Latest</span>}
                      <span className="font-semibold text-sap-text">{h.author || 'Unknown'}</span>
                    </div>
                    <span className="text-[11px] text-sap-muted">{date}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                    {d.presales_comments && (
                      <div className="col-span-2">
                        <span className="text-sap-muted">Comments: </span>
                        <span className="text-sap-text">{d.presales_comments}</span>
                      </div>
                    )}
                    {d.next_actions && (
                      <div className="col-span-2">
                        <span className="text-sap-muted">Next Actions: </span>
                        <span className="text-sap-text">{d.next_actions}</span>
                        {d.next_actions_date && <span className="text-sap-blue ml-1">→ {d.next_actions_date}</span>}
                      </div>
                    )}
                    {d.stage && <div><span className="text-sap-muted">Stage: </span><span>{d.stage}</span></div>}
                    {d.risk && <div><span className="text-sap-muted">Risk: </span><span>{d.risk}</span></div>}
                    {d.deal_qual_status && <div><span className="text-sap-muted">Qual: </span><span>{d.deal_qual_status}</span></div>}
                    {d.presales_status_override && <div><span className="text-sap-muted">PS Status: </span><span>{d.presales_status_override}</span></div>}
                    {d.digital_asset && <div><span className="text-sap-muted">Digital Asset: </span><span className="font-semibold text-sap-blue">{d.digital_asset}</span></div>}
                    {d.melody_engagement && (
                      <div className="col-span-2 mt-0.5 pt-0.5 border-t border-sap-border">
                        <span className="text-sap-muted">Melody: </span>
                        <span className="font-semibold">{d.melody_engagement}</span>
                        {d.pre_allocated_dsa && <span className="text-sap-muted"> · DSA: <span className="text-sap-text">{d.pre_allocated_dsa}</span></span>}
                        {d.melody_comments && <span className="text-sap-muted"> · {d.melody_comments}</span>}
                      </div>
                    )}
                    {d.blockers && (
                      <div className="col-span-2">
                        <span className="text-sap-muted">Blockers: </span>
                        <span className="text-sap-error">{d.blockers}</span>
                      </div>
                    )}
                    {d.notes && (
                      <div className="col-span-2">
                        <span className="text-sap-muted">Notes: </span>
                        <span className="text-sap-text">{d.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Email compose */}
      {emailOpen && (
        <div className="border-2 border-sap-blue rounded-xl p-4 mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-sap-blue mb-3">✉ Compose Email</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">To (AE email)</label>
              <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="ae@sap.com"
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue transition" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">CC (optional)</label>
              <input type="text" value={emailCc} onChange={e => setEmailCc(e.target.value)} placeholder="cc@sap.com"
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sap-blue transition" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] font-medium text-sap-muted uppercase tracking-wide block mb-1">Contacts (optional)</label>
            <table className="w-full text-[12px] border border-sap-border rounded-lg overflow-hidden">
              <thead><tr className="bg-[#f8f9fa]">
                <th className="px-2 py-1.5 text-left font-semibold text-sap-muted">Name</th>
                <th className="px-2 py-1.5 text-left font-semibold text-sap-muted">Contact</th>
                <th className="w-8" />
              </tr></thead>
              <tbody>
                {contactRows.map((row, i) => (
                  <tr key={i} className="border-t border-sap-border">
                    <td className="px-2 py-1.5">
                      <input value={row.name} onChange={e => setContactRows(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                        placeholder="Contact name"
                        className="w-full border border-sap-border rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-sap-blue" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.contact} onChange={e => setContactRows(prev => prev.map((r, j) => j === i ? { ...r, contact: e.target.value } : r))}
                        placeholder="email@company.com"
                        className="w-full border border-sap-border rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-sap-blue" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {contactRows.length > 1 && (
                        <button onClick={() => setContactRows(prev => prev.filter((_, j) => j !== i))} className="text-sap-error text-[11px] hover:opacity-70">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setContactRows(prev => [...prev, { name: '', contact: '' }])}
              className="mt-1.5 text-[11px] text-sap-blue hover:underline">+ Add row</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => sendEmailMut.mutate({
              to: emailTo, cc: emailCc,
              subject: `[Pipeline Review] ${opp.account_name} — ${opp.closing_qtr}`,
              body_html: buildEmailHtml(),
            })}
              disabled={!emailTo || sendEmailMut.isPending}
              className="flex-1 bg-sap-blue hover:bg-sap-blue-d text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60">
              {sendEmailMut.isPending ? 'Sending…' : '✉ Send Email'}
            </button>
            <button onClick={() => setEmailOpen(false)}
              className="px-5 border border-sap-border rounded-lg text-sm font-semibold text-sap-muted hover:bg-sap-bg transition">
              Cancel
            </button>
          </div>
          {sendEmailMut.isSuccess && <p className="text-sap-success text-sm text-center mt-2">✓ Email sent successfully</p>}
          {sendEmailMut.isError && <p className="text-sap-error text-sm text-center mt-2">⚠ Failed to send email</p>}
        </div>
      )}
    </div>
  )
}
