import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Download,
  FolderOpen,
  ArrowRight,
  ArrowLeft,
  Terminal,
  Server
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Progress } from '@renderer/components/ui/progress'
import { LogViewer } from '@renderer/components/LogViewer'
import { cn } from '@renderer/lib/utils'

type Step = 'steamcmd' | 'install-steamcmd' | 'sbox-server' | 'done'

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'steamcmd', label: 'SteamCMD', icon: <Terminal className="h-4 w-4" /> },
  { id: 'install-steamcmd', label: 'Install SteamCMD', icon: <Download className="h-4 w-4" /> },
  { id: 'sbox-server', label: 'sbox Server', icon: <Server className="h-4 w-4" /> },
  { id: 'done', label: 'Done', icon: <CheckCircle2 className="h-4 w-4" /> }
]

export default function Setup(): React.JSX.Element {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('steamcmd')
  const [steamcmdDir, setSteamcmdDir] = useState('')
  const [serverDir, setServerDir] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [followLogs, setFollowLogs] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.steamcmd.getDefaultDir().then((d) => {
      setSteamcmdDir(d)
      setServerDir(d.replace(/steamcmd$/, 'sbox-server'))
    })
  }, [])

  const browseSteamcmdDir = async (): Promise<void> => {
    const p = await window.api.steamcmd.browsePath()
    if (p) setSteamcmdDir(p)
  }

  const browseServerDir = async (): Promise<void> => {
    const p = await window.api.steamcmd.browsePath()
    if (p) setServerDir(p)
  }

  const installSteamcmd = useCallback(async () => {
    setBusy(true)
    setError('')
    setLogs([])
    setFollowLogs(true)
    setProgress(0)

    const unsub = window.api.steamcmd.onInstallProgress(({ percent, message }) => {
      setProgress(Math.round(percent * 100))
      setProgressMsg(message)
      setLogs((prev) => [...prev, message])
    })

    try {
      const result = await window.api.steamcmd.install(steamcmdDir)
      if (result.success) {
        setLogs([])
        setProgress(0)
        setProgressMsg('')
        setStep('sbox-server')
      } else {
        setError(result.error ?? 'Installation failed')
      }
    } finally {
      unsub()
      setBusy(false)
    }
  }, [steamcmdDir])

  const installSboxServer = useCallback(async () => {
    setBusy(true)
    setError('')
    setLogs([])
    setFollowLogs(true)
    setProgress(0)
    setProgressMsg('Starting...')

    const unsub = window.api.steamcmd.onUpdateProgress(({ percent, message }) => {
      setProgress(percent > 0 ? Math.round(percent * 100) : progress)
      setProgressMsg(message)
      setLogs((prev) => [...prev, message])
    })

    try {
      const result = await window.api.steamcmd.updateServer(serverDir)
      if (result.success) {
        setStep('done')
      } else {
        setError(result.error ?? 'Installation failed')
      }
    } finally {
      unsub()
      setBusy(false)
    }
  }, [serverDir])

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Server className="h-4 w-4" />
          </div>
          <span className="font-semibold text-foreground">sbox Server Creator</span>
        </div>
        <span className="text-sm text-muted-foreground">First-time Setup</span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 border-b border-border px-8 py-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                i < stepIndex
                  ? 'bg-success/20 text-success'
                  : i === stepIndex
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground'
              )}
            >
              {i < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.icon}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div className="w-full max-w-xl">
          {step === 'steamcmd' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">SteamCMD Setup</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  SteamCMD is required to download and update the sbox dedicated server. Choose an
                  install directory.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="steamcmd-dir">SteamCMD Directory</Label>
                <div className="flex gap-2">
                  <Input
                    id="steamcmd-dir"
                    value={steamcmdDir}
                    onChange={(e) => setSteamcmdDir(e.target.value)}
                    placeholder="C:\steamcmd"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={browseSteamcmdDir}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  SteamCMD will be downloaded and extracted here (~50MB)
                </p>
              </div>
              <Button
                className="w-full"
                disabled={!steamcmdDir}
                onClick={() => setStep('install-steamcmd')}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 'install-steamcmd' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Installing SteamCMD</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Downloading and setting up SteamCMD at:
                  <br />
                  <code className="text-primary">{steamcmdDir}</code>
                </p>
              </div>

              {!busy && !logs.length && (
                <div className="space-y-3">
                  <Button className="w-full" onClick={installSteamcmd}>
                    <Download className="h-4 w-4" />
                    Download &amp; Install SteamCMD
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => setStep('steamcmd')}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>
              )}

              {(busy || logs.length > 0) && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{progressMsg}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                  <LogViewer
                    lines={logs}
                    follow={followLogs}
                    onFollowChange={setFollowLogs}
                    className="h-48"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={installSteamcmd}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 'sbox-server' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Install sbox Server</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Downloads the sbox Dedicated Server (App ID 1892930) via SteamCMD. This may take
                  several minutes.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-dir">Server Install Directory</Label>
                <div className="flex gap-2">
                  <Input
                    id="server-dir"
                    value={serverDir}
                    onChange={(e) => setServerDir(e.target.value)}
                    placeholder="C:\sbox-server"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={browseServerDir}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {!busy && !logs.length && (
                <Button className="w-full" disabled={!serverDir} onClick={installSboxServer}>
                  <Download className="h-4 w-4" />
                  Install sbox Dedicated Server
                </Button>
              )}

              {(busy || logs.length > 0) && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="truncate">{progressMsg}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                  <LogViewer
                    lines={logs}
                    follow={followLogs}
                    onFollowChange={setFollowLogs}
                    className="h-52"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={installSboxServer}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Setup Complete!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  sbox Dedicated Server has been installed successfully. You can now create and
                  manage your servers.
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate('/dashboard')}>
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
