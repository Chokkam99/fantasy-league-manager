'use client'

import { formatAppError } from '@/lib/appErrors'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { PageState } from '@/components/ui/PageState'

export function LeagueUnavailable({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  if (error) {
    return (
      <PageState
        action={<Button onClick={onRetry}>Try again</Button>}
        description={formatAppError(error, 'League data could not be loaded. Try again. If this continues, contact the app maintainer.')}
        eyebrow="Unable to load"
        title="League couldn’t be loaded"
        tone="danger"
      />
    )
  }

  return (
    <PageState
      action={(
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--app-radius-sm)] bg-app-brand px-4 text-sm font-semibold text-white"
          href="/"
        >
          View all leagues
        </Link>
      )}
      description="This league may have been removed, or the shared link may be incorrect."
      eyebrow="Not found"
      title="League not found"
    />
  )
}
