import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { PortfolioLeague } from '@/lib/portfolio'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

function formatSyncDate(value?: string | null) {
  if (!value) return 'No sync recorded'

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function LeagueCard({ league }: { league: PortfolioLeague }) {
  const collectionProgress = league.expectedAmount
    ? Math.min((league.collectedAmount / league.expectedAmount) * 100, 100)
    : 0
  const syncError = league.sync_status === 'error'
  const statusVariant = league.archived_at
    ? 'neutral'
    : syncError
      ? 'danger'
      : league.attentionReasons.length
        ? 'warning'
        : 'success'
  const statusLabel = league.archived_at
    ? 'Archived'
    : syncError
      ? 'Sync issue'
      : league.attentionReasons.length
        ? `${league.attentionReasons.length} to review`
        : 'All clear'

  return (
    <Card className="group flex min-w-0 flex-col overflow-hidden transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-app-brand/30 hover:shadow-[var(--app-shadow-md)]">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
              {league.current_season} season
            </p>
            <h2 className="mt-1 truncate text-xl font-bold text-app-text sm:text-2xl">
              {league.name}
            </h2>
          </div>
          <Badge className="shrink-0" variant={statusVariant}>
            {statusLabel}
          </Badge>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-app-text-muted">Latest scores</p>
            <p className="mt-1 text-lg font-bold text-app-text">
              {league.latestWeek ? `Week ${league.latestWeek}` : 'Not started'}
            </p>
            <p className="mt-0.5 text-xs text-app-text-muted">
              {league.latestWeek} of {league.totalWeeks || '—'} weeks
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted">Dues collected</p>
            <p className="mt-1 text-lg font-bold text-app-text">
              {currency.format(league.collectedAmount)}
            </p>
            <p className="mt-0.5 text-xs text-app-text-muted">
              {league.paidMembers} of {league.totalMembers} paid
            </p>
          </div>
        </div>

        <div
          aria-label={`${Math.round(collectionProgress)} percent of league dues collected`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(collectionProgress)}
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-app-surface-subtle"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-app-brand"
            style={{ width: `${collectionProgress}%` }}
          />
        </div>

        <div className="mt-5 border-t border-app-border pt-4">
          <div className="flex items-start justify-between gap-4 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-app-text">Score sync</p>
              <p className="mt-0.5 truncate text-app-text-muted">
                {formatSyncDate(league.last_sync_at)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold text-app-text">
                {currency.format(league.feeAmount)} fee
              </p>
              <p className="mt-0.5 text-app-text-muted">
                {currency.format(league.expectedAmount)} expected
              </p>
            </div>
          </div>

          {!league.archived_at && league.attentionReasons.length > 0 && (
            <p className="mt-3 rounded-[var(--app-radius-sm)] bg-app-warning-soft px-3 py-2 text-sm text-app-warning">
              {league.attentionReasons[0]}
              {league.attentionReasons.length > 1 &&
                ` + ${league.attentionReasons.length - 1} more`}
            </p>
          )}
        </div>
      </div>

      <Link
        aria-label={`Open ${league.name}`}
        className="flex min-h-12 items-center justify-between border-t border-app-border bg-app-surface-subtle px-5 text-sm font-semibold text-app-brand transition-colors group-hover:bg-app-brand-soft sm:px-6"
        href={`/league/${league.id}?season=${league.current_season}`}
      >
        Open league office
        <span aria-hidden="true">→</span>
      </Link>
    </Card>
  )
}
