// @ts-nocheck
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ShellBar } from './components/ShellBar'
import { Sidebar } from './components/Sidebar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage }             from './pages/LoginPage'
import { HomePage }              from './pages/HomePage'
import { OpportunityListPage }   from './pages/OpportunityListPage'
import { ADRMPipelinePage }      from './pages/ADRMPipelinePage'
import { MelodyPage }            from './pages/MelodyPage'
import { DealQualificationPage } from './pages/DealQualificationPage'
import { LACResultsPage }        from './pages/LACResultsPage'
import { ERPTeamPage }           from './pages/ERPTeamPage'
import { LoBsTeamPage }          from './pages/LoBsTeamPage'
import { MelodyRequestsPage }    from './pages/MelodyRequestsPage'
import { ETLPage }               from './pages/ETLPage'
import { YoYPage }               from './pages/YoYPage'
import { PipelineSchedulerPage } from './pages/PipelineSchedulerPage'
import { FeedbackSessionPage }   from './pages/FeedbackSessionPage'
import { DHManagerReportPage }   from './pages/DHManagerReportPage'
import { TeamAgendaPage }        from './pages/TeamAgendaPage'
import { ActionsPage }           from './pages/ActionsPage'
import { OutlookFlaggedPage }    from './pages/OutlookFlaggedPage'
import { IdeaZonePage }          from './pages/IdeaZonePage'
import { AdminPage }             from './pages/AdminPage'
import { AEAnalysisPage }        from './pages/AEAnalysisPage'
import { CampaignsPage }          from './pages/CampaignsPage'
import { BookingsPage }           from './pages/BookingsPage'
import PipelineProgressionPage   from './pages/PipelineProgressionPage'
import PartnerAnalysisPage        from './pages/PartnerAnalysisPage'
import ToDoActivitiesPage         from './pages/ToDoActivitiesPage'
import { Component } from 'react'

class ErrorBoundary extends Component {
  state = { error: null }
  componentDidCatch(e) { this.setState({ error: e }) }
  render() {
    if (this.state.error) {
      const e = this.state.error
      return (
        <div style={{padding:'2rem',fontFamily:'monospace',background:'#fff3cd',border:'2px solid #ffc107',margin:'2rem',borderRadius:'8px'}}>
          <h2 style={{color:'#856404'}}>⚠️ Page Error</h2>
          <pre style={{color:'#721c24',fontSize:'13px',whiteSpace:'pre-wrap'}}>{e?.message}</pre>
          <pre style={{color:'#555',fontSize:'11px',whiteSpace:'pre-wrap'}}>{e?.stack?.split('\n').slice(0,8).join('\n')}</pre>
          <button onClick={() => this.setState({error:null})} style={{marginTop:'1rem',padding:'8px 16px',background:'#0070f2',color:'white',border:'none',borderRadius:'6px',cursor:'pointer'}}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ShellBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-sap-bg">
          <ErrorBoundary>
            <Routes>
              <Route path="/"                element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/opportunities"   element={<ProtectedRoute module="opportunities"><OpportunityListPage /></ProtectedRoute>} />
              <Route path="/pipeline"        element={<ProtectedRoute module="pipeline"><ADRMPipelinePage /></ProtectedRoute>} />
              <Route path="/melody"          element={<ProtectedRoute module="melody"><MelodyPage /></ProtectedRoute>} />
              <Route path="/qualification"   element={<ProtectedRoute module="qualification"><DealQualificationPage /></ProtectedRoute>} />
              <Route path="/lac-results"     element={<ProtectedRoute module="lac_results"><LACResultsPage /></ProtectedRoute>} />
              <Route path="/erp-team"        element={<ProtectedRoute module="erp_team"><ERPTeamPage /></ProtectedRoute>} />
              <Route path="/lobs-team"       element={<ProtectedRoute module="lobs_team"><LoBsTeamPage /></ProtectedRoute>} />
              <Route path="/melody-requests" element={<ProtectedRoute module="melody_requests"><MelodyRequestsPage /></ProtectedRoute>} />
              <Route path="/etl"             element={<ProtectedRoute module="etl"><ETLPage /></ProtectedRoute>} />
              <Route path="/yoy"             element={<ProtectedRoute module="yoy"><YoYPage /></ProtectedRoute>} />
              <Route path="/scheduler"       element={<ProtectedRoute module="scheduler"><PipelineSchedulerPage /></ProtectedRoute>} />
              <Route path="/feedback"        element={<ProtectedRoute module="feedback"><FeedbackSessionPage /></ProtectedRoute>} />
              <Route path="/mgr-report"      element={<ProtectedRoute><DHManagerReportPage /></ProtectedRoute>} />
              <Route path="/todo-activities" element={<ProtectedRoute module="todo_activities"><ToDoActivitiesPage /></ProtectedRoute>} />
              <Route path="/team-agenda"     element={<ProtectedRoute module="team_agenda"><TeamAgendaPage /></ProtectedRoute>} />
              <Route path="/actions"         element={<ProtectedRoute module="actions"><ActionsPage /></ProtectedRoute>} />
              <Route path="/outlook-flagged" element={<ProtectedRoute><OutlookFlaggedPage /></ProtectedRoute>} />
              <Route path="/idea-zone"       element={<ProtectedRoute module="idea_zone"><IdeaZonePage /></ProtectedRoute>} />
              <Route path="/ae-analysis"     element={<ProtectedRoute module="ae_analysis"><AEAnalysisPage /></ProtectedRoute>} />
              <Route path="/campaigns"       element={<ProtectedRoute module="campaigns"><CampaignsPage /></ProtectedRoute>} />
              <Route path="/bookings"              element={<ProtectedRoute module="bookings"><BookingsPage /></ProtectedRoute>} />
              <Route path="/pipeline-progression" element={<ProtectedRoute module="pipeline"><PipelineProgressionPage /></ProtectedRoute>} />
              <Route path="/partner-analysis"     element={<ProtectedRoute module="pipeline"><PartnerAnalysisPage /></ProtectedRoute>} />
              <Route path="/admin"                element={<ProtectedRoute module="admin"><AdminPage /></ProtectedRoute>} />
              <Route path="*"                element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

// QueryClient created inside component to avoid module-level state issues in production
export default function App() {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } }
  }))
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<LoginPage />} />
              <Route path="/*"     element={<AppLayout />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
