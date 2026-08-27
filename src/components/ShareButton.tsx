'use client'

import { useState } from 'react'
import { Toast } from '@/components/ui/Toast'

interface ShareButtonProps {
  leagueId: string
  season: string
  label?: string
  className?: string
  labelClassName?: string
}

interface ShareMutationPayload {
  error?: string
  share_path?: string
  success: boolean
}

export default function ShareButton({ leagueId, season, label = 'Copy player link', className = '', labelClassName = '' }: ShareButtonProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'danger' | 'success'>('success')

  const copyPlayerLink = async () => {
    setLoading(true)
    setMessage(null)
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
      await navigator.clipboard.writeText(new URL(payload.share_path, window.location.origin).toString())
      setTone('success')
      setMessage(`${season} player link copied.`)
    } catch (caught) {
      setTone('danger')
      setMessage(caught instanceof Error ? caught.message : 'The player link could not be copied.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button aria-label={label} className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-sm font-semibold text-app-text transition-colors hover:bg-app-surface-subtle disabled:cursor-wait disabled:opacity-60 ${className}`} disabled={loading} onClick={copyPlayerLink} type="button">
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M8.7 13.3a3 3 0 1 0 0-2.6m0 2.6 6.6 3.4m-6.6-6 6.6-3.4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <circle cx="18" cy="6" r="3" strokeWidth="2" />
          <circle cx="18" cy="18" r="3" strokeWidth="2" />
        </svg>
        <span className={labelClassName}>{loading ? 'Copying…' : label}</span>
      </button>
      <Toast message={message} onDismiss={() => setMessage(null)} tone={tone} />
    </>
  )
}
