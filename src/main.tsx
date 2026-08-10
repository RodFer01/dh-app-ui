import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

class ErrorBoundary extends Component<{children: ReactNode},{error: Error|null,info: string}> {
  state = { error: null, info: '' }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info: info.componentStack || '' })
  }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error
      return (
        <div style={{padding:'2rem',fontFamily:'monospace',background:'#fff3cd',border:'2px solid #ffc107',margin:'2rem',borderRadius:'8px'}}>
          <h2 style={{color:'#856404',marginBottom:'1rem'}}>⚠️ App Error (check DevTools Console for details)</h2>
          <pre style={{color:'#721c24',whiteSpace:'pre-wrap',fontSize:'13px',fontWeight:'bold'}}>{e.message}</pre>
          <pre style={{color:'#555',whiteSpace:'pre-wrap',fontSize:'11px',marginTop:'1rem'}}>{e.stack?.split('\n').slice(0,10).join('\n')}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) {
  document.body.innerHTML = '<div style="padding:2rem;color:red;font-size:1.5rem">ERROR: #root element not found</div>'
} else {
  try {
    createRoot(root).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )
  } catch(e) {
    root.innerHTML = `<div style="padding:2rem;font-family:monospace;background:#ffcccc;border-radius:8px;margin:2rem">
      <h2>Startup Error</h2>
      <pre>${String(e)}</pre>
    </div>`
  }
}
