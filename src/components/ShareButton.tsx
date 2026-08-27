'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Notice } from '@/components/ui/Notice'
import type { ShareLinkStatus } from '@/lib/shareAccess'

interface ShareButtonProps {
  leagueId: string
  season: string
  label?: string
  className?: string
  labelClassName?: string
  onClose?: () => void
  onOpen?: () => void
}

interface ShareMutationPayload extends ShareLinkStatus {
  error?: string
  share_path?: string
  success: boolean
}

function storageKey(leagueId: string, season: string) {
  return `fantasy-share-link:${leagueId}:${season}`
}

export default function ShareButton({ leagueId, season, label = 'Share', className = '', labelClassName = '', onClose, onOpen }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ShareLinkStatus | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const query = new URLSearchParams({ season })
      const response = await fetch(`/api/leagues/${encodeURIComponent(leagueId)}/sharing?${query}`)
      const payload = (await response.json()) as ShareMutationPayload
      if (!response.ok) throw new Error(payload.error || 'Player-link status could not be loaded.')
      setStatus(payload)
      const locallySaved = localStorage.getItem(storageKey(leagueId, season))
      const savedToken = locallySaved
        ? new URL(locallySaved, window.location.origin).searchParams.get('share')
        : null
      setSavedPath(
        payload.active && savedToken?.slice(0, 8) === payload.token_prefix
          ? locallySaved
          : null,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Player-link status could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  const openDialog = () => {
    onOpen?.()
    setOpen(true)
    void loadStatus()
  }

  const closeDialog = () => {
    setOpen(false)
    onClose?.()
  }

  const createOrReplace = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/leagues/${encodeURIComponent(leagueId)}/sharing`, {
        body: JSON.stringify({ season }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json()) as ShareMutationPayload
      if (!response.ok || !payload.share_path) {
        throw new Error(payload.error || 'The player link could not be created.')
      }
      localStorage.setItem(storageKey(leagueId, season), payload.share_path)
      setSavedPath(payload.share_path)
      setStatus({
        active: true,
        created_at: new Date().toISOString(),
        season,
        token_prefix: new URL(payload.share_path, window.location.origin).searchParams.get('share')?.slice(0, 8) || null,
      })
      await navigator.clipboard.writeText(new URL(payload.share_path, window.location.origin).toString())
      setNotice('New player link copied. Any previous link for this season is now invalid.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The player link could not be created.')
    } finally {
      setLoading(false)
    }
  }

  const copySaved = async () => {
    if (!savedPath) return
    await navigator.clipboard.writeText(new URL(savedPath, window.location.origin).toString())
    setNotice('Player link copied.')
  }

  const revoke = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const query = new URLSearchParams({ season })
      const response = await fetch(`/api/leagues/${encodeURIComponent(leagueId)}/sharing?${query}`, { method: 'DELETE' })
      const payload = (await response.json()) as ShareMutationPayload
      if (!response.ok) throw new Error(payload.error || 'The player link could not be revoked.')
      localStorage.removeItem(storageKey(leagueId, season))
      setSavedPath(null)
      setStatus({ active: false, created_at: null, season, token_prefix: null })
      setNotice('Player access for this season has been revoked.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The player link could not be revoked.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button aria-label={label} className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-sm font-semibold text-app-text transition-colors hover:bg-app-surface-subtle ${className}`} onClick={openDialog} type="button">
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M8.7 13.3a3 3 0 1 0 0-2.6m0 2.6 6.6 3.4m-6.6-6 6.6-3.4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <circle cx="18" cy="6" r="3" strokeWidth="2" />
          <circle cx="18" cy="18" r="3" strokeWidth="2" />
        </svg>
        <span className={labelClassName}>{label}</span>
      </button>

      <Dialog
        busy={loading}
        closeLabel="Close player access"
        description="Anyone with this season-specific link can view its roster, standings, scores, rules, and prize allocation. They cannot edit league data or open commissioner settings."
        eyebrow={`${season} season`}
        mobileSheet
        onClose={closeDialog}
        open={open}
        title="Player access"
      >
            {loading && !status && <p className="mt-5 text-sm text-app-text-muted" role="status">Checking player access…</p>}
            {error && <Notice className="mt-4" tone="danger">{error}</Notice>}
            {notice && <Notice className="mt-4" tone="success">{notice}</Notice>}

            {status && (
              <div className="mt-5 space-y-4">
                <div className="rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle p-4">
                  <p className="font-semibold text-app-text">{status.active ? 'Player link active' : 'No active player link'}</p>
                  <p className="mt-1 text-sm leading-5 text-app-text-muted">
                    {status.active
                      ? savedPath
                        ? 'This browser still has the link available to copy.'
                        : 'The raw link is not stored on the server. Replace it to create a copyable link.'
                      : 'Create a link when you are ready to share this season.'}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {savedPath && <Button disabled={loading} onClick={copySaved}>Copy link</Button>}
                  <Button disabled={loading} onClick={createOrReplace} variant={status.active ? 'secondary' : 'primary'}>
                    {status.active ? 'Replace link' : 'Create & copy link'}
                  </Button>
                  {status.active && <Button className="sm:col-span-2" disabled={loading} onClick={revoke} variant="danger">Revoke player access</Button>}
                </div>
                {status.active && <p className="text-xs leading-5 text-app-text-muted">Replacing or revoking immediately invalidates the previous link for {season}.</p>}
              </div>
            )}
      </Dialog>
    </>
  )
}
