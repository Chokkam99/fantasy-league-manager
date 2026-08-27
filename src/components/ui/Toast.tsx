'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
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

  if (!message) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] flex justify-center md:bottom-6 md:left-auto md:right-6">
      <Notice className="pointer-events-auto flex w-full max-w-sm items-start justify-between gap-3 shadow-[var(--app-shadow-md)]" tone={tone}>
        <span>{message}</span>
        <Button aria-label="Dismiss notification" onClick={onDismiss} size="icon" variant="ghost">
          ×
        </Button>
      </Notice>
    </div>
  )
}
