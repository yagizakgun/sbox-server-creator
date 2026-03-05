import React, { useEffect, useState } from 'react'
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Server } from 'lucide-react'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import ServerEditor from './pages/ServerEditor'
import Logs from './pages/Logs'
import Permissions from './pages/Permissions'

function Sidebar(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="flex w-14 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar-background py-3">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        title="Dashboard"
      >
        <Server className="h-5 w-5" />
      </button>
    </div>
  )
}

function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}

function RootRedirect(): React.JSX.Element {
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    window.api.steamcmd.isSetupComplete().then((done) => {
      setReady(done)
      setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return <Navigate to={ready ? '/dashboard' : '/setup'} replace />
}

export default function App(): React.JSX.Element {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/setup" element={<Setup />} />
        <Route
          path="/dashboard"
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          }
        />
        <Route
          path="/server/:id"
          element={
            <AppLayout>
              <ServerEditor />
            </AppLayout>
          }
        />
        <Route
          path="/logs/:id"
          element={
            <AppLayout>
              <Logs />
            </AppLayout>
          }
        />
        <Route
          path="/permissions/:id"
          element={
            <AppLayout>
              <Permissions />
            </AppLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  )
}
