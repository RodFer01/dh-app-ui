import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Globe } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

function Picto({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="w-4 h-4 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
}

const ONLINE_APPS = [
  { to: '/opportunities',   picto: '/icons/funnel.svg',        label: 'Opportunity List',   module: 'opportunities' },
  { to: '/ae-analysis',     picto: '/icons/pipeline.svg',      label: 'AE Territory',       module: 'ae_analysis' },
  { to: '/pipeline',        picto: '/icons/pipeline.svg',      label: 'ADRM Pipeline',      module: 'pipeline' },
  { to: '/melody',          picto: '/icons/melody.svg',        label: 'Melody Analysis',    module: 'melody' },
  { to: '/qualification',   picto: '/icons/qualification.svg', label: 'Deal Qualification', module: 'qualification' },
  { to: '/lac-results',     picto: '/icons/results.svg',       label: 'LAC Results',        module: 'lac_results' },
  { to: '/erp-team',        picto: '/icons/erp.svg',           label: 'ERP Team',           module: 'erp_team' },
  { to: '/melody-requests', picto: '/icons/requests.svg',      label: 'Melody Requests',    module: 'melody_requests' },
  { to: '/yoy',             picto: '/icons/yoy.svg',           label: '2025 vs 2026',       module: 'yoy' },
  { to: '/scheduler',       picto: '/icons/scheduler.svg',     label: 'Pipeline Scheduler', module: 'scheduler' },
]

const LOCAL_APPS = [
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
          ? 'bg-sap-blue-l text-sap-blue border-l-[3px] border-sap-blue ' + (collapsed ? 'pl-[9px]' : 'pl-[13px]')
          : 'text-sap-muted hover:bg-sap-blue-l hover:text-sap-blue'
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
        'flex-shrink-0 bg-white border-r border-sap-border flex flex-col overflow-y-auto overflow-x-hidden transition-all duration-200 relative',
        collapsed ? 'w-[52px]' : 'w-56'
      )}
    >
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute top-2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-sap-border text-sap-muted hover:text-sap-blue hover:border-sap-blue transition-colors shadow-sm',
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
        <div className={cn('border-t border-sap-border my-1', collapsed ? 'mx-1' : 'mx-4')} />

        {collapsed ? (
          <div className="mx-1 px-3 py-2 flex justify-center">
            <Globe size={16} className="text-sap-muted" />
          </div>
        ) : (
          <button
            onClick={() => setOnlineOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sap-muted hover:text-sap-blue transition-colors"
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
        <div className={cn('border-t border-sap-border my-1', collapsed ? 'mx-1' : 'mx-4')} />
        {!collapsed && (
          <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sap-muted">
            Local
          </div>
        )}
        {LOCAL_APPS.filter(({ module }) => canSee(module)).map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        {/* Admin */}
        {user?.role === 'admin' && (
          <>
            <div className={cn('border-t border-sap-border my-1', collapsed ? 'mx-1' : 'mx-4')} />
            <NavLink
              to="/admin"
              title={collapsed ? 'Administration' : undefined}
              className={({ isActive }) => cn(
                'group flex items-center gap-2.5 py-2 text-[13px] font-medium rounded-md my-0.5 transition-colors',
                collapsed ? 'mx-1 px-3 justify-center' : 'mx-2 px-4',
                isActive
                  ? 'bg-red-50 text-sap-error border-l-[3px] border-sap-error ' + (collapsed ? 'pl-[9px]' : 'pl-[13px]')
                  : 'text-sap-muted hover:bg-red-50 hover:text-sap-error'
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
