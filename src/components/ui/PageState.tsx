import type { ReactNode } from 'react'
import { Card } from './Card'
import { Skeleton, SkeletonGroup } from './Skeleton'

export function PageState({
  action,
  description,
  eyebrow,
  title,
  tone = 'neutral',
}: {
  action?: ReactNode
  description: string
  eyebrow?: string
  title: string
  tone?: 'danger' | 'neutral'
}) {
  return (
    <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center px-4 py-10 sm:px-6">
      <ContentState
        action={action}
        className="w-full p-6 sm:p-10"
        description={description}
        eyebrow={eyebrow}
        headingLevel="h1"
        title={title}
        tone={tone}
      />
    </main>
  )
}

export function ContentState({
  action,
  className,
  description,
  eyebrow,
  headingLevel = 'h2',
  title,
  tone = 'neutral',
}: {
  action?: ReactNode
  className?: string
  description: string
  eyebrow?: string
  headingLevel?: 'h1' | 'h2'
  title: string
  tone?: 'danger' | 'neutral'
}) {
  const Heading = headingLevel
  return (
    <Card
      className={`p-8 text-center sm:p-12 ${className || ''}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span
        aria-hidden="true"
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${
          tone === 'danger'
            ? 'bg-app-danger-soft text-app-danger'
            : 'bg-app-brand-soft text-app-brand-strong'
        }`}
      >
        {tone === 'danger' ? '!' : '-'}
      </span>
      {eyebrow && (
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-app-text-muted">
          {eyebrow}
        </p>
      )}
      <Heading className="mt-2 text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
        {title}
      </Heading>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-app-text-muted sm:text-base">
        {description}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  )
}

export function PageSkeleton({
  cardClassName = 'h-40',
  cardCount = 6,
  gridClassName = 'sm:grid-cols-2 lg:grid-cols-3',
  heroClassName,
  label,
}: {
  cardClassName?: string
  cardCount?: number
  gridClassName?: string
  heroClassName?: string
  label: string
}) {
  return (
    <SkeletonGroup label={label} className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {heroClassName ? (
        <Skeleton className={heroClassName} />
      ) : (
        <>
          <Skeleton className="h-8 w-48 bg-app-border" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl bg-app-border" />
        </>
      )}
      <div className={`mt-6 grid gap-4 ${gridClassName}`}>
        {Array.from({ length: cardCount }, (_, item) => (
          <Skeleton className={`${cardClassName} bg-app-surface`} key={item} />
        ))}
      </div>
    </SkeletonGroup>
  )
}
