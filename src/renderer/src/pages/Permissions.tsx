import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Badge } from '@renderer/components/ui/badge'

const DEFAULT_CLAIMS = ['kick', 'ban', 'restart']

interface UserPermission {
  SteamId: string
  Name: string
  Claims: string[]
}

export default function Permissions(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [serverPath, setServerPath] = useState('')
  const [serverName, setServerName] = useState('')
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // New user form
  const [newSteamId, setNewSteamId] = useState('')
  const [newName, setNewName] = useState('')
  const [newClaim, setNewClaim] = useState('')
  const [newClaims, setNewClaims] = useState<string[]>([...DEFAULT_CLAIMS])

  useEffect(() => {
    window.api.server.list().then(async (list) => {
      const found = list.find((s) => s.id === id)
      if (!found) {
        navigate('/dashboard')
        return
      }
      setServerPath(found.installPath)
      setServerName(found.name)
      const perms = await window.api.config.readPermissions(found.installPath)
      setPermissions(perms)
    })
  }, [id, navigate])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.api.config.writePermissions(serverPath, permissions)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const addUser = useCallback(() => {
    if (!newSteamId.trim() || !newName.trim()) return
    const user: UserPermission = {
      SteamId: newSteamId.trim(),
      Name: newName.trim(),
      Claims: [...newClaims]
    }
    setPermissions((prev) => [...prev, user])
    setNewSteamId('')
    setNewName('')
    setNewClaims([...DEFAULT_CLAIMS])
  }, [newSteamId, newName, newClaims])

  const removeUser = (steamId: string): void => {
    setPermissions((prev) => prev.filter((u) => u.SteamId !== steamId))
  }

  const toggleClaim = (steamId: string, claim: string): void => {
    setPermissions((prev) =>
      prev.map((u) => {
        if (u.SteamId !== steamId) return u
        const has = u.Claims.includes(claim)
        return { ...u, Claims: has ? u.Claims.filter((c) => c !== claim) : [...u.Claims, claim] }
      })
    )
  }

  const addClaimToUser = (steamId: string, claim: string): void => {
    if (!claim.trim()) return
    setPermissions((prev) =>
      prev.map((u) => {
        if (u.SteamId !== steamId) return u
        if (u.Claims.includes(claim.trim())) return u
        return { ...u, Claims: [...u.Claims, claim.trim()] }
      })
    )
  }

  const addNewClaim = (): void => {
    if (newClaim.trim() && !newClaims.includes(newClaim.trim())) {
      setNewClaims((prev) => [...prev, newClaim.trim()])
      setNewClaim('')
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground">{serverName} — User Permissions</h1>
            <p className="text-xs text-muted-foreground">
              Editing <code>users/config.json</code>
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Add new user */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Add User</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-steamid">Steam ID</Label>
                <Input
                  id="new-steamid"
                  value={newSteamId}
                  onChange={(e) => setNewSteamId(e.target.value)}
                  placeholder="76561198000000000"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-name">Display Name</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Player Name"
                />
              </div>
            </div>

            {/* Claims for new user */}
            <div className="space-y-2">
              <Label>Claims</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CLAIMS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setNewClaims((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                      )
                    }
                    className="focus:outline-none"
                  >
                    <Badge variant={newClaims.includes(c) ? 'default' : 'outline'}>{c}</Badge>
                  </button>
                ))}
                {newClaims
                  .filter((c) => !DEFAULT_CLAIMS.includes(c))
                  .map((c) => (
                    <Badge key={c} variant="secondary" className="cursor-pointer gap-1">
                      {c}
                      <X
                        className="h-3 w-3"
                        onClick={() => setNewClaims((prev) => prev.filter((x) => x !== c))}
                      />
                    </Badge>
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newClaim}
                  onChange={(e) => setNewClaim(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNewClaim()}
                  placeholder="custom-claim"
                  className="h-7 text-xs"
                />
                <Button size="sm" variant="outline" onClick={addNewClaim}>
                  Add Claim
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={addUser}
              disabled={!newSteamId.trim() || !newName.trim()}
            >
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </div>

          {/* User list */}
          {permissions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No users configured. Add a user above.
            </p>
          ) : (
            <div className="space-y-3">
              {permissions.map((user) => (
                <UserRow
                  key={user.SteamId}
                  user={user}
                  onRemove={() => removeUser(user.SteamId)}
                  onToggleClaim={(claim) => toggleClaim(user.SteamId, claim)}
                  onAddClaim={(claim) => addClaimToUser(user.SteamId, claim)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserRow({
  user,
  onRemove,
  onToggleClaim,
  onAddClaim
}: {
  user: UserPermission
  onRemove: () => void
  onToggleClaim: (claim: string) => void
  onAddClaim: (claim: string) => void
}): React.JSX.Element {
  const [customClaim, setCustomClaim] = useState('')

  const addCustom = (): void => {
    if (customClaim.trim()) {
      onAddClaim(customClaim.trim())
      setCustomClaim('')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-foreground">{user.Name}</p>
          <p className="text-xs text-muted-foreground font-mono">{user.SteamId}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Claims</p>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_CLAIMS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onToggleClaim(c)}
              className="focus:outline-none"
            >
              <Badge variant={user.Claims.includes(c) ? 'default' : 'outline'}>{c}</Badge>
            </button>
          ))}
          {user.Claims.filter((c) => !DEFAULT_CLAIMS.includes(c)).map((c) => (
            <Badge key={c} variant="secondary" className="cursor-pointer gap-1">
              {c}
              <X className="h-3 w-3" onClick={() => onToggleClaim(c)} />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={customClaim}
            onChange={(e) => setCustomClaim(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="custom-claim"
            className="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addCustom}>
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
