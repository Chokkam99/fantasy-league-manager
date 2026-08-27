'use client'

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const focusableSelector = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface DialogProps {
  busy?: boolean
  children: ReactNode
  className?: string
  closeLabel?: string
  description?: ReactNode
  eyebrow?: ReactNode
  footer?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  mobileSheet?: boolean
  onClose: () => void
  open: boolean
  title: ReactNode
}

export function Dialog({
  busy = false,
  children,
  className,
  closeLabel = 'Close dialog',
  description,
  eyebrow,
  footer,
  initialFocusRef,
  mobileSheet = false,
  onClose,
  open,
  title,
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(busy)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    busyRef.current = busy
    onCloseRef.current = onClose
  }, [busy, onClose])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(initialFocusRef?.current || closeRef.current)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)]
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [initialFocusRef, open])

  if (!open || typeof document === 'undefined') return null

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !busy) onClose()
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[70] flex justify-center bg-black/50',
        mobileSheet
          ? 'items-end p-0 sm:items-center sm:p-4'
          : 'items-center overflow-y-auto p-4',
      )}
      onMouseDown={closeFromBackdrop}
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          'my-auto max-h-[90vh] w-full overflow-y-auto border border-app-border bg-app-surface p-5 shadow-[var(--app-shadow-md)] sm:p-6',
          mobileSheet
            ? 'max-w-lg rounded-t-[var(--app-radius-lg)] sm:rounded-[var(--app-radius-lg)]'
            : 'max-w-md rounded-[var(--app-radius-lg)]',
          className,
        )}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-brand">
                {eyebrow}
              </p>
            )}
            <h2 className={cn('text-xl font-bold text-app-text', Boolean(eyebrow) && 'mt-1')} id={titleId}>
              {title}
            </h2>
            {description && (
              <div className="mt-2 text-sm leading-6 text-app-text-muted" id={descriptionId}>
                {description}
              </div>
            )}
          </div>
          <Button
            aria-label={closeLabel}
            disabled={busy}
            onClick={onClose}
            ref={closeRef}
            size="icon"
            variant="ghost"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </Button>
        </div>
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-6">{footer}</div>}
      </section>
    </div>,
    document.body,
  )
}
