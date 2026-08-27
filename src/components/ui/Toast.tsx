'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Notice } from '@/components/ui/Notice'

export function Toast({
  duration = 5000,
  message,
  onDismiss,
  tone = 'success',
}: {
  duration?: number
  message: string | null
  onDismiss: () => void
  tone?: 'danger' | 'info' | 'success' | 'warning'
}) {
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!message || duration <= 0) return
    const timer = window.setTimeout(() => onDismissRef.current(), duration)
    return () => window.clearTimeout(timer)
  }, [duration, message])

  if (!message || typeof document === 'undefined') return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-[80] flex justify-center md:left-auto md:right-6 md:top-6">
      <Notice className="pointer-events-auto flex w-full max-w-sm items-center gap-2 py-2.5 pr-2 shadow-[var(--app-shadow-md)]" tone={tone}>
        <span className="min-w-0 flex-1 leading-5">{message}</span>
        <button
          aria-label="Dismiss notification"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-current/70 transition-colors hover:bg-black/5 hover:text-current"
          onClick={onDismiss}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </Notice>
    </div>,
    document.body,
  )
}
