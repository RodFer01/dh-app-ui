// @ts-nocheck
import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, LayoutGrid } from 'lucide-react'
import { getHolidaysForDate, COUNTRY_COLORS } from '../lib/lacHolidays'
import api from '../lib/api'
import { useOutlookToken } from '../lib/useOutlookToken'


// ── helpers ──────────────────────────────────────────────────────────────────
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function startOfWeek(d: Date) {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtWeekHeader(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── event colour logic ────────────────────────────────────────────────────────
function eventColor(ev: any) {
  const sub = (ev.subject || '').toLowerCase()
  if (ev.isLocal)                             return { bg: '#E8F5E9', border: '#43A047', text: '#1B5E20' }
  if (sub.includes('absent') || sub.includes('ausente') || sub.includes('vacation') || sub.includes('vacation'))
                                              return { bg: '#F5F5F5', border: '#9E9E9E', text: '#424242' }
  if (sub.includes('public holiday') || sub.includes('holiday'))
                                              return { bg: '#FFF8E1', border: '#F0AB00', text: '#7A5800' }
  if (sub.includes('ooo') || sub.includes('out of office'))
                                              return { bg: '#FCE4EC', border: '#E91E63', text: '#880E4F' }
  return { bg: '#E3F2FD', border: '#1565C0', text: '#0D47A1' }
}

// ── fetch helpers (BTP API) ───────────────────────────────────────────────────
async function fetchEvents(start: string, end: string, calToken: string) {
  const r = await api.get('/api/calendar/events', {
    params: { start, end, members: 'all' },
    headers: calToken ? { 'X-Cal-Auth': calToken } : {},
  })
  return r.data
}
async function fetchTeam() {
  const r = await api.get('/api/calendar/team')
  return r.data
}
async function fetchStatus() {
  const r = await api.get('/api/calendar/snapshot/status')
  return r.data
}

// ── absent badge ─────────────────────────────────────────────────────────────
function isAbsent(ev: any) {
  const s = (ev.subject || '').toLowerCase()
  return s.includes('absent') || s.includes('ausente') || s.includes('vacation') ||
         s.includes('vacation') || s.includes('ooo') || s.includes('out of office')
}

// ── Holiday badges ────────────────────────────────────────────────────────────
function HolidayBadges({ dateStr, compact = false }: { dateStr: string; compact?: boolean }) {
  const holidays = getHolidaysForDate(dateStr)
  if (!holidays.length) return null
  return (
    <>
      {holidays.map(h => {
        const c = COUNTRY_COLORS[h.country]
        return (
          <div key={`${h.country}-${h.date}`}
            className={`rounded px-1 py-0.5 mb-0.5 truncate ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold`}
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
            title={`${h.flag} ${h.countryName}: ${h.name}`}>
            {h.flag} {compact ? h.country : h.countryName} · {h.name}
          </div>
        )
      })}
    </>
  )
}

// ── Holiday header row (shown above member rows) ───────────────────────────────
function HolidayHeaderRow({ days }: { days: Date[] }) {
  const hasAny = days.some(d => getHolidaysForDate(isoDate(d)).length > 0)
  if (!hasAny) return null
  return (
    <div className="grid border-b border-[#E8E8E8] bg-[#FAFAFA]"
      style={{ gridTemplateColumns: '180px repeat(7, minmax(0, 1fr))' }}>
      <div className="px-3 py-1 border-r border-sap-border flex items-center">
        <span className="text-[9px] font-bold text-sap-muted uppercase tracking-wide">Holidays</span>
      </div>
      {days.map(d => (
        <div key={isoDate(d)} className="px-1 py-1 border-r border-sap-border last:border-r-0 min-h-[28px] overflow-hidden">
          <HolidayBadges dateStr={isoDate(d)} compact={false} />
        </div>
      ))}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────
function WeekView({ today, weekStart, members, eventsData }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayStr = isoDate(today)

  // group events per member per day — index by BOTH email and name for matching
  const byMemberDay = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {}
    const addEv = (key: string, day: string, ev: any) => {
      if (!key) return
      if (!map[key]) map[key] = {}
      if (!map[key][day]) map[key][day] = []
      map[key][day].push(ev)
    }
    for (const ev of eventsData?.events ?? []) {
      const email = (ev.memberEmail || '').toLowerCase()
      const name  = (ev.memberName || '').toLowerCase()
      const day   = ev.start?.slice(0, 10)
      if (email) addEv(email, day, ev)
      if (name)  addEv(name, day, ev)
    }
    return map
  }, [eventsData])

  // Get events for a member — try email first, then name
  function getMemberEvents(member: any, dayStr: string): any[] {
    const byEmail = member.email ? (byMemberDay[member.email.toLowerCase()]?.[dayStr] ?? []) : []
    const byName  = member.name  ? (byMemberDay[member.name.toLowerCase()]?.[dayStr] ?? []) : []
    // Merge, deduplicate by event id
    const seen = new Set<string>()
    const all = [...byEmail, ...byName].filter(ev => {
      const id = ev.id || ev.subject + ev.start
      if (seen.has(id)) return false
      seen.add(id); return true
    })
    return all
  }

  // detect multi-day absences spanning the week — check by name or email
  function getAbsenceSpan(member: any, dayStr: string) {
    const allEvs = getMemberEvents(member, dayStr)
    const allAbsent = Object.values(
      byMemberDay[(member.email || '').toLowerCase()] || byMemberDay[(member.name || '').toLowerCase()] || {}
    ).flat().filter(isAbsent)
    const spanning = allAbsent.find(ev => {
      const s = ev.start?.slice(0, 10) ?? ''
      const e = (ev.end?.slice(0, 10) ?? s)
      return s <= dayStr && e >= dayStr
    })
    return spanning ?? null
  }

  return (
    <div style={{ minWidth: '860px' }}>
      {/* Day header row */}
      <div className="grid bg-white border-b border-sap-border sticky top-0 z-10"
        style={{ gridTemplateColumns: '180px repeat(7, minmax(0, 1fr))' }}>
        <div className="px-3 py-2 text-[11px] font-semibold text-sap-muted uppercase tracking-wide border-r border-sap-border" />
        {days.map(d => {
          const isToday = isoDate(d) === todayStr
          return (
            <div key={d.toISOString()}
              className={`px-3 py-2 text-center border-r border-sap-border last:border-r-0 ${isToday ? 'bg-[#E3F2FD]' : ''}`}>
              <div className="text-[11px] font-semibold text-sap-muted uppercase">{DAY_LABELS[d.getDay()]}</div>
              <div className={`text-[20px] font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${
                isToday ? 'bg-sap-blue text-white' : 'text-sap-text'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Holiday header row */}
      <HolidayHeaderRow days={days} />

      {/* Member rows */}
      {members.map((member, idx) => {
        const memberKey = member.email || member.name
        return (
          <div key={memberKey}
            className={`grid border-b border-sap-border ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
            style={{ gridTemplateColumns: '180px repeat(7, minmax(0, 1fr))', minHeight: 56 }}>
            {/* Name cell */}
            <div className="px-3 py-2 border-r border-sap-border flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-sap-blue flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[12px] font-medium text-sap-text truncate">{member.name}</span>
              {member.me && <span className="text-[9px] bg-sap-blue text-white px-1 rounded ml-auto flex-shrink-0">me</span>}
            </div>

            {/* Day cells */}
            {days.map(d => {
              const dayStr = isoDate(d)
              const isToday = dayStr === todayStr
              const dayEvs = getMemberEvents(member, dayStr)
              const absSpan = getAbsenceSpan(member, dayStr)

              return (
                <div key={dayStr}
                  className={`px-1 py-1 border-r border-sap-border last:border-r-0 min-h-[56px] overflow-hidden ${
                    isToday ? 'bg-[#F0F8FF]' : ''
                  } ${[0, 6].includes(d.getDay()) ? 'bg-[#F5F6F7]' : ''}`}>
                  {absSpan && (
                    <div className="mb-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate flex items-center gap-1"
                      style={{ background: '#F5F5F5', border: '1px solid #9E9E9E', color: '#424242' }}>
                      <span>⌂</span>
                      <span className="truncate">
                        {absSpan.start.slice(0, 10) === dayStr
                          ? `Absent · ${fmtShort(new Date(absSpan.start))} – ${fmtShort(new Date(absSpan.end ?? absSpan.start))}`
                          : 'Absent'}
                      </span>
                    </div>
                  )}
                  {dayEvs.filter(ev => !isAbsent(ev)).map(ev => {
                    const c = eventColor(ev)
                    const time = ev.isAllDay ? '' : ev.start?.slice(11, 16)
                    return (
                      <div key={ev.id}
                        className="mb-0.5 rounded px-1.5 py-0.5 text-[10px] truncate cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                        title={`${ev.subject}${time ? ' · ' + time : ''}${ev.location ? ' · ' + ev.location : ''}`}>
                        {time && <span className="font-semibold mr-1">{time}</span>}
                        <span className="truncate">{ev.subject}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTH VIEW
// ─────────────────────────────────────────────────────────────────────────────
function MonthView({ today, monthStart, members, eventsData }) {
  const todayStr = isoDate(today)
  const start = startOfWeek(monthStart)
  const end = endOfMonth(monthStart)
  // Build 6-week grid
  const weeks: Date[][] = []
  let cur = new Date(start)
  while (cur <= end || weeks.length < 5) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cur, i))
    weeks.push(week)
    cur = addDays(cur, 7)
    if (weeks.length >= 6) break
  }

  const byMemberDay = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {}
    for (const ev of eventsData?.events ?? []) {
      const email = ev.memberEmail?.toLowerCase()
      const day = ev.start?.slice(0, 10)
      if (!map[email]) map[email] = {}
      if (!map[email][day]) map[email][day] = []
      map[email][day].push(ev)
    }
    return map
  }, [eventsData])

  return (
    <div style={{ minWidth: '860px' }}>
      {/* Month grid header */}
      <div className="grid border-b border-sap-border bg-white sticky top-0 z-10"
        style={{ gridTemplateColumns: '180px repeat(7, minmax(0, 1fr))' }}>
        <div className="px-3 py-2 border-r border-sap-border" />
        {DAY_LABELS.map(d => (
          <div key={d} className="px-3 py-2 text-center text-[11px] font-semibold text-sap-muted uppercase border-r border-sap-border last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Member sections */}
      {members.map((member, midx) => {
        const memberKey = member.email || member.name
        const memberEvsByDay: Record<string, any[]> = {}
        for (const d of Object.keys(byMemberDay[member.email?.toLowerCase()] || byMemberDay[member.name?.toLowerCase()] || {})) {
          memberEvsByDay[d] = getMemberEvents ? [] : []
        }
        // Build per-day events using getMemberEvents equivalent for MonthView
        const getEvs = (dayStr: string) => {
          const byEmail = member.email ? (byMemberDay[member.email.toLowerCase()]?.[dayStr] ?? []) : []
          const byName  = member.name  ? (byMemberDay[member.name.toLowerCase()]?.[dayStr] ?? []) : []
          const seen = new Set<string>()
          return [...byEmail, ...byName].filter(ev => {
            const id = ev.id || ev.subject + ev.start
            if (seen.has(id)) return false; seen.add(id); return true
          })
        }

        return (
          <div key={memberKey} className={`border-b-2 border-sap-border ${midx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
            {/* Member name header */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-sap-border bg-[#F0F4F8]">
              <div className="w-5 h-5 rounded-full bg-sap-blue flex items-center justify-center text-white text-[9px] font-bold">
                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[12px] font-semibold text-sap-text">{member.name}</span>
              {member.me && <span className="text-[9px] bg-sap-blue text-white px-1 rounded">me</span>}
            </div>
            {/* Weeks */}
            {weeks.map((week, widx) => (
              <div key={widx} className="grid border-b border-sap-border last:border-b-0"
                style={{ gridTemplateColumns: '180px repeat(7, minmax(0, 1fr))', minHeight: 44 }}>
                {/* Row label (week number) */}
                <div className="px-2 py-1 border-r border-sap-border flex items-center">
                  <span className="text-[10px] text-sap-muted">
                    Wk {Math.ceil((week[0].getTime() - new Date(week[0].getFullYear(), 0, 1).getTime()) / 604800000) + 1}
                  </span>
                </div>
                {week.map(d => {
                  const dayStr = isoDate(d)
                  const inMonth = d.getMonth() === monthStart.getMonth()
                  const isToday = dayStr === todayStr
                  const dayEvs = getEvs(dayStr)
                  return (
                    <div key={dayStr}
                      className={`px-1 py-1 border-r border-sap-border last:border-r-0 overflow-hidden ${
                        !inMonth ? 'opacity-40' : ''} ${isToday ? 'bg-[#E3F2FD]' : ''
                      } ${[0, 6].includes(d.getDay()) ? 'bg-[#F5F6F7] opacity-60' : ''}`}>
                      <div className={`text-[10px] mb-0.5 text-right pr-0.5 ${isToday ? 'font-bold text-sap-blue' : 'text-sap-muted'}`}>
                        {d.getDate()}
                      </div>
                      <HolidayBadges dateStr={dayStr} compact={true} />
                      {dayEvs.slice(0, 2).map(ev => {
                        const c = eventColor(ev)
                        return (
                          <div key={ev.id}
                            className="rounded px-1 py-0.5 text-[9px] truncate mb-0.5"
                            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                            title={ev.subject}>
                            {isAbsent(ev) ? '⌂ ' : ''}{ev.subject}
                          </div>
                        )
                      })}
                      {dayEvs.length > 2 && (
                        <div className="text-[9px] text-sap-muted text-right">+{dayEvs.length - 2}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ allMembers, defaultDate, calToken, onClose }: {
  allMembers: any[]
  defaultDate: string
  calToken: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    subject: '',
    date: defaultDate,
    startTime: '09:00',
    endTime: '10:00',
    body: '',
    location: '',
    isOnlineMeeting: true,
    timezone: 'America/Sao_Paulo',
  })
  const [attendees, setAttendees] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const toggleAttendee = (email: string) => setAttendees(prev => {
    const n = new Set(prev); n.has(email) ? n.delete(email) : n.add(email); return n
  })

  const submit = async () => {
    if (!form.subject.trim()) { setError('Subject is required.'); return }
    setSaving(true); setError('')
    try {
      const start = `${form.date}T${form.startTime}:00`
      const end   = `${form.date}T${form.endTime}:00`
      const { data } = await api.post('/api/calendar/invite', {
        subject: form.subject,
        start, end,
        body: form.body,
        location: form.location,
        attendees: [...attendees],
        is_online_meeting: form.isOnlineMeeting,
        timezone: form.timezone,
      }, { headers: calToken ? { 'X-Cal-Auth': calToken } : {} })
      if (!data.ok) throw new Error(data.detail || 'Failed')
      setSuccess(`Event created! "${data.subject}"`)
      qc.invalidateQueries({ queryKey: ['team-agenda-events'] })
      setTimeout(onClose, 2000)
    } catch (e: any) {
      setError(e.message || 'Could not create event.')
    } finally {
      setSaving(false)
    }
  }

  const TIMEZONES = ['America/Sao_Paulo','America/Argentina/Buenos_Aires','America/Bogota',
                     'America/Santiago','America/Mexico_City','America/New_York','Europe/Berlin','UTC']

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[90vh] overflow-y-auto border border-sap-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sap-border">
          <h3 className="text-[16px] font-bold text-sap-text flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0070F2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
            New Calendar Event
          </h3>
          <button onClick={onClose} className="text-sap-muted hover:text-sap-text transition text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          {/* Subject */}
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Subject *</label>
            <input value={form.subject} onChange={e => set('subject', e.target.value)}
              placeholder="Meeting title…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Start</label>
              <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">End</label>
              <input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)}
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Timezone</label>
            <select value={form.timezone} onChange={e => set('timezone', e.target.value)}
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue bg-white">
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {/* Location + Teams toggle */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                placeholder="Room or link…"
                className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue" />
            </div>
            <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
              <div onClick={() => set('isOnlineMeeting', !form.isOnlineMeeting)}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.isOnlineMeeting ? 'bg-sap-blue' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isOnlineMeeting ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-[12px] font-medium text-sap-text">Teams meeting</span>
            </label>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1.5">
              Attendees ({attendees.size} selected)
            </label>
            <div className="border border-sap-border rounded-xl overflow-hidden">
              {allMembers.map(m => {
                const email = m.email.toLowerCase()
                const checked = attendees.has(email)
                return (
                  <button key={email} onClick={() => toggleAttendee(email)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-sap-bg transition text-left border-b border-sap-border last:border-b-0 ${
                      checked ? 'bg-[#EBF8FF]' : ''}`}>
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      checked ? 'bg-sap-blue border-sap-blue' : 'border-sap-border'}`}>
                      {checked && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-sap-blue flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {m.name.split(' ').map((n:string) => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-[11px] text-sap-muted truncate">{m.email}</div>
                    </div>
                    {m.me && <span className="text-[9px] bg-sap-blue text-white px-1 rounded flex-shrink-0">me</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Body / notes */}
          <div>
            <label className="block text-[11px] font-semibold text-sap-muted uppercase tracking-wide mb-1">Description</label>
            <textarea value={form.body} onChange={e => set('body', e.target.value)}
              rows={3} placeholder="Optional agenda or notes…"
              className="w-full border border-sap-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-sap-blue resize-none" />
          </div>

          {/* Status messages */}
          {error && <p className="text-[12px] text-sap-error bg-[#FDE8E8] rounded-lg px-3 py-2">⚠ {error}</p>}
          {success && <p className="text-[12px] text-[#1B5E20] bg-[#E8F5E9] rounded-lg px-3 py-2">✓ {success}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sap-border flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg border border-sap-border text-sap-muted hover:bg-sap-bg transition">
            Cancel
          </button>
          <button onClick={submit} disabled={saving || !!success}
            className="px-5 py-1.5 text-[13px] font-semibold rounded-lg bg-sap-blue text-white hover:bg-sap-blue-d transition disabled:opacity-60 flex items-center gap-1.5">
            {saving && <span style={{ display:'inline-block', width:11, height:11, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />}
            {saving ? 'Creating…' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export function TeamAgendaPage() {
  const qc = useQueryClient()
  const outlook = useOutlookToken()
  const calToken = outlook.calToken?.() || ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [view, setView] = useState<'week' | 'month'>('week')
  const [cursor, setCursor] = useState(new Date(today))
  const [memberFilter, setMemberFilter] = useState<'all' | 'direct'>('direct')
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())  // empty = all visible
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // compute range from cursor + view
  const { rangeStart, rangeEnd, label } = useMemo(() => {
    if (view === 'week') {
      const ws = startOfWeek(cursor)
      const we = addDays(ws, 6)
      return {
        rangeStart: isoDate(ws), rangeEnd: isoDate(we),
        label: `${fmtWeekHeader(ws)} – ${fmtWeekHeader(we)}`,
        ws,
      }
    } else {
      const ms = startOfMonth(cursor)
      const me = endOfMonth(cursor)
      return {
        rangeStart: isoDate(ms), rangeEnd: isoDate(me),
        label: cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        ws: ms,
      }
    }
  }, [cursor, view])

  const weekStart = view === 'week' ? startOfWeek(cursor) : startOfMonth(cursor)

  function navigate(dir: 1 | -1) {
    const next = new Date(cursor)
    if (view === 'week') next.setDate(next.getDate() + dir * 7)
    else next.setMonth(next.getMonth() + dir)
    setCursor(next)
  }

  const { data: teamRaw = [] } = useQuery({
    queryKey: ['team-agenda-team'],
    queryFn: fetchTeam,
    staleTime: 60 * 60_000,
  })

  const { data: status } = useQuery({
    queryKey: ['team-agenda-status'],
    queryFn: fetchStatus,
    staleTime: 5 * 60_000,
  })

  // All team members list (base pool based on Colleagues / Direct Reports toggle)
  const allMembers = useMemo(() => {
    const all = Array.isArray(teamRaw) ? teamRaw : []
    if (memberFilter === 'direct') return all.filter(m => !m.me)
    return all
  }, [teamRaw, memberFilter])

  // Apply individual name multiselect on top
  const members = useMemo(() => {
    if (selectedNames.size === 0) return allMembers
    return allMembers.filter(m => selectedNames.has(m.name))
  }, [allMembers, selectedNames])

  const { data: eventsData, isLoading, error } = useQuery({
    queryKey: ['team-agenda-events', rangeStart, rangeEnd, calToken],
    queryFn: () => fetchEvents(rangeStart, rangeEnd, calToken),
    staleTime: 10 * 60_000,
    enabled: !!calToken,
  })

  const refreshMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/calendar/snapshot/refresh', {}, {
        headers: calToken ? { 'X-Cal-Auth': calToken } : {},
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-agenda-events'] })
      qc.invalidateQueries({ queryKey: ['team-agenda-status'] })
    },
  })

  // Week number display
  const weekNum = useMemo(() => {
    const d = view === 'week' ? startOfWeek(cursor) : cursor
    const jan1 = new Date(d.getFullYear(), 0, 1)
    return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  }, [cursor, view])

  return (
    <div className="flex flex-col h-full bg-sap-bg">
      {/* ── Outlook token banner ── */}
      {(!outlook.tokenValid || (outlook.expiresIn != null && outlook.expiresIn <= 10)) && (
        <div className="mx-5 mt-3 flex items-center justify-between gap-4 rounded-xl px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: outlook.tokenValid ? '#FFF8E1' : '#FFEBEE', border: `1px solid ${outlook.tokenValid ? '#F0AB00' : '#EF9A9A'}`, color: outlook.tokenValid ? '#7A5800' : '#BB0000' }}>
          <span>
            {outlook.tokenValid
              ? `⚠ Outlook token expires in ${outlook.expiresIn} min — renove para carregar a agenda.`
              : '⚠ Outlook token required to load team agenda.'}
          </span>
          <button onClick={outlook.openRelay} disabled={outlook.isWaiting}
            className="flex items-center gap-1.5 text-[12px] font-bold rounded-lg px-3 py-1.5 text-white transition disabled:opacity-60"
            style={{ background: outlook.isWaiting ? '#788fa6' : '#0070B8', flexShrink: 0 }}>
            {outlook.isWaiting ? 'Waiting…' : '🔑 Connect Outlook'}
          </button>
        </div>
      )}
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-sap-border flex-shrink-0">
        {/* Colleagues / Direct Reports toggle */}
        <div className="flex rounded-lg border border-sap-border overflow-hidden">
          <button
            onClick={() => { setMemberFilter('all'); setSelectedNames(new Set()) }}
            className={`px-4 py-1.5 text-[13px] font-medium transition ${
              memberFilter === 'all' ? 'bg-sap-blue text-white' : 'bg-white text-sap-text hover:bg-sap-bg'}`}>
            Colleagues
          </button>
          <button
            onClick={() => { setMemberFilter('direct'); setSelectedNames(new Set()) }}
            className={`px-4 py-1.5 text-[13px] font-medium transition ${
              memberFilter === 'direct' ? 'bg-sap-blue text-white' : 'bg-white text-sap-text hover:bg-sap-bg'}`}>
            Direct Reports
          </button>
        </div>

        {/* Member multiselect picker */}
        <div className="relative">
          <button
            onClick={() => setShowMemberPicker(p => !p)}
            className={`flex items-center gap-1.5 text-[12px] font-medium border rounded-lg px-3 py-1.5 transition ${
              selectedNames.size > 0
                ? 'border-sap-blue bg-[#E3F2FD] text-sap-blue'
                : 'border-sap-border hover:bg-sap-bg text-sap-text'}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              <circle cx="19" cy="7" r="2"/><path d="M23 21v-1a3 3 0 0 0-3-3"/>
            </svg>
            {selectedNames.size > 0 ? `${selectedNames.size} selected` : 'Filter People'}
          </button>
          {showMemberPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-sap-border rounded-xl shadow-lg z-50 w-64 py-2"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
              <div className="px-3 pb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-sap-muted uppercase tracking-wide">Filter by person</span>
                {selectedNames.size > 0 && (
                  <button onClick={() => setSelectedNames(new Set())}
                    className="text-[10px] text-sap-error hover:underline">Clear</button>
                )}
              </div>
              {allMembers.map(m => {
                const key = m.name
                const checked = selectedNames.has(key)
                return (
                  <button key={key}
                    onClick={() => setSelectedNames(prev => {
                      const n = new Set(prev)
                      checked ? n.delete(key) : n.add(key)
                      return n
                    })}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] hover:bg-sap-bg transition text-left ${
                      checked ? 'text-sap-blue font-semibold' : 'text-sap-text'}`}>
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      checked ? 'bg-sap-blue border-sap-blue' : 'border-sap-border'}`}>
                      {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="white"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-sap-blue flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {m.name.split(' ').map((n:string) => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <span className="truncate">{m.name}</span>
                    {m.me && <span className="text-[9px] bg-sap-blue text-white px-1 rounded ml-auto flex-shrink-0">me</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Filter status badge */}
        {error && calToken && (
          <span className="text-[11px] text-sap-error bg-[#FDE8E8] px-2 py-1 rounded">
            ⚠ Error ao carregar eventos — verifique o token Outlook
          </span>
        )}
        {!calToken && (
          <span className="text-[11px] text-sap-muted bg-[#FFF3E0] border border-[#FFB74D] px-2 py-1 rounded">
            🔑 Outlook token not connected
          </span>
        )}
        {status && (
          <span className="text-[11px] text-sap-muted">
            Updated: {status.refreshed_at ? new Date(status.refreshed_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
          </span>
        )}

        {/* New Event button */}
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 text-[12px] font-semibold bg-sap-blue text-white rounded-lg px-3 py-1.5 hover:bg-sap-blue-d transition">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
          New Event
        </button>

        {/* Refresh button */}
        <button
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="flex items-center gap-1.5 text-[12px] font-medium border border-sap-border rounded-lg px-3 py-1.5 hover:bg-sap-bg transition disabled:opacity-50">
          <RefreshCw size={13} className={refreshMut.isPending ? 'animate-spin' : ''} />
          {refreshMut.isPending ? 'Refreshing…' : 'Refresh'}
        </button>

        {/* View toggle */}
        <div className="flex rounded-lg border border-sap-border overflow-hidden">
          <button
            onClick={() => setView('week')}
            title="Week view"
            className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-medium transition ${
              view === 'week' ? 'bg-sap-blue text-white' : 'bg-white text-sap-text hover:bg-sap-bg'}`}>
            <CalendarDays size={14} />
            1 Week
          </button>
          <button
            onClick={() => setView('month')}
            title="Month view"
            className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-medium transition ${
              view === 'month' ? 'bg-sap-blue text-white' : 'bg-white text-sap-text hover:bg-sap-bg'}`}>
            <LayoutGrid size={14} />
            1 Month
          </button>
        </div>
      </div>

      {/* ── Navigation bar ── */}
      <div className="flex items-center gap-3 px-5 py-2 bg-white border-b border-sap-border flex-shrink-0">
        <button
          onClick={() => setCursor(new Date(today))}
          className="text-[12px] font-semibold text-sap-blue border border-sap-blue rounded-lg px-3 py-1 hover:bg-[#E3F2FD] transition">
          Today
        </button>
        <button onClick={() => navigate(-1)}
          className="p-1 rounded-lg hover:bg-sap-bg border border-sap-border transition">
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => navigate(1)}
          className="p-1 rounded-lg hover:bg-sap-bg border border-sap-border transition">
          <ChevronRight size={16} />
        </button>
        <span className="text-[14px] font-semibold text-sap-blue">{label}</span>
        {view === 'week' && (
          <span className="text-[12px] text-sap-muted ml-1">Week {weekNum}</span>
        )}
        {isLoading && (
          <span className="text-[11px] text-sap-muted animate-pulse ml-2">Loading…</span>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {[
            { label: 'Absent',        bg: '#F5F5F5', border: '#9E9E9E' },
            { label: 'Meeting',       bg: '#E3F2FD', border: '#1565C0' },
            { label: 'Local Event',   bg: '#E8F5E9', border: '#43A047' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ background: l.bg, border: `1.5px solid ${l.border}` }} />
              <span className="text-[10px] text-sap-muted">{l.label}</span>
            </div>
          ))}
          <div className="w-px h-3 bg-sap-border mx-1" />
          {(['BR','AR','CL','CO','MX'] as const).map(c => {
            const col = COUNTRY_COLORS[c]
            const labels = { BR:'🇧🇷', AR:'🇦🇷', CL:'🇨🇱', CO:'🇨🇴', MX:'🇲🇽' }
            return (
              <div key={c} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ background: col.bg, border: `1.5px solid ${col.border}` }} />
                <span className="text-[10px] text-sap-muted">{labels[c]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-auto overflow-x-auto">
        {!calToken ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-sap-muted">
            <div className="text-4xl">📅</div>
            <p className="text-[14px] font-medium">Connect Outlook to view the agenda</p>
            <button onClick={outlook.openRelay}
              className="text-[13px] font-semibold bg-sap-blue text-white px-4 py-2 rounded-lg hover:bg-sap-blue-d transition">
              🔑 Connect Outlook
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sap-muted text-sm">
            Loading team members…
          </div>
        ) : view === 'week' ? (
          <WeekView
            today={today}
            weekStart={startOfWeek(cursor)}
            members={members}
            eventsData={eventsData}
          />
        ) : (
          <MonthView
            today={today}
            monthStart={startOfMonth(cursor)}
            members={members}
            eventsData={eventsData}
          />
        )}
      </div>
      {refreshMut.isError && (
        <div className="px-5 py-2 bg-[#FDE8E8] text-[12px] text-sap-error border-t border-sap-border">
          ⚠ Refresh failed — {String(refreshMut.error)}. Make sure Outlook token is active (ask Claude to list emails).
        </div>
      )}

      {/* Close member picker when clicking outside */}
      {showMemberPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMemberPicker(false)} />
      )}

      {/* ── Invite / New Event Modal ── */}
      {showInviteModal && (
        <InviteModal
          allMembers={allMembers}
          defaultDate={isoDate(cursor)}
          calToken={calToken}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  )
}
