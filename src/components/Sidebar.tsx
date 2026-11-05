import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Globe } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

function Picto({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="w-4 h-4 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity invert" />
}

const ONLINE_APPS = [
  { to: '/opportunities',   picto: '/icons/funnel.svg',        label: 'Opportunity List',   module: 'opportunities' },
  { to: '/ae-analysis',     picto: '/icons/pipeline.svg',      label: 'AE Territory',       module: 'ae_analysis' },
  { to: '/pipeline',              picto: '/icons/pipeline.svg',      label: 'ADRM Pipeline',      module: 'pipeline' },
  { to: '/pipeline-progression', picto: '/icons/pipeline.svg',      label: 'Pipeline Progression', module: 'pipeline' },
  { to: '/partner-analysis',     picto: '/icons/pipeline.svg',      label: 'Partner Analysis',     module: 'pipeline' },
  { to: '/melody',          picto: '/icons/melody.svg',        label: 'Melody Analysis',    module: 'melody' },
  { to: '/qualification',   picto: '/icons/qualification.svg', label: 'Deal Qualification', module: 'qualification' },
  { to: '/lac-results',     picto: '/icons/results.svg',       label: 'LAC Results',        module: 'lac_results' },
  { to: '/erp-team',        picto: '/icons/erp.svg',           label: 'ERP Team',           module: 'erp_team' },
  { to: '/lobs-team',       picto: '/icons/lobs.svg',          label: 'LoBs Team',          module: 'lobs_team' },
  { to: '/melody-requests', picto: '/icons/requests.svg',      label: 'Melody Requests',    module: 'melody_requests' },
  { to: '/yoy',             picto: '/icons/yoy.svg',           label: '2025 vs 2026',       module: 'yoy' },
  { to: '/campaigns',       picto: '/icons/requests.svg',      label: 'Campanhas',          module: 'campaigns' },
  { to: '/bookings',        picto: '/icons/results.svg',       label: 'Bookings',           module: 'bookings' },
]

const LOCAL_APPS = [
  { to: '/todo-activities', picto: '/icons/scheduler.svg', label: 'To Do Activities', module: 'todo_activities' },
  { to: '/team-agenda',     picto: '/icons/scheduler.svg', label: 'Team Agenda',    module: 'team_agenda' },
  { to: '/actions',         picto: '/icons/requests.svg',  label: 'Actions',        module: 'actions' },
  { to: '/outlook-flagged', picto: '/icons/requests.svg',  label: 'Outlook Flagged',module: null },
  { to: '/idea-zone',       picto: '/icons/etl.svg',       label: 'Idea Zone',      module: 'idea_zone' },
  { to: '/feedback',        picto: '/icons/requests.svg',  label: '1:1 Feedback',   module: 'feedback' },
]

const TOP_APPS = [
  { to: '/',           picto: '/icons/home.svg',    label: 'Home',          module: null },
  { to: '/mgr-report', picto: '/icons/results.svg', label: 'DH Mgr Report', module: null },
  { to: '/etl',        picto: '/icons/etl.svg',     label: 'Update Data',   module: 'etl' },
]

function NavItem({ to, picto, label, collapsed }: { to: string; picto: string; label: string; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cn(
        'group flex items-center gap-2.5 py-2 text-[13px] font-medium rounded-md my-0.5 transition-colors',
        collapsed ? 'mx-1 px-3 justify-center' : 'mx-2 px-4',
        isActive
          ? 'bg-white/20 text-white border-l-[3px] border-white ' + (collapsed ? 'pl-[9px]' : 'pl-[13px]')
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      <Picto src={picto} alt={label} />
      {!collapsed && label}
    </NavLink>
  )
}

export function Sidebar() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })
  const [onlineOpen, setOnlineOpen] = useState(() => {
    try { return localStorage.getItem('sidebar_online_open') !== 'false' } catch { return true }
  })

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', String(collapsed)) } catch {}
  }, [collapsed])

  useEffect(() => {
    try { localStorage.setItem('sidebar_online_open', String(onlineOpen)) } catch {}
  }, [onlineOpen])

  const canSee = (module: string | null) =>
    module === null || user?.role === 'admin' || user?.modules?.includes(module)

  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-[#003270] border-r border-[#002050] flex flex-col overflow-y-auto overflow-x-hidden transition-all duration-200 relative',
        collapsed ? 'w-[52px]' : 'w-56'
      )}
    >
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute top-2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-[#003270] border border-white/30 text-white/60 hover:text-white hover:border-white transition-colors shadow-sm',
          collapsed ? 'right-1' : 'right-2'
        )}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      <div className={cn('pt-8', collapsed ? 'px-0' : '')}>

        {/* Top flat items */}
        {TOP_APPS.filter(({ module }) => canSee(module)).map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        {/* Online Apps folder */}
        <div className={cn('border-t border-white/20 my-1', collapsed ? 'mx-1' : 'mx-4')} />

        {collapsed ? (
          <div className="mx-1 px-3 py-2 flex justify-center">
            <Globe size={16} className="text-white/40" />
          </div>
        ) : (
          <button
            onClick={() => setOnlineOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50 hover:text-white/80 transition-colors"
          >
            <Globe size={12} />
            <span className="flex-1 text-left">Online Apps</span>
            <ChevronDown size={11} className={cn('transition-transform', onlineOpen ? '' : '-rotate-90')} />
          </button>
        )}

        {(collapsed || onlineOpen) && ONLINE_APPS.filter(({ module }) => canSee(module)).map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        {/* Local Apps */}
        <div className={cn('border-t border-white/20 my-1', collapsed ? 'mx-1' : 'mx-4')} />
        {!collapsed && (
          <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Local
          </div>
        )}
        {LOCAL_APPS.filter(({ module }) => canSee(module)).map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        {/* Admin */}
        {user?.role === 'admin' && (
          <>
            <div className={cn('border-t border-white/20 my-1', collapsed ? 'mx-1' : 'mx-4')} />
            <NavLink
              to="/admin"
              title={collapsed ? 'Administration' : undefined}
              className={({ isActive }) => cn(
                'group flex items-center gap-2.5 py-2 text-[13px] font-medium rounded-md my-0.5 transition-colors',
                collapsed ? 'mx-1 px-3 justify-center' : 'mx-2 px-4',
                isActive
                  ? 'bg-red-500/20 text-red-300 border-l-[3px] border-red-400 ' + (collapsed ? 'pl-[9px]' : 'pl-[13px]')
                  : 'text-white/60 hover:bg-red-500/10 hover:text-red-300'
              )}
            >
              <Picto src="/icons/etl.svg" alt="Admin" />
              {!collapsed && '⚙ Administration'}
            </NavLink>
          </>
        )}
      </div>
    </aside>
  )
}
