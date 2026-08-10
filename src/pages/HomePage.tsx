import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { SectionLabel } from '../components/SectionLabel'
import { useAuth } from '../context/AuthContext'
import { formatAcvK } from '../lib/utils'

// Each app maps to a module key — same keys used in permissions
const APPS = [
  { title: 'AE Territory Analysis', subtitle: 'Território por AE · indústria · sugestões SAP', icon: '🗺️', accent: '#0070f2', to: '/ae-analysis', module: null },
  { title: 'Opportunity List',    subtitle: 'Pipeline review with AEs',    icon: '📋', accent: '#0070f2', to: '/opportunities',   module: 'opportunities' },
  { title: 'ADRM Pipeline',       subtitle: 'Dashboard analytics',          icon: '📊', accent: '#5d36ff', to: '/pipeline',        module: 'pipeline' },
  { title: 'Melody Analysis',     subtitle: 'SA activity tracking',         icon: '🎵', accent: '#046c7a', to: '/melody',          module: 'melody' },
  { title: 'Deal Qualification',  subtitle: 'Score & qualification analysis',icon: '🔬', accent: '#e76500', to: '/qualification',  module: 'qualification' },
  { title: 'LAC Results',         subtitle: 'Booked / Lost analysis',       icon: '🌎', accent: '#256f3a', to: '/lac-results',     module: 'lac_results' },
  { title: 'ERP Team Dashboard',  subtitle: 'ERP attainment vs quota',      icon: '💼', accent: '#0070f2', to: '/erp-team',        module: 'erp_team' },
  { title: 'LoBs Team Dashboard', subtitle: 'HCM · FSM · CX · BAIP · SCM', icon: '🤝', accent: '#aa0808', to: '/lobs-team',       module: 'lobs_team' },
  { title: 'Melody Requests',     subtitle: 'My Request management',        icon: '⬆',  accent: '#556b82', to: '/melody-requests', module: 'melody_requests' },
  { title: '2025 vs 2026',        subtitle: 'Year-over-year comparison',    icon: '📈', accent: '#5d36ff', to: '/yoy',             module: 'yoy' },
  { title: 'DH Manager Report',   subtitle: 'Team performance overview',    icon: '📉', accent: '#256f3a', to: '/mgr-report',      module: null },
  { title: 'Team Agenda',         subtitle: 'Calendar & meetings',          icon: '📅', accent: '#0070f2', to: '/team-agenda',     module: 'team_agenda' },
  { title: 'Pipeline Scheduler',  subtitle: 'Schedule pipeline reviews',    icon: '🗓', accent: '#0070f2', to: '/scheduler',       module: 'scheduler' },
  { title: '1:1 Feedback',        subtitle: 'Team meeting notes',           icon: '💬', accent: '#046c7a', to: '/feedback',        module: 'feedback' },
  { title: 'Actions',             subtitle: 'Track customer actions',       icon: '✅', accent: '#256f3a', to: '/actions',         module: 'actions' },
  { title: 'Outlook Flagged',     subtitle: 'Flagged emails → create todos', icon: '📬', accent: '#0070f2', to: '/outlook-flagged',  module: null },
  { title: 'IdeaZone',           subtitle: 'Feature requests & voting',     icon: '💡', accent: '#F0AB00', to: '/idea-zone',       module: 'idea_zone' },
  { title: 'Update Data',     subtitle: 'ETL data refresh',             icon: '🔄', accent: '#e76500', to: '/etl',             module: 'etl' },
  { title: 'Administration',      subtitle: 'User & permissions management',icon: '⚙', accent: '#BB0000', to: '/admin',           module: 'admin' },
]

export function HomePage() {
  const { user, currency, fxRate } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.name.split(',')[0].trim().split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const { data: summary } = useQuery({
    queryKey: ['pipeline-summary'],
    queryFn: () => api.get('/api/pipeline/summary').then(r => r.data),
  })

  const acvActive = (summary?.acv_active ?? 0) * fxRate
  const acvBooked = (summary?.acv_booked ?? 0) * fxRate

  // Filter apps by user modules — admin sees all, others see only their modules
  const visibleApps = APPS.filter(app => {
    if (!app.module) return true  // no module restriction (e.g. DH Manager Report)
    if (user?.role === 'admin') return true
    return user?.modules?.includes(app.module)
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-sap-text">{greeting}, {firstName}</h1>
        <p className="text-sm text-sap-muted">Here's your workspace for today.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KpiCard label="Active Pipeline"  value={formatAcvK(acvActive, currency)} sub={`${(summary?.n_opps ?? 0).toLocaleString()} opportunities`} />
        <KpiCard label="Booked / Won"     value={formatAcvK(acvBooked, currency)} color="green" sub={`${currency} · current snapshot`} />
        <KpiCard label="Digital Engaged"  value={(summary?.n_digital ?? 0).toLocaleString()} color="blue" sub="opportunities with DH SA" />
      </div>

      {/* Apps grid — only modules the user has access to */}
      <SectionLabel>Applications</SectionLabel>
      <div className="grid grid-cols-3 gap-4">
        {visibleApps.map(app => (
          <AppCard
            key={app.title}
            {...app}
            onClick={() => navigate(app.to)}
          />
        ))}
      </div>
    </div>
  )
}

function AppCard({ title, subtitle, icon, accent, onClick }: {
  title: string; subtitle: string; icon: string; accent: string; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="card p-5 cursor-pointer hover:shadow-hover hover:-translate-y-0.5 transition-all duration-150 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: accent }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0"
             style={{ background: `${accent}18` }}>
          {icon}
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#e8f5e9] text-[#256f3a]">live</span>
      </div>
      <div className="font-bold text-sap-text text-[15px]">{title}</div>
      <div className="text-[12px] font-semibold mt-0.5" style={{ color: accent }}>{subtitle}</div>
    </div>
  )
}
