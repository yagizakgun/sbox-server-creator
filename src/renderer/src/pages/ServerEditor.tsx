import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, FolderOpen, FileCode } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { Separator } from '@renderer/components/ui/separator'
import type { ServerConfig } from '@renderer/types'

const defaultForm: Omit<ServerConfig, 'id'> = {
  name: '',
  installPath: '',
  game: '',
  map: '',
  hostname: 'My sbox Server',
  token: '',
  extraArgs: ''
}

export default function ServerEditor(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'

  const [form, setForm] = useState<Omit<ServerConfig, 'id'>>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isNew) {
      window.api.server.list().then((list) => {
        const found = list.find((s) => s.id === id)
        if (found) {
          const { id: _id, ...rest } = found
          setForm(rest)
        } else {
          navigate('/dashboard')
        }
      })
    }
  }, [id, isNew, navigate])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const browseInstallPath = async (): Promise<void> => {
    const p = await window.api.steamcmd.browsePath()
    if (p) set('installPath', p)
  }

  const browseSbproj = async (): Promise<void> => {
    const p = await window.api.config.browseSbproj()
    if (p) set('game', p)
  }

  const handleSave = async (): Promise<void> => {
    setError('')
    if (!form.name.trim()) {
      setError('Server name is required')
      return
    }
    if (!form.installPath.trim()) {
      setError('Install path is required')
      return
    }
    if (!form.game.trim()) {
      setError('Game package is required')
      return
    }
    if (!form.hostname.trim()) {
      setError('Hostname is required')
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        await window.api.server.create(form)
      } else {
        await window.api.server.update({ id: id!, ...form } as ServerConfig)
      }
      navigate('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirm(`Delete server "${form.name}"? This cannot be undone.`)) return
    await window.api.server.delete(id!)
    navigate('/dashboard')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-foreground">
            {isNew ? 'New Server' : `Edit: ${form.name}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Basic Info
            </h2>
            <div className="space-y-2">
              <Label htmlFor="name">Display Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="My Gaming Server"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hostname">Hostname *</Label>
              <Input
                id="hostname"
                value={form.hostname}
                onChange={(e) => set('hostname', e.target.value)}
                placeholder="My sbox Server"
              />
              <p className="text-xs text-muted-foreground">
                Server name visible to players in the server browser.
              </p>
            </div>
          </section>

          <Separator />

          {/* Installation */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Installation
            </h2>
            <div className="space-y-2">
              <Label htmlFor="installPath">Server Directory *</Label>
              <div className="flex gap-2">
                <Input
                  id="installPath"
                  value={form.installPath}
                  onChange={(e) => set('installPath', e.target.value)}
                  placeholder="C:\sbox-server"
                  className="flex-1 font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={browseInstallPath}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Directory containing <code>sbox-server.exe</code>
              </p>
            </div>
          </section>

          <Separator />

          {/* Game Config */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Game Configuration
            </h2>
            <div className="space-y-2">
              <Label htmlFor="game">Game Package *</Label>
              <div className="flex gap-2">
                <Input
                  id="game"
                  value={form.game}
                  onChange={(e) => set('game', e.target.value)}
                  placeholder="facepunch.walker or C:\my-game\.sbproj"
                  className="flex-1 font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={browseSbproj} title="Browse .sbproj">
                  <FileCode className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Steam package identifier (e.g. <code>facepunch.walker</code>) or absolute path to a
                local <code>.sbproj</code> file.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="map">Map Package (optional)</Label>
              <Input
                id="map"
                value={form.map ?? ''}
                onChange={(e) => set('map', e.target.value)}
                placeholder="garry.scenemap"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Optional map package to load on startup.
              </p>
            </div>
          </section>

          <Separator />

          {/* Advanced */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Advanced
            </h2>
            <div className="space-y-2">
              <Label htmlFor="token">Game Server Token (optional)</Label>
              <Input
                id="token"
                type="password"
                value={form.token ?? ''}
                onChange={(e) => set('token', e.target.value)}
                placeholder="••••••••••••••••"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Generates a stable Steam ID for your server. Get one at{' '}
                <span className="text-primary">steamcommunity.com/dev/managegameservers</span> (App
                ID: 1892930).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extraArgs">Extra Arguments (optional)</Label>
              <Textarea
                id="extraArgs"
                value={form.extraArgs ?? ''}
                onChange={(e) => set('extraArgs', e.target.value)}
                placeholder="+sv_port 27015 +maxplayers 16"
                className="font-mono text-xs"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Additional command-line arguments passed to <code>sbox-server.exe</code>.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
