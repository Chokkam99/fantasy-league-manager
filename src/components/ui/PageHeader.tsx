import type { ReactNode } from 'react'

export function PageHeader({ action, description, eyebrow, title }: {
  action?: ReactNode
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <div className="page-heading flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="section-kicker">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-app-text sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">{description}</p>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
