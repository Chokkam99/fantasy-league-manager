'use client'

import { useState } from 'react'
import { Toast } from '@/components/ui/Toast'

interface ShareButtonProps {
  leagueId: string
  className?: string
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Fall through for browsers that expose the API but deny permission.
    }
  }

  const field = document.createElement('textarea')
  field.value = value
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  const copied = document.execCommand?.('copy') === true
  field.remove()
  if (!copied) {
    throw new Error('The link was created, but this browser blocked copying. Try again from a secure browser window.')
  }
}

export default function ShareButton({ leagueId, className = '' }: ShareButtonProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'danger' | 'success'>('success')

  const copyLeagueLink = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const sharePath = `/league/${encodeURIComponent(leagueId)}`
      await copyText(new URL(sharePath, window.location.origin).toString())
      setTone('success')
      setMessage('League link copied.')
    } catch (caught) {
      setTone('danger')
      setMessage(caught instanceof Error ? caught.message : 'The league link could not be copied.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button aria-label="Share league" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface text-app-text transition-colors hover:bg-app-surface-subtle disabled:cursor-wait disabled:opacity-60 ${className}`} disabled={loading} onClick={copyLeagueLink} title="Share league" type="button">
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M8.7 13.3a3 3 0 1 0 0-2.6m0 2.6 6.6 3.4m-6.6-6 6.6-3.4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <circle cx="18" cy="6" r="3" strokeWidth="2" />
          <circle cx="18" cy="18" r="3" strokeWidth="2" />
        </svg>
        <span className="sr-only">{loading ? 'Copying league link' : 'Share league'}</span>
      </button>
      <Toast message={message} onDismiss={() => setMessage(null)} tone={tone} />
    </>
  )
}
