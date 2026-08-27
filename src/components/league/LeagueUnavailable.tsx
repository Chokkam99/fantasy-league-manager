'use client'

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
        description="The league service did not respond. Your league data has not been changed. Check your connection and try again."
        eyebrow="Connection problem"
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
