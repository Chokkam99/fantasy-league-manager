'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface ConfirmDialogProps {
  busy?: boolean
  confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  description: string
  onClose: () => void
  onConfirm: () => void
  open: boolean
  title: string
  tone?: 'danger' | 'warning'
}

export function ConfirmDialog({
  busy = false,
  confirmLabel,
  confirmVariant = 'danger',
  description,
  onClose,
  onConfirm,
  open,
  title,
  tone = 'danger',
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Dialog
      busy={busy}
      className="max-w-md"
      closeLabel="Close confirmation"
      description={description}
      initialFocusRef={cancelRef}
      onClose={onClose}
      open={open}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={busy} onClick={onClose} ref={cancelRef} variant="secondary">
            Cancel
          </Button>
          <Button disabled={busy} onClick={onConfirm} variant={confirmVariant}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div
        aria-hidden="true"
        className={`h-1.5 rounded-full ${tone === 'danger' ? 'bg-app-danger' : 'bg-app-warning'}`}
      >
      </div>
    </Dialog>
  )
}
