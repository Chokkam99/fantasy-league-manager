import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const toneClasses = {
  danger: 'border-app-danger/25 bg-app-danger-soft text-app-danger',
  info: 'border-app-info/25 bg-app-info-soft text-app-text',
  success: 'border-app-success/25 bg-app-success-soft text-app-success',
  warning: 'border-app-warning/30 bg-app-warning-soft text-app-text',
}

export function Notice({
  children,
  className,
  role,
  tone = 'info',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  tone?: keyof typeof toneClasses
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--app-radius-sm)] border px-4 py-3 text-sm leading-6',
        toneClasses[tone],
        className,
      )}
      role={role || (tone === 'danger' ? 'alert' : 'status')}
      {...props}
    >
      {children}
    </div>
  )
}
