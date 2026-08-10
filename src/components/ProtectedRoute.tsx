import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children, module }: { children: ReactNode; module?: string }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (module && user.role !== 'admin' && !user.modules?.includes(module)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
