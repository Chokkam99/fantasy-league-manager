import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--app-radius-md)] border border-app-border bg-app-surface shadow-[var(--app-shadow-sm)]',
        className,
      )}
      {...props}
    />
  )
}
