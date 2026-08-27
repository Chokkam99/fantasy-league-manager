import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded bg-app-surface-subtle', className)}
      {...props}
    />
  )
}

export function SkeletonGroup({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  return (
    <div aria-busy="true" aria-label={label} className={className} role="status">
      {children}
    </div>
  )
}
