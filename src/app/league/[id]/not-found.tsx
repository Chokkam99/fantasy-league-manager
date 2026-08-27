import Link from 'next/link'
import { PageState } from '@/components/ui/PageState'

export default function LeagueNotFound() {
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
      description="This league or season may have been removed, or the link may be incorrect."
      eyebrow="Not found"
      title="League page not found"
    />
  )
}
