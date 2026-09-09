import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { PortfolioLeague } from '@/lib/portfolio'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})
const duesCurrency = new Intl.NumberFormat('en-US', {
  currency: 'USD', style: 'currency', minimumFractionDigits: 0, maximumFractionDigits: 2,
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
  const outstandingDues = league.outstandingDues || []
  const showOutstandingDues = !league.archived_at && league.latestWeek === 0 && outstandingDues.length > 0
  const remainingCents = outstandingDues.reduce((total, player) => total + player.remainingCents, 0)
  const duesAttention = `${league.pendingMembers} ${league.pendingMembers === 1 ? 'player has' : 'players have'} dues pending`
  const attentionReasons = league.attentionReasons.filter(reason => !showOutstandingDues || reason !== duesAttention)
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
      <div className="h-1.5 bg-app-ink" />
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-kicker">
              {league.current_season} season
            </p>
            <h2 className="mt-1 truncate text-lg font-bold text-app-text sm:text-xl">
              {league.name}
            </h2>
          </div>
          <Badge className="shrink-0" variant={statusVariant}>
            {statusLabel}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:mt-6">
          <div>
            <p className="text-xs font-semibold text-app-text-muted">Latest scores</p>
            <p className="mt-1 text-lg font-bold text-app-text">
              {league.latestWeek ? `Week ${league.latestWeek}` : 'Not started'}
            </p>
            <p className="mt-0.5 text-xs text-app-text-muted">
              {league.latestWeek} of {league.totalWeeks || 'unconfigured'} weeks
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
            className={`h-full rounded-full ${collectionProgress >= 100 ? 'bg-app-success' : 'bg-app-info'}`}
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

          {showOutstandingDues && (
            <details className="mt-3 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle">
              <summary className="min-h-11 cursor-pointer rounded-[var(--app-radius-sm)] px-3 py-3 text-sm font-semibold text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-brand">
                {outstandingDues.length} {outstandingDues.length === 1 ? 'player' : 'players'} · {duesCurrency.format(remainingCents / 100)} remaining
              </summary>
              <div className="border-t border-app-border px-3 pb-2">
                <p className="pt-3 text-xs font-semibold text-app-text-muted">Dues to collect</p>
                <ul className="mt-1 divide-y divide-app-border">
                  {outstandingDues.map(player => (
                    <li className="flex items-start justify-between gap-3 py-3 text-sm" key={player.memberId}>
                      <div className="min-w-0">
                        <p className="break-words font-medium text-app-text">{player.managerName}</p>
                        <p className="mt-0.5 text-xs text-app-text-muted">Unpaid</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-app-text">{duesCurrency.format(player.remainingCents / 100)}</span>
                    </li>
                  ))}
                </ul>
                <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-app-brand hover:text-app-brand-strong" href={`/league/${league.id}/players?season=${league.current_season}`}>
                  Manage dues <span aria-hidden="true" className="ml-2">→</span>
                </Link>
              </div>
            </details>
          )}

          {!league.archived_at && attentionReasons.length > 0 && (
            <p className="mt-3 rounded-[var(--app-radius-sm)] bg-app-warning-soft px-3 py-2 text-sm text-app-warning">
              {attentionReasons[0]}
              {attentionReasons.length > 1 &&
                ` + ${attentionReasons.length - 1} more`}
            </p>
          )}
        </div>
      </div>

      <Link
        aria-label={`Open ${league.name}`}
        className="flex min-h-12 items-center justify-between border-t border-app-border bg-app-ink px-5 text-sm font-semibold text-app-lime transition-colors group-hover:bg-app-brand-strong group-hover:text-white sm:px-6"
        href={`/league/${league.id}?season=${league.current_season}`}
      >
        Enter clubhouse
        <span aria-hidden="true">→</span>
      </Link>
    </Card>
  )
}
