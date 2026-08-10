// @ts-nocheck
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useMsalOutlook } from '../lib/useMsalOutlook'
import { OutlookTokenBanner } from '../components/OutlookTokenBanner'

// ─── types ────────────────────────────────────────────────────────────────────
interface QC {
  qc: string; flsm: string; geo: string; lob: string
  sde: string; dsa_spoc: string; dva: string
  emails: Record<string, string>
}
interface Meeting {
  id?: number; qc: string; flsm: string; lob: string
  meeting_date: string; status: 'pending' | 'scheduled' | 'draft'
  event_id?: string; web_link?: string
  actual_date?: string; actual_time?: string
  attendees_rsvp?: { name: string; email: string; response: string }[]
}
interface PeriodConfig {
  start_date: string; end_date: string
  freq_days: number; duration_min: number; meet_time: string
}
interface EventStatus {
  id: string; subject: string; start: string; end: string
  webLink: string; isCancelled: boolean
  attendees: { name: string; email: string; type: string; response: string; time: string }[]
}

function qcKey(qc: QC) { return `${qc.qc}||${qc.flsm}||${qc.lob}` }

function guessEmail(name: string) {
  if (!name) return ''
  const p = name.trim().split(/\s+/)
  if (p.length < 2) return name.toLowerCase() + '@sap.com'
  return (p[0] + '.' + p[p.length - 1]).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]/g, '') + '@sap.com'
}

function fmtDate(ds: string) {
  if (!ds) return '—'
  const [y, m, d] = ds.split('-')
  return `${d}/${m}/${y}`
}

function getPeriodDates(p: PeriodConfig): string[] {
  const s = new Date(p.start_date + 'T00:00:00')
  const e = new Date(p.end_date + 'T00:00:00')
  const freq = p.freq_days || 20
  const dates: string[] = []
  let c = new Date(s)
  while (c <= e) {
    dates.push(c.toISOString().split('T')[0])
    c.setDate(c.getDate() + freq)
  }
  return dates
}

const RESPONSE_LABEL: Record<string, string> = {
  Accepted: '✅ Accepted',
  Declined: '❌ Declined',
  TentativelyAccepted: '⚠️ Tentative',
  None: '⏳ No response',
  notResponded: '⏳ No response',
}
const RESPONSE_COLOR: Record<string, string> = {
  Accepted: '#256f3a',
  Declined: '#BB0000',
  TentativelyAccepted: '#E76500',
  None: '#788fa6',
  notResponded: '#788fa6',
}

// ─── sub-components ──────────────────────────────────────────────────────────

function RsvpBadges({ rsvp }: { rsvp: { name: string; response: string }[] }) {
  if (!rsvp || rsvp.length === 0) return null
  const counts = { Accepted: 0, Declined: 0, None: 0, TentativelyAccepted: 0 }
  for (const a of rsvp) {
    const r = a.response || 'None'
    if (r in counts) counts[r as keyof typeof counts]++
    else counts.None++
  }
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {counts.Accepted > 0 && (
        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: '.6rem', fontWeight: 700, background: '#d4edda', color: '#256f3a' }} title="Accepted">
          ✓{counts.Accepted}
        </span>
      )}
      {counts.Declined > 0 && (
        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: '.6rem', fontWeight: 700, background: '#fde8e8', color: '#BB0000' }} title="Declined">
          ✕{counts.Declined}
        </span>
      )}
      {counts.TentativelyAccepted > 0 && (
        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: '.6rem', fontWeight: 700, background: '#fff3cd', color: '#856404' }} title="Tentative">
          ?{counts.TentativelyAccepted}
        </span>
      )}
      {counts.None > 0 && (
        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: '.6rem', fontWeight: 700, background: '#f0f0f0', color: '#788fa6' }} title="No response">
          ⏳{counts.None}
        </span>
      )}
    </div>
  )
}

function Toast({ msg, type, onDone }: { msg: string; type: string; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [msg])
  if (!msg) return null
  const bg = type === 'success' ? '#256f3a' : type === 'error' ? '#BB0000' : '#32363A'
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      background: bg, color: '#fff', padding: '.75rem 1.25rem',
      borderRadius: '.625rem', fontSize: '.8125rem', zIndex: 2000,
    }} dangerouslySetInnerHTML={{ __html: msg }} />
  )
}

function Badge({ ok, scheduled, draft, total }: { ok: boolean; scheduled: number; draft: number; total: number }) {
  const cls = ok ? { bg: '#e8f5e9', color: '#256f3a' } : scheduled > 0 ? { bg: '#fff3e0', color: '#E76500' } : draft > 0 ? { bg: '#e8f0fe', color: '#1a73e8' } : { bg: '#ffebee', color: '#BB0000' }
  return (
    <span style={{ padding: '2px 9px', borderRadius: '.75rem', fontSize: '.6875rem', fontWeight: 700, background: cls.bg, color: cls.color }}>
      {ok ? '✓ All Scheduled' : draft > 0 && scheduled === 0 ? `${draft}/${total} draft` : `${scheduled}/${total} scheduled`}
    </span>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function PipelineSchedulerPage() {
  const qc2 = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Outlook token via MSAL (auto-renew, no manual copy/paste) ──────────────
  const outlook = useMsalOutlook()

  function outlookHeaders() {
    return outlook.tokenHeaders ? outlook.tokenHeaders() : {}
  }

  // ── local UI state
  const [tab, setTab] = useState<'qc-list' | 'calendar' | 'summary'>('qc-list')
  const [filterGeo, setFilterGeo] = useState('')
  const [filterLob, setFilterLob] = useState('')
  const [filterFlsm, setFilterFlsm] = useState('')
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [modal, setModal] = useState<{ qc: QC; dateIdx: number; dates: string[] } | null>(null)
  const [modalDate, setModalDate] = useState('')
  const [modalTime, setModalTime] = useState('10:00')
  const [modalDur, setModalDur] = useState(60)
  const [modalTitle, setModalTitle] = useState('')
  const [modalNotes, setModalNotes] = useState('')
  const [modalEmails, setModalEmails] = useState<Record<string, string>>({})
  const [statusPanel, setStatusPanel] = useState<EventStatus | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string }>({ msg: '', type: '' })
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ msg: string; type: 'idle' | 'loading' | 'success' | 'error' }>({ msg: '', type: 'idle' })
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearStatus, setClearStatus] = useState<{ msg: string; type: 'idle' | 'loading' | 'success' | 'error' }>({ msg: '', type: 'idle' })
  const [confirmDraft, setConfirmDraft] = useState<{ meeting: Meeting; attendees: { role: string; name: string; email: string }[] } | null>(null)
  const [syncResult, setSyncResult] = useState<{ updated: any[]; not_found_in_db: any[]; skipped: any[]; outlook_events_found: number } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const showToast = (msg: string, type = '') => setToast({ msg, type })

  const clearQCsMut = useMutation({
    mutationFn: () => api.delete('/api/scheduler/quota-carriers').then(r => r.data),
    onMutate: () => setClearStatus({ msg: 'Deleting records…', type: 'loading' }),
    onSuccess: (data) => {
      setClearStatus({ msg: `✓ ${data.deleted} QCs removed successfully`, type: 'success' })
      setClearConfirm(false)
      refetchQCs()
      setTimeout(() => setClearStatus({ msg: '', type: 'idle' }), 4000)
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail || e?.message || 'Error desconhecido'
      setClearStatus({ msg: `✗ Error: ${detail}`, type: 'error' })
    },
  })

  // ── server state
  const { data: periodData, refetch: refetchPeriod } = useQuery({
    queryKey: ['scheduler-period'],
    queryFn: () => api.get('/api/scheduler/period').then(r => r.data as PeriodConfig),
  })
  const period: PeriodConfig = periodData || {
    start_date: '2026-07-01', end_date: '2026-12-10',
    freq_days: 20, duration_min: 60, meet_time: '10:00',
  }

  const { data: filters } = useQuery({
    queryKey: ['scheduler-filters'],
    queryFn: () => api.get('/api/scheduler/quota-carriers/filters').then(r => r.data),
  })

  const { data: qcData, refetch: refetchQCs } = useQuery({
    queryKey: ['scheduler-qcs', filterGeo, filterLob, filterFlsm],
    queryFn: () => {
      const p: Record<string, string> = {}
      if (filterGeo)  p.geo  = filterGeo
      if (filterLob)  p.lob  = filterLob
      if (filterFlsm) p.flsm = filterFlsm
      return api.get('/api/scheduler/quota-carriers', { params: p }).then(r => r.data.quota_carriers as QC[])
    },
  })
  const qcs: QC[] = qcData || []

  const { data: emailMapData, refetch: refetchEmails } = useQuery({
    queryKey: ['scheduler-emails'],
    queryFn: () => api.get('/api/scheduler/emails').then(r => r.data as Record<string, string>),
  })
  const emailMap: Record<string, string> = emailMapData || {}

  const { data: meetingsData, refetch: refetchMeetings } = useQuery({
    queryKey: ['scheduler-meetings'],
    queryFn: () => api.get('/api/scheduler/meetings').then(r => r.data as Meeting[]),
  })

  // ── meetings indexed by key
  const meetingsIndex = useMemo(() => {
    const idx: Record<string, Meeting[]> = {}
    if (!meetingsData) return idx
    for (const m of meetingsData) {
      const k = `${m.qc}||${m.flsm}||${m.lob}`
      if (!idx[k]) idx[k] = []
      idx[k].push(m)
    }
    return idx
  }, [meetingsData])

  const periodDates = useMemo(() => getPeriodDates(period), [period])

  function getMeetingsForQC(qc: QC): (Meeting & { isNew?: boolean; isExtra?: boolean })[] {
    const k = qcKey(qc)
    const allMeetings = meetingsIndex[k] || []

    const byMeetingDate = new Map(allMeetings.map(m => [m.meeting_date, m]))
    const byActualDate  = new Map(allMeetings.filter(m => m.actual_date).map(m => [m.actual_date!, m]))

    // Build the period slot list — prefer DB record matched by meeting_date or actual_date
    const usedIds = new Set<number>()
    const periodRows = periodDates.map(d => {
      const m = byMeetingDate.get(d) || byActualDate.get(d)
      if (m?.id) usedIds.add(m.id)
      return m || { qc: qc.qc, flsm: qc.flsm, lob: qc.lob, meeting_date: d, status: 'pending' as const, isNew: true }
    })

    // Add scheduled/draft meetings whose dates fall outside the period slots (e.g. rescheduled)
    const extras = allMeetings
      .filter(m => (m.status === 'scheduled' || m.status === 'draft') && m.id && !usedIds.has(m.id!))
      .map(m => ({ ...m, isExtra: true }))

    return [...periodRows, ...extras].sort((a, b) =>
      (a.actual_date || a.meeting_date).localeCompare(b.actual_date || b.meeting_date)
    )
  }

  // ── mutations
  const savePeriod = useMutation({
    mutationFn: (p: PeriodConfig) => api.put('/api/scheduler/period', p).then(r => r.data),
    onSuccess: () => { refetchPeriod(); showToast('Period saved', 'success') },
  })

  const upsertMeeting = useMutation({
    mutationFn: (m: Partial<Meeting>) => api.put('/api/scheduler/meetings', m).then(r => r.data),
    onSuccess: () => refetchMeetings(),
  })

  const bulkUpsertEmails = useMutation({
    mutationFn: (emails: Record<string, string>) =>
      api.put('/api/scheduler/emails/bulk', { emails }).then(r => r.data),
    onSuccess: () => refetchEmails(),
  })

  const createMeetingMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/api/scheduler/create-meeting', payload, { headers: outlookHeaders() }).then(r => r.data),
  })

  const confirmMeetingMut = useMutation({
    mutationFn: ({ eventId, payload }: { eventId: string; payload: Record<string, unknown> }) =>
      api.post(`/api/scheduler/confirm-meeting/${encodeURIComponent(eventId)}`, payload).then(r => r.data),
  })

  const updateMeetingMut = useMutation({
    mutationFn: ({ eventId, payload }: { eventId: string; payload: Record<string, unknown> }) =>
      api.patch(`/api/scheduler/event/${encodeURIComponent(eventId)}`, payload, { headers: outlookHeaders() }).then(r => r.data),
  })

  // ── open modal
  function openModal(qc: QC, idx: number) {
    const dates = periodDates
    const meetings = getMeetingsForQC(qc)
    const m = meetings[idx]
    setModal({ qc, dateIdx: idx, dates })
    setModalDate(m?.meeting_date || dates[idx])
    setModalTime(period.meet_time || '10:00')
    setModalDur(period.duration_min || 60)
    setModalTitle(`SA Pipeline Acceleration — ${qc.qc} | ${qc.lob || 'SAP'}`)
    setModalNotes('')
    const em: Record<string, string> = {}
    for (const n of [qc.qc, qc.sde, qc.dsa_spoc, qc.dva]) {
      if (n) em[n] = emailMap[n] || ''
    }
    setModalEmails(em)
  }

  async function handleCreateOrUpdate(isDraft = false) {
    if (!modal) return
    const { qc, dateIdx } = modal
    const meetings = getMeetingsForQC(qc)
    const m = meetings[dateIdx]

    // save emails first
    const newEmails = { ...modalEmails }
    if (Object.keys(newEmails).length) {
      await bulkUpsertEmails.mutateAsync(newEmails)
    }

    const allAttendees = [
      { role: 'Quota Carrier', name: qc.qc },
      { role: 'SDE', name: qc.sde },
      { role: 'DSA-SPOC', name: qc.dsa_spoc },
      { role: 'DVA', name: qc.dva },
    ].filter(a => a.name && a.name !== '—')

    const attendeesPayload = allAttendees.map(a => ({
      role: a.role, name: a.name,
      email: newEmails[a.name] || emailMap[a.name] || '',
    }))

    // Build body html for update
    const dtS = new Date(`${modalDate}T${modalTime}:00`)
    const dtE = new Date(dtS.getTime() + modalDur * 60000)
    const dateLbl = dtS.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const timeLbl = `${dtS.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${dtE.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    const attLines = allAttendees.map(a => {
      const email = newEmails[a.name] || emailMap[a.name] || ''
      return `&bull; ${a.role}: ${a.name}${email ? ` &lt;${email}&gt;` : ''}`
    }).join('<br>')
    const notesSection = modalNotes ? `<p>${modalNotes}</p>` : ''

    const bodyHtml = `<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#32363A">
<p>Hi,</p>
<p>I would like to schedule a <b>Pipeline Acceleration Session</b> with the SAP Solution Advisory team.</p>
<p>The objective of this session is <b>not</b> a pipeline review — it is a working session where the Solution Advisor team can share insights, demos, and tools to help <b>accelerate deal progression and improve close rates</b> in your portfolio.</p>
<table style="border-collapse:collapse;margin:16px 0">
  <tr><td style="padding:4px 16px 4px 0;color:#556b82;font-weight:bold">Date</td><td>${dateLbl}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#556b82;font-weight:bold">Time</td><td>${timeLbl}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#556b82;font-weight:bold">Duration</td><td>${modalDur} minutes</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#556b82;font-weight:bold">QC</td><td>${qc.qc}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#556b82;font-weight:bold">LoB</td><td>${qc.lob || ''}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#556b82;font-weight:bold">Geo / FLSM</td><td>${qc.geo || ''} / ${qc.flsm || ''}</td></tr>
</table>
<p><b>Attendees:</b><br>${attLines}</p>
<p><b>Agenda:</b></p><ul><li>Open opportunities review</li><li>Support needed from pre-sales team</li></ul>
${notesSection}<p>Please confirm your availability.</p><p>Best regards</p></body></html>`

    try {
      if (m?.event_id && m.status === 'scheduled') {
        // Update existing event
        await updateMeetingMut.mutateAsync({
          eventId: m.event_id,
          payload: { subject: modalTitle, date: modalDate, time: modalTime, duration: modalDur, body_html: bodyHtml },
        })
        await upsertMeeting.mutateAsync({ ...m, meeting_date: modalDate })
        showToast(`Meeting updated for ${qc.qc}`, 'success')
        setModal(null)
      } else {
        // Create new (with or without attendees)
        const data = await createMeetingMut.mutateAsync({
          date: modalDate, time: modalTime, duration: modalDur,
          title: modalTitle, qc: qc.qc, lob: qc.lob || '',
          geo: qc.geo || '', flsm: qc.flsm || '',
          notes: modalNotes, attendees: attendeesPayload,
          draft_mode: isDraft,
        })
        await refetchMeetings()
        setModal(null)

        if (isDraft) {
          // Open confirm panel so user can review before sending invites
          const savedMeeting: Meeting = {
            qc: qc.qc, flsm: qc.flsm, lob: qc.lob,
            meeting_date: modalDate, status: 'draft',
            event_id: data.id, web_link: data.webLink,
          }
          setConfirmDraft({ meeting: savedMeeting, attendees: attendeesPayload })
          showToast(`Draft saved for ${qc.qc} — review and confirm to send invites`, 'info')
        } else {
          if (data.webLink) {
            showToast(`Meeting created for ${qc.qc} — <a href="${data.webLink}" target="_blank" style="color:#fff;text-decoration:underline">Open in Outlook</a>`, 'success')
          } else {
            showToast(`Meeting created for ${qc.qc}`, 'success')
          }
        }
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Unknown error'
      showToast('Error: ' + detail, 'error')
    }
  }

  async function handleSendInvites() {
    if (!confirmDraft) return
    try {
      const result = await confirmMeetingMut.mutateAsync({
        eventId: confirmDraft.meeting.event_id!,
        payload: {
          attendees: confirmDraft.attendees,
          qc: confirmDraft.meeting.qc,
          flsm: confirmDraft.meeting.flsm,
          lob: confirmDraft.meeting.lob,
          meeting_date: confirmDraft.meeting.meeting_date,
        },
      })
      await refetchMeetings()
      setConfirmDraft(null)
      showToast(`Invites sent to ${result.invited} attendees`, 'success')
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Unknown error'
      showToast('Error sending invites: ' + detail, 'error')
    }
  }

  async function syncFromOutlook() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const data = await api.get('/api/scheduler/outlook/sync', {
        params: { start_date: period.start_date, end_date: period.end_date },
        headers: outlookHeaders(),
      }).then(r => r.data)
      await refetchMeetings()
      setSyncResult(data)
      showToast(`Sync done — ${data.updated.length} meetings updated`, 'success')
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Unknown error'
      showToast('Sync error: ' + detail, 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function markScheduled() {
    if (!modal) return
    const { qc, dateIdx } = modal
    const meetings = getMeetingsForQC(qc)
    const m = meetings[dateIdx]
    await upsertMeeting.mutateAsync({
      qc: qc.qc, flsm: qc.flsm, lob: qc.lob,
      meeting_date: modalDate, status: 'scheduled',
      event_id: m?.event_id, web_link: m?.web_link,
    })
    showToast('Meeting marked as scheduled', 'success')
    setModal(null)
  }

  async function unmarkMeeting(qc: QC, dateIdx: number) {
    const meetings = getMeetingsForQC(qc)
    const m = meetings[dateIdx]
    if (!m) return
    await upsertMeeting.mutateAsync({ ...m, status: 'pending', event_id: undefined, web_link: undefined })
  }

  async function checkStatus(eventId: string) {
    try {
      const data = await api.get(`/api/scheduler/event/${encodeURIComponent(eventId)}`, { headers: outlookHeaders() }).then(r => r.data)
      setStatusPanel(data)
    } catch (e: any) {
      showToast('Error: ' + (e?.response?.data?.detail || e?.message), 'error')
    }
  }

  // ── period update
  const [localPeriod, setLocalPeriod] = useState<PeriodConfig>(period)
  useEffect(() => { if (periodData) setLocalPeriod(periodData) }, [periodData])

  function updatePeriodField(k: keyof PeriodConfig, v: string | number) {
    setLocalPeriod(p => ({ ...p, [k]: v }))
  }

  // ── VAT upload
  async function handleVATUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadStatus({ msg: `Loading ${file.name}…`, type: 'loading' })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/api/scheduler/upload-vat', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadStatus({ msg: `✓ ${r.data.loaded} QCs loaded from "${file.name}"`, type: 'success' })
      refetchQCs()
      setTimeout(() => setUploadStatus({ msg: '', type: 'idle' }), 5000)
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Error desconhecido'
      setUploadStatus({ msg: `✗ Error: ${detail}`, type: 'error' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── calendar
  const byDate = useMemo(() => {
    const m: Record<string, { name: string; status: string }[]> = {}
    for (const qc of qcs) {
      const mtgs = getMeetingsForQC(qc)
      for (const mt of mtgs) {
        if (!m[mt.meeting_date]) m[mt.meeting_date] = []
        m[mt.meeting_date].push({ name: qc.qc, status: mt.status })
      }
    }
    return m
  }, [qcs, meetingsIndex, periodDates])

  function renderCalendar() {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const prevDays = new Date(calYear, calMonth, 0).getDate()
    const today = new Date()
    const cells: JSX.Element[] = DAYS.map(d => (
      <div key={d} style={{ background: '#32363A', color: '#fff', textAlign: 'center', padding: '.5rem .25rem', fontSize: '.6875rem', fontWeight: 700 }}>{d}</div>
    ))
    for (let i = firstDay - 1; i >= 0; i--)
      cells.push(<div key={`p${i}`} style={{ minHeight: 80, padding: '.375rem', background: '#fafbfc', borderRight: '1px solid #e1e2e6', borderBottom: '1px solid #e1e2e6', fontSize: '.75rem', color: '#aaa' }}>{prevDays - i}</div>)
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d
      const evs = byDate[ds] || []
      cells.push(
        <div key={d} style={{ minHeight: 80, padding: '.375rem', background: isToday ? '#e8f2ff' : '#fff', borderRight: '1px solid #e1e2e6', borderBottom: '1px solid #e1e2e6', fontSize: '.75rem' }}>
          <div style={{ fontWeight: 700, color: isToday ? '#0070f2' : '#556b82', marginBottom: '.25rem' }}>{d}</div>
          {evs.slice(0, 3).map((ev, i) => (
            <div key={i} style={{ padding: '2px 4px', borderRadius: 3, fontSize: '.625rem', fontWeight: 700, marginBottom: 2, background: ev.status === 'scheduled' ? '#c8e6c9' : '#ffe0b2', color: ev.status === 'scheduled' ? '#1b5e20' : '#bf360c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ev.name.split(' ')[0]}
            </div>
          ))}
          {evs.length > 3 && <div style={{ fontSize: '.625rem', color: '#556b82' }}>+{evs.length - 3} more</div>}
        </div>
      )
    }
    const total = firstDay + daysInMonth
    const rem = Math.ceil(total / 7) * 7 - total
    for (let i = 1; i <= rem; i++)
      cells.push(<div key={`n${i}`} style={{ minHeight: 80, padding: '.375rem', background: '#fafbfc', borderRight: '1px solid #e1e2e6', borderBottom: '1px solid #e1e2e6', fontSize: '.75rem', color: '#aaa' }}>{i}</div>)

    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>{MONTHS[calMonth]} {calYear}</span>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            {[['‹', () => { let m = calMonth - 1, y = calYear; if (m < 0) { m = 11; y-- } setCalMonth(m); setCalYear(y) }],
              ['Today', () => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()) }],
              ['›', () => { let m = calMonth + 1, y = calYear; if (m > 11) { m = 0; y++ } setCalMonth(m); setCalYear(y) }],
            ].map(([label, fn]) => (
              <button key={label as string} onClick={fn as any} style={{ padding: '.35rem .75rem', border: '1px solid #e1e2e6', background: '#fff', borderRadius: '.375rem', cursor: 'pointer', fontSize: '.8125rem' }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', border: '1px solid #e1e2e6', borderRadius: '.625rem', overflow: 'hidden' }}>
          {cells}
        </div>
      </div>
    )
  }

  // ── summary
  function renderSummary() {
    let total = 0, sched = 0, pend = 0
    const perQC: { qc: QC; s: number; p: number; tot: number; rsvp: { accepted: number; declined: number; tentative: number; pending: number }; rsvpByName: Record<string, { name: string; response: string }> }[] = []
    for (const q of qcs) {
      const mtgs = getMeetingsForQC(q)
      const s = mtgs.filter(m => m.status === 'scheduled').length
      const p = mtgs.filter(m => m.status === 'pending').length
      total += mtgs.length; sched += s; pend += p

      // Aggregate RSVP per person across all scheduled meetings for this QC
      // Use the most recent response per person (last meeting wins)
      const rsvpByName: Record<string, { name: string; response: string }> = {}
      const rsvp = { accepted: 0, declined: 0, tentative: 0, pending: 0 }
      for (const m of mtgs) {
        if (!m.attendees_rsvp) continue
        for (const a of m.attendees_rsvp) {
          if (!a.name) continue
          rsvpByName[a.name] = { name: a.name, response: a.response || 'None' }
        }
      }
      for (const a of Object.values(rsvpByName)) {
        const r = a.response
        if (r === 'Accepted') rsvp.accepted++
        else if (r === 'Declined') rsvp.declined++
        else if (r === 'TentativelyAccepted') rsvp.tentative++
        else rsvp.pending++
      }
      perQC.push({ qc: q, s, p, tot: mtgs.length, rsvp, rsvpByName })
    }
    const groups = [
      { label: 'Fully Scheduled', color: '#256f3a', items: perQC.filter(x => x.s === x.tot && x.tot > 0) },
      { label: 'Partially Scheduled', color: '#E76500', items: perQC.filter(x => x.s > 0 && x.s < x.tot) },
      { label: 'Not Started', color: '#BB0000', items: perQC.filter(x => x.s === 0) },
    ]
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Quota Carriers', value: qcs.length, color: '#0070f2' },
            { label: 'Meetings Scheduled', value: sched, color: '#256f3a' },
            { label: 'Meetings Pending', value: pend, color: '#E76500' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e1e2e6', borderRadius: '.75rem', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '.6875rem', color: '#556b82', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1.1, marginTop: '.125rem' }}>{value}</div>
            </div>
          ))}
        </div>
        {groups.map(g => !g.items.length ? null : (
          <div key={g.label} style={{ background: '#fff', border: '1px solid #e1e2e6', borderRadius: '.625rem', marginBottom: '.75rem', overflow: 'hidden' }}>
            <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid #e1e2e6', background: '#fafbfc', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: g.color }}>{g.label}</span>
              <span style={{ padding: '2px 9px', borderRadius: '.75rem', fontSize: '.6875rem', fontWeight: 700, background: '#fff3e0', color: '#E76500' }}>{g.items.length}</span>
            </div>
            <div style={{ padding: '.875rem 1rem', maxHeight: 280, overflowY: 'auto' }}>
              {g.items.map(x => (
                <div key={qcKey(x.qc)} style={{ display: 'flex', flexDirection: 'column', gap: '.25rem', padding: '.5rem 0', borderBottom: '1px solid #e1e2e6', fontSize: '.8125rem' }}>
                  {/* Row 1 — name, geo/lob, count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem' }}>
                    <span style={{ flex: 1, fontWeight: 600 }}>{x.qc.qc}</span>
                    <span style={{ color: '#556b82', fontSize: '.75rem' }}>{x.qc.geo} · {x.qc.lob} · {x.qc.flsm}</span>
                    <span style={{ color: g.color, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{x.s}/{x.tot}</span>
                  </div>
                  {/* Row 2 — individual RSVP chips */}
                  {Object.values(x.rsvpByName).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.values(x.rsvpByName).map(a => {
                        const r = a.response
                        const cfg =
                          r === 'Accepted'            ? { bg: '#d4edda', color: '#256f3a', icon: '✓' } :
                          r === 'Declined'            ? { bg: '#fde8e8', color: '#BB0000', icon: '✕' } :
                          r === 'TentativelyAccepted' ? { bg: '#fff3cd', color: '#856404', icon: '~' } :
                                                        { bg: '#f0f0f0', color: '#788fa6', icon: '?' }
                        // Short first name only
                        const firstName = a.name.split(' ')[0]
                        return (
                          <span key={a.name} title={`${a.name}: ${r}`} style={{
                            padding: '2px 8px', borderRadius: 10,
                            fontSize: '.6875rem', fontWeight: 600,
                            background: cfg.bg, color: cfg.color,
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                          }}>
                            <span style={{ fontSize: '.6rem' }}>{cfg.icon}</span>{firstName}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── styles helpers
  const S = {
    panel: { background: '#fff', border: '1px solid #e1e2e6', borderRadius: '.75rem', overflow: 'hidden' } as React.CSSProperties,
    panelHeader: { padding: '.875rem 1rem .75rem', borderBottom: '1px solid #e1e2e6', background: '#fafbfc', display: 'flex', alignItems: 'center', gap: '.5rem' } as React.CSSProperties,
    panelTitle: { fontWeight: 700, fontSize: '.9375rem', color: '#32363A', flex: 1 } as React.CSSProperties,
    label: { fontSize: '.75rem', fontWeight: 600, color: '#556b82', display: 'block', marginBottom: '.3rem' } as React.CSSProperties,
    input: { width: '100%', padding: '.4rem .625rem', border: '1px solid #e1e2e6', borderRadius: '.375rem', fontSize: '.8125rem', color: '#32363A', background: '#fff', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
    select: { width: '100%', padding: '.4rem .625rem', border: '1px solid #e1e2e6', borderRadius: '.375rem', fontSize: '.8125rem', color: '#32363A', background: '#fff', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
    btnPrimary: { padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#0070f2', color: '#fff', width: '100%', display: 'block' } as React.CSSProperties,
    btnGhost: { padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: '1px solid #e1e2e6', cursor: 'pointer', background: '#fff', color: '#32363A', width: '100%', display: 'block' } as React.CSSProperties,
  }

  // ── render QC list
  function renderQCList() {
    if (!qcs.length) return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#556b82' }}>
        <div style={{ fontSize: '3rem', marginBottom: '.75rem' }}>📂</div>
        <p style={{ fontSize: '.875rem' }}>Upload the VAT Excel file or load from database to see Quota Carriers.</p>
      </div>
    )
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ background: '#E1F4FF', border: '1px solid #b3d1f7', borderRadius: '.375rem', padding: '.5rem .875rem', fontSize: '.75rem', color: '#1a5f9e', marginBottom: '.875rem' }}>
          Showing <strong>{qcs.length}</strong> Quota Carriers — click <em>Schedule</em> to generate an Outlook calendar invitation.
        </div>
        {qcs.map(qc => {
          const k = qcKey(qc)
          const mtgs = getMeetingsForQC(qc)
          const scheduled = mtgs.filter(m => m.status === 'scheduled').length
          const draftCount = mtgs.filter(m => m.status === 'draft').length
          const total = mtgs.length
          const allDone = scheduled === total
          return (
            <div key={k} style={{ background: '#fff', border: '1px solid #e1e2e6', borderRadius: '.625rem', overflow: 'hidden', marginBottom: '.75rem' }}>
              <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid #e1e2e6', background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.9375rem' }}>{qc.qc}</div>
                  <div style={{ fontSize: '.75rem', color: '#556b82', marginTop: '.15rem' }}>{[qc.geo, qc.lob, qc.flsm].filter(Boolean).join(' · ')}</div>
                </div>
                <Badge ok={allDone} scheduled={scheduled} draft={draftCount} total={total} />
              </div>
              <div style={{ padding: '.875rem 1rem' }}>
                {/* Team */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.625rem', marginBottom: '.875rem' }}>
                  {([['QC', qc.qc], ['SDE', qc.sde], ['DSA-SPOC', qc.dsa_spoc], ['DVA', qc.dva]] as [string, string][]).filter(([, n]) => n).map(([role, name]) => (
                    <div key={role} style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                      <span style={{ fontSize: '.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#556b82' }}>{role}</span>
                      <span style={{ fontSize: '.8125rem', fontWeight: 700 }}>{name}</span>
                      <input
                        style={{ ...S.input, fontSize: '.75rem !important', padding: '.3rem .5rem' }}
                        placeholder="email@sap.com"
                        defaultValue={emailMap[name] || ''}
                        onBlur={e => {
                          if (e.target.value) api.put('/api/scheduler/emails', { name, email: e.target.value })
                        }}
                      />
                    </div>
                  ))}
                </div>
                {/* Meetings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.375rem' }}>
                  {mtgs.map((m, i) => {
                    const ok = m.status === 'scheduled'
                    const isDraft = m.status === 'draft'
                    const hasEvent = (ok || isDraft) && m.event_id
                    const dotColor = ok ? '#256f3a' : isDraft ? '#1a73e8' : '#E76500'
                    const hasActual = ok && m.actual_date
                    const dateDiffers = hasActual && m.actual_date !== m.meeting_date
                    const statusLabel = ok ? '✓ Scheduled' : isDraft ? '✎ Draft — awaiting send' : 'Pending'
                    return (
                      <div key={m.meeting_date} style={{ display: 'flex', alignItems: 'center', gap: '.625rem', padding: '.5rem .75rem', background: isDraft ? '#f0f4ff' : '#f5f6f7', borderRadius: '.375rem', fontSize: '.8125rem', border: isDraft ? '1px solid #c5d4f7' : '1px solid transparent' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />

                        {/* Suggested date */}
                        <span style={{ fontWeight: 700, minWidth: 80, color: dateDiffers ? '#788fa6' : '#32363A', textDecoration: dateDiffers ? 'line-through' : 'none', fontSize: dateDiffers ? '.75rem' : '.8125rem' }}>
                          {fmtDate(m.meeting_date)}
                        </span>

                        {/* Actual confirmed date from Outlook */}
                        {hasActual && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                            {dateDiffers && <span style={{ fontSize: '.7rem', color: '#788fa6' }}>→</span>}
                            <span style={{ fontWeight: 700, color: '#256f3a', fontSize: '.8125rem' }}>
                              {fmtDate(m.actual_date!)}
                            </span>
                            {m.actual_time && (
                              <span style={{ fontSize: '.75rem', color: '#556b82' }}>{m.actual_time}</span>
                            )}
                          </span>
                        )}

                        <span style={{ color: isDraft ? '#1a73e8' : ok ? '#256f3a' : '#556b82', flex: 1 }}>{statusLabel}</span>
                        {ok && m.attendees_rsvp && m.attendees_rsvp.length > 0 && (
                          <RsvpBadges rsvp={m.attendees_rsvp} />
                        )}
                        <div style={{ display: 'flex', gap: '.375rem', marginLeft: 'auto' }}>
                          {isDraft && m.event_id && (
                            <button
                              onClick={() => {
                                const qcObj = qc
                                const attendees = [
                                  { role: 'Quota Carrier', name: qcObj.qc },
                                  { role: 'SDE', name: qcObj.sde },
                                  { role: 'DSA-SPOC', name: qcObj.dsa_spoc },
                                  { role: 'DVA', name: qcObj.dva },
                                ].filter(a => a.name && a.name !== '—').map(a => ({
                                  role: a.role, name: a.name, email: emailMap[a.name] || '',
                                }))
                                setConfirmDraft({ meeting: m, attendees })
                              }}
                              style={{ padding: '.25rem .6rem', fontSize: '.6875rem', borderRadius: '.3rem', border: 'none', cursor: 'pointer', fontWeight: 700, background: '#1a73e8', color: '#fff' }}
                            >
                              ✉ Send Invites
                            </button>
                          )}
                          <button
                            onClick={() => openModal(qc, i)}
                            style={{ padding: '.25rem .6rem', fontSize: '.6875rem', borderRadius: '.3rem', border: 'none', cursor: 'pointer', fontWeight: 700, background: '#0070f2', color: '#fff' }}
                          >
                            {ok ? 'Edit' : 'Schedule'}
                          </button>
                          {hasEvent && (
                            <button
                              onClick={() => checkStatus(m.event_id!)}
                              style={{ padding: '.25rem .6rem', fontSize: '.6875rem', borderRadius: '.3rem', border: 'none', cursor: 'pointer', fontWeight: 700, background: '#256f3a', color: '#fff' }}
                            >
                              Status
                            </button>
                          )}
                          {hasEvent && m.web_link && (
                            <a href={m.web_link} target="_blank" rel="noreferrer"
                              style={{ padding: '.25rem .6rem', fontSize: '.6875rem', borderRadius: '.3rem', border: 'none', cursor: 'pointer', fontWeight: 700, background: '#e0e2e6', color: '#32363A', textDecoration: 'none' }}>
                              Open
                            </a>
                          )}
                          {(ok || isDraft) && (
                            <button
                              onClick={() => unmarkMeeting(qc, i)}
                              style={{ padding: '.25rem .6rem', fontSize: '.6875rem', borderRadius: '.3rem', border: 'none', cursor: 'pointer', fontWeight: 700, background: '#e0e2e6', color: '#32363A' }}
                            >
                              Unmark
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const isCreating = createMeetingMut.isPending || updateMeetingMut.isPending || bulkUpsertEmails.isPending || confirmMeetingMut.isPending

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Outlook token banner ────────────────────────────────────────── */}
      {(!outlook.tokenValid || (outlook.expiresIn != null && outlook.expiresIn <= 10)) && (
        <div style={{ background: outlook.tokenValid ? '#FFF3E0' : '#FFEBEE', border: `1px solid ${outlook.tokenValid ? '#FFB74D' : '#EF9A9A'}`, borderRadius: '.5rem', padding: '.625rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '.8125rem', color: outlook.tokenValid ? '#E65100' : '#BB0000', fontWeight: 600 }}>
            {outlook.isWaiting
              ? '⏳ Waiting for Outlook authorization…'
              : outlook.tokenValid
              ? `⚠️ Token expira em ${outlook.expiresIn} min`
              : '⚠️ Connect your Microsoft account to create meeting invites.'}
          </span>
          <button onClick={outlook.openRelay} disabled={outlook.isWaiting}
            style={{ padding: '.35rem .875rem', background: outlook.isWaiting ? '#788fa6' : '#0070f2', color: '#fff', borderRadius: '.375rem', fontSize: '.75rem', fontWeight: 700, border: 'none', cursor: outlook.isWaiting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {outlook.isWaiting ? 'Waiting…' : '🔑 Connect Outlook'}
          </button>
        </div>
      )}
      {outlook.tokenValid && (outlook.expiresIn == null || outlook.expiresIn > 10) && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '.5rem', padding: '.5rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '.8125rem', color: '#256f3a', fontWeight: 600 }}>
            ✓ Outlook connected
            {outlook.expiresIn != null && <span style={{ fontWeight: 400, marginLeft: 6, color: '#556b82' }}>(expires in ~{outlook.expiresIn} min)</span>}
          </span>
          <button onClick={outlook.openRelay} style={{ padding: '.25rem .75rem', background: '#fff', color: '#556b82', border: '1px solid #e1e2e6', borderRadius: '.375rem', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' }}>
            Renew
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', alignItems: 'start' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>

        {/* Data Source */}
        <div style={S.panel}>
          <div style={S.panelHeader}>
            <div>
              <div style={S.panelTitle}>Data Source</div>
              <div style={{ fontSize: '.75rem', color: '#556b82' }}>VAT Excel or Pipeline DB</div>
            </div>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>

            {/* Load from DB */}
            <button
              style={{ ...S.btnPrimary, marginBottom: 0 }}
              onClick={() => { refetchQCs(); showToast('Loading do banco de dados…') }}
            >
              ⚡ Load from Database
            </button>

            {/* Upload area */}
            <div
              style={{
                border: `2px dashed ${uploading ? '#0070f2' : '#e1e2e6'}`,
                borderRadius: '.5rem', padding: '1rem', textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                background: uploading ? '#E1F4FF' : '#f5f6f7',
                transition: 'all .2s',
              }}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '.25rem' }}>{uploading ? '⏳' : '📊'}</div>
              <p style={{ fontSize: '.8125rem', color: uploading ? '#0070f2' : '#556b82', fontWeight: 600 }}>
                {uploading ? 'Loading arquivo…' : 'Upload VAT Excel'}
              </p>
              <p style={{ fontSize: '.75rem', color: '#556b82', marginTop: '.15rem' }}>Headmap 2026 DH VAT Team.xlsx</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleVATUpload} />

            {/* Upload status bar */}
            {uploadStatus.type !== 'idle' && (
              <div style={{
                padding: '.5rem .75rem', borderRadius: '.375rem', fontSize: '.75rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '.5rem',
                background: uploadStatus.type === 'loading' ? '#E1F4FF'
                  : uploadStatus.type === 'success' ? '#e8f5e9'
                  : '#ffebee',
                color: uploadStatus.type === 'loading' ? '#1a5f9e'
                  : uploadStatus.type === 'success' ? '#256f3a'
                  : '#BB0000',
                border: `1px solid ${uploadStatus.type === 'loading' ? '#b3d1f7'
                  : uploadStatus.type === 'success' ? '#a5d6a7'
                  : '#ef9a9a'}`,
              }}>
                {uploadStatus.type === 'loading' && (
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
                )}
                {uploadStatus.msg}
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '1px solid #e1e2e6' }} />

            {/* Sync from Outlook */}
            <button
              style={{ ...S.btnPrimary, background: syncing ? '#788fa6' : '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}
              onClick={syncFromOutlook}
              disabled={syncing}
            >
              {syncing
                ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> Syncing…</>
                : '🔄 Sync from Outlook'}
            </button>
            {syncResult && (
              <div style={{ padding: '.4rem .625rem', borderRadius: '.375rem', fontSize: '.75rem', fontWeight: 600, background: '#e8f5e9', color: '#256f3a', border: '1px solid #a5d6a7', cursor: 'pointer' }} onClick={() => setSyncResult(null)}>
                ✓ {syncResult.updated.length} updated · {syncResult.outlook_events_found} found in Outlook
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '1px solid #e1e2e6' }} />

            {/* Clear button */}
            {!clearConfirm ? (
              <button
                onClick={() => { setClearConfirm(true); setClearStatus({ msg: '', type: 'idle' }) }}
                style={{ padding: '.4rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: '1px solid #BB0000', cursor: 'pointer', background: '#fff', color: '#BB0000', width: '100%' }}
              >
                🗑 Clear Heatmap from DB
              </button>
            ) : (
              <div style={{ background: '#ffebee', border: '1px solid #BB0000', borderRadius: '.375rem', padding: '.75rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                <p style={{ fontSize: '.75rem', color: '#BB0000', fontWeight: 700, margin: 0 }}>
                  Delete all QCs loaded from the database?
                </p>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button
                    onClick={() => clearQCsMut.mutate()}
                    disabled={clearQCsMut.isPending}
                    style={{ flex: 1, padding: '.35rem', fontSize: '.75rem', fontWeight: 700, border: 'none', borderRadius: '.3rem', cursor: clearQCsMut.isPending ? 'not-allowed' : 'pointer', background: '#BB0000', color: '#fff', opacity: clearQCsMut.isPending ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.35rem' }}
                  >
                    {clearQCsMut.isPending && <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
                    {clearQCsMut.isPending ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setClearConfirm(false)}
                    style={{ flex: 1, padding: '.35rem', fontSize: '.75rem', fontWeight: 700, border: '1px solid #e1e2e6', borderRadius: '.3rem', cursor: 'pointer', background: '#fff', color: '#32363A' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Clear status bar */}            {clearStatus.type !== 'idle' && (
              <div style={{
                padding: '.5rem .75rem', borderRadius: '.375rem', fontSize: '.75rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '.5rem',
                background: clearStatus.type === 'loading' ? '#E1F4FF'
                  : clearStatus.type === 'success' ? '#e8f5e9'
                  : '#ffebee',
                color: clearStatus.type === 'loading' ? '#1a5f9e'
                  : clearStatus.type === 'success' ? '#256f3a'
                  : '#BB0000',
                border: `1px solid ${clearStatus.type === 'loading' ? '#b3d1f7'
                  : clearStatus.type === 'success' ? '#a5d6a7'
                  : '#ef9a9a'}`,
              }}>
                {clearStatus.type === 'loading' && (
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
                )}
                {clearStatus.msg}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={S.panel}>
          <div style={S.panelHeader}><div style={S.panelTitle}>Filters</div></div>          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
            {([['Geo', filterGeo, setFilterGeo, filters?.geos || []] as const,
               ['LoB', filterLob, setFilterLob, filters?.lobs || []] as const,
               ['FLSM', filterFlsm, setFilterFlsm, filters?.flsms || []] as const,
            ]).map(([label, val, set, opts]) => (
              <div key={label}>
                <label style={S.label}>{label}</label>
                <select style={S.select} value={val} onChange={e => set(e.target.value)}>
                  <option value="">— All {label}s —</option>
                  {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <button style={S.btnGhost} onClick={() => { setFilterGeo(''); setFilterLob(''); setFilterFlsm('') }}>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Period */}
        <div style={S.panel}>
          <div style={S.panelHeader}><div style={S.panelTitle}>Meeting Period</div></div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.625rem' }}>
              {([['Start', 'start_date', 'date'], ['End', 'end_date', 'date'], ['Freq (days)', 'freq_days', 'number'], ['Duration (min)', 'duration_min', 'number']] as const).map(([label, key, type]) => (
                <div key={key}>
                  <label style={S.label}>{label}</label>
                  <input style={S.input} type={type} value={localPeriod[key]} onChange={e => updatePeriodField(key, type === 'number' ? Number(e.target.value) : e.target.value)} />
                </div>
              ))}
            </div>
            <div>
              <label style={S.label}>Preferred Time</label>
              <input style={S.input} type="time" value={localPeriod.meet_time} onChange={e => updatePeriodField('meet_time', e.target.value)} />
            </div>
            <button style={S.btnPrimary} onClick={() => savePeriod.mutate(localPeriod)}>
              {savePeriod.isPending ? 'Saving…' : 'Save & Regenerate Schedule'}
            </button>
          </div>
        </div>

      </div>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div style={{ ...S.panel, overflow: 'visible' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e1e2e6', padding: '0 1rem' }}>
          {(['qc-list', 'calendar', 'summary'] as const).map((t, i) => (
            <div
              key={t}
              onClick={() => setTab(t)}
              style={{ padding: '.75rem 1rem', fontSize: '.8125rem', fontWeight: 700, cursor: 'pointer', borderBottom: tab === t ? '2px solid #0070f2' : '2px solid transparent', color: tab === t ? '#0070f2' : '#556b82', whiteSpace: 'nowrap' }}
            >
              {['Quota Carriers', 'Calendar', 'Summary'][i]}
            </div>
          ))}
        </div>

        {tab === 'qc-list'  && renderQCList()}
        {tab === 'calendar' && renderCalendar()}
        {tab === 'summary'  && renderSummary()}
      </div>

      {/* ── MEETING MODAL ─────────────────────────────────────────────────── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: '.75rem', padding: '1.5rem', width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>
              {getMeetingsForQC(modal.qc)[modal.dateIdx]?.event_id ? 'Edit Meeting' : 'Schedule Meeting'}
            </h3>
            <div style={{ marginBottom: '.875rem' }}>
              <div style={{ fontWeight: 700, fontSize: '.9375rem' }}>{modal.qc.qc}</div>
              <div style={{ fontSize: '.75rem', color: '#556b82' }}>{[modal.qc.geo, modal.qc.lob, modal.qc.flsm].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.625rem', marginBottom: '.75rem' }}>
              {([['Date', 'date', modalDate, setModalDate], ['Time', 'time', modalTime, setModalTime]] as any[]).map(([label, type, val, set]) => (
                <div key={label}><label style={S.label}>{label}</label><input style={S.input} type={type} value={val} onChange={e => set(e.target.value)} /></div>
              ))}
              <div>
                <label style={S.label}>Duration (min)</label>
                <input style={S.input} type="number" value={modalDur} min={15} max={240} onChange={e => setModalDur(Number(e.target.value))} />
              </div>
            </div>
            <div style={{ marginBottom: '.75rem' }}>
              <label style={S.label}>Meeting Title</label>
              <input style={S.input} value={modalTitle} onChange={e => setModalTitle(e.target.value)} />
            </div>
            <div style={{ fontSize: '.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#556b82', marginBottom: '.375rem' }}>Attendees</div>
            <div style={{ background: '#f5f6f7', borderRadius: '.375rem', padding: '.75rem', marginBottom: '.75rem' }}>
              {([['Quota Carrier', modal.qc.qc], ['SDE', modal.qc.sde], ['DSA-SPOC', modal.qc.dsa_spoc], ['DVA', modal.qc.dva]] as [string, string][]).filter(([, n]) => n).map(([role, name]) => (
                <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
                  <span style={{ fontSize: '.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#556b82', width: 90, flexShrink: 0 }}>{role}</span>
                  <span style={{ fontSize: '.8125rem', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <input
                    style={{ ...S.input, width: 170, flexShrink: 0, fontSize: '.75rem', padding: '.3rem .5rem' }}
                    placeholder={guessEmail(name)}
                    value={modalEmails[name] || ''}
                    onChange={e => setModalEmails(prev => ({ ...prev, [name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '.75rem' }}>
              <label style={S.label}>Notes (optional)</label>
              <input style={S.input} placeholder="Focus areas, deal highlights…" value={modalNotes} onChange={e => setModalNotes(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e1e2e6' }}>
              <button onClick={() => setModal(null)} style={{ padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: '1px solid #e1e2e6', cursor: 'pointer', background: '#fff', color: '#32363A' }}>
                Cancel
              </button>
              <button onClick={markScheduled} style={{ padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#0070f2', color: '#fff' }}>
                Mark Scheduled
              </button>
              {!getMeetingsForQC(modal.qc)[modal.dateIdx]?.event_id && (
                <button onClick={() => handleCreateOrUpdate(true)} disabled={isCreating} style={{ padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: '1px solid #1a73e8', cursor: 'pointer', background: '#fff', color: '#1a73e8', opacity: isCreating ? .7 : 1 }}>
                  {isCreating ? '⏳ Saving…' : '💾 Save as Draft'}
                </button>
              )}
              <button onClick={() => handleCreateOrUpdate(false)} disabled={isCreating} style={{ padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#256f3a', color: '#fff', opacity: isCreating ? .7 : 1 }}>
                {isCreating ? '⏳ Saving…' : (getMeetingsForQC(modal.qc)[modal.dateIdx]?.event_id ? '📅 Update Invitation' : '📅 Send Invitation')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SYNC RESULT MODAL ────────────────────────────────────────────── */}
      {syncResult && syncResult.updated.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setSyncResult(null)}>
          <div style={{ background: '#fff', borderRadius: '.75rem', padding: '1.5rem', width: 600, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>🔄 Outlook Sync Results</h3>
              <span style={{ padding: '2px 10px', borderRadius: '.75rem', fontSize: '.75rem', fontWeight: 700, background: '#e8f5e9', color: '#256f3a' }}>
                {syncResult.outlook_events_found} events found
              </span>
            </div>

            {/* Updated */}
            {syncResult.updated.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#256f3a', marginBottom: '.5rem' }}>
                  ✓ Updated to Scheduled ({syncResult.updated.length})
                </div>
                {syncResult.updated.map((u: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '.375rem 0', borderBottom: '1px solid #e1e2e6', fontSize: '.8125rem' }}>
                    <span style={{ fontWeight: 600 }}>{u.qc}</span>
                    <span style={{ color: '#556b82', fontSize: '.75rem' }}>{u.lob}</span>
                    <span style={{ color: '#556b82', fontSize: '.75rem' }}>{u.meeting_date}</span>
                    <span style={{ color: '#788fa6', fontSize: '.6875rem' }}>was: {u.previous_status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Not found in DB */}
            {syncResult.not_found_in_db.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#E76500', marginBottom: '.5rem' }}>
                  ⚠ In Outlook but not in DB ({syncResult.not_found_in_db.length})
                </div>
                {syncResult.not_found_in_db.map((u: any, i: number) => (
                  <div key={i} style={{ padding: '.375rem 0', borderBottom: '1px solid #e1e2e6', fontSize: '.8125rem', color: '#556b82' }}>
                    <span style={{ fontWeight: 600, color: '#32363A' }}>{u.qc}</span> · {u.date} · {u.subject}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e1e2e6' }}>
              <button onClick={() => setSyncResult(null)} style={{ padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: '1px solid #e1e2e6', cursor: 'pointer', background: '#fff', color: '#32363A' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DRAFT PANEL ──────────────────────────────────────────── */}
      {confirmDraft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setConfirmDraft(null)}>
          <div style={{ background: '#fff', borderRadius: '.75rem', padding: '1.5rem', width: 500, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.25rem' }}>✉</span>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Confirm & Send Invitations</h3>
            </div>
            <div style={{ background: '#f0f4ff', border: '1px solid #c5d4f7', borderRadius: '.5rem', padding: '.75rem 1rem', marginBottom: '1rem', fontSize: '.8125rem', color: '#1a4fa0' }}>
              The event <strong>"{confirmDraft.meeting.qc}"</strong> was created on your Outlook calendar without attendees. Review the list below and click <strong>Send Invitations</strong> to notify everyone.
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#556b82', marginBottom: '.5rem' }}>Invitations will be sent to:</div>
              {confirmDraft.attendees.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.625rem', padding: '.4rem 0', borderBottom: '1px solid #e1e2e6', fontSize: '.8125rem' }}>
                  <span style={{ fontSize: '.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#556b82', width: 80, flexShrink: 0 }}>{a.role}</span>
                  <span style={{ fontWeight: 700, flex: 1 }}>{a.name}</span>
                  <span style={{ color: a.email ? '#32363A' : '#BB0000', fontSize: '.75rem' }}>{a.email || '⚠ no email'}</span>
                </div>
              ))}
            </div>
            {confirmDraft.meeting.web_link && (
              <div style={{ marginBottom: '1rem' }}>
                <a href={confirmDraft.meeting.web_link} target="_blank" rel="noreferrer" style={{ fontSize: '.8125rem', color: '#0070f2', textDecoration: 'underline' }}>
                  Open event in Outlook to review →
                </a>
              </div>
            )}
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e1e2e6' }}>
              <button onClick={() => setConfirmDraft(null)} style={{ padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: '1px solid #e1e2e6', cursor: 'pointer', background: '#fff', color: '#32363A' }}>
                Not yet
              </button>
              <button onClick={handleSendInvites} disabled={confirmMeetingMut.isPending} style={{ padding: '.45rem .875rem', borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#1a73e8', color: '#fff', opacity: confirmMeetingMut.isPending ? .7 : 1 }}>
                {confirmMeetingMut.isPending ? '⏳ Sending…' : '✉ Send Invitations'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS PANEL ─────────────────────────────────────────────────── */}
      {statusPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setStatusPanel(null)}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.2)', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', width: 540 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{statusPanel.subject}</div>
            <div style={{ fontSize: 12, color: '#556b82', marginBottom: 14 }}>
              📅 {statusPanel.start ? new Date(statusPanel.start).toLocaleString() : ''}
              {statusPanel.isCancelled ? <span style={{ color: '#BB0000', fontWeight: 700, marginLeft: 8 }}>🚫 CANCELLED</span> : null}
            </div>
            {statusPanel.attendees?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f6f7' }}>
                    {['Attendee', 'Type', 'Response', 'Date'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: '#556b82', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statusPanel.attendees.map((a, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{a.name || a.email}</td>
                      <td style={{ padding: '6px 10px', color: '#556b82', fontSize: 12 }}>{a.type}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: RESPONSE_COLOR[a.response] || '#788fa6' }}>{RESPONSE_LABEL[a.response] || a.response}</td>
                      <td style={{ padding: '6px 10px', fontSize: 11, color: '#788fa6' }}>{a.time ? new Date(a.time).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: '#788fa6' }}>No attendees found.</p>}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              {statusPanel.webLink && (
                <a href={statusPanel.webLink} target="_blank" rel="noreferrer"
                  style={{ padding: '7px 14px', background: '#0070f2', color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Open in Outlook
                </a>
              )}
              <button onClick={() => setStatusPanel(null)} style={{ padding: '7px 14px', background: '#f5f6f7', border: '1px solid #d9dde2', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      <Toast msg={toast.msg} type={toast.type} onDone={() => setToast({ msg: '', type: '' })} />
      </div>  {/* closes grid wrapper */}

    </div>
  )
}
