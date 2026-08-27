import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { OverviewViewModel } from '@/lib/overview'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

interface OverviewHeaderProps {
  overview: OverviewViewModel
  scoresHref: string
  selectedSeason: string
  totalWeeks: number
}

export function OverviewHeader({
  overview,
  scoresHref,
  selectedSeason,
  totalWeeks,
}: OverviewHeaderProps) {
  const duesAttention = overview.pendingMembers + overview.partialMembers

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
            Season overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted sm:text-base">
            Scores, standings, dues, and the prize picture for the {selectedSeason} season.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-app-brand hover:text-app-brand-strong"
          href={scoresHref}
        >
          View weekly scores <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </div>

      <section
        aria-label="League summary"
        className="mt-6 grid grid-cols-1 gap-3 min-[340px]:grid-cols-2 lg:grid-cols-4"
      >
        <MetricCard
          detail={`${overview.paidMembers} of ${overview.totalMembers} paid${overview.partialMembers ? ` · ${overview.partialMembers} partial` : ''}`}
          label="Dues collected"
          tone={duesAttention === 0 ? 'positive' : 'warning'}
          value={currency.format(overview.collected)}
        />
        <MetricCard
          detail={
            duesAttention > 0
              ? `${duesAttention} ${duesAttention === 1 ? 'player needs' : 'players need'} attention`
              : 'Everyone is paid'
          }
          label="Outstanding"
          tone={overview.outstanding > 0 ? 'warning' : 'positive'}
          value={currency.format(overview.outstanding)}
        />
        <MetricCard
          detail={`${overview.latestWeek} of ${totalWeeks || '—'} weeks imported`}
          label="Season progress"
          value={overview.latestWeek ? `Week ${overview.latestWeek}` : 'Not started'}
        />
        <MetricCard
          detail={
            overview.latestWeeklyScore === null
              ? 'No completed scores yet'
              : `${overview.latestWeeklyScore.toFixed(2)} points`
          }
          label="Latest weekly leader"
          tone={overview.latestWeeklyScore === null ? 'default' : 'positive'}
          value={
            overview.latestWeeklyWinners.length > 1
              ? `${overview.latestWeeklyWinners.length}-way tie`
              : overview.latestWeeklyWinners[0] || 'Waiting'
          }
          valueClassName="text-xl sm:text-2xl"
        />
      </section>
    </>
  )
}

function MetricCard({
  detail,
  label,
  tone = 'default',
  value,
  valueClassName,
}: {
  detail: string
  label: string
  tone?: 'default' | 'positive' | 'warning'
  value: string
  valueClassName?: string
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 break-words text-xl font-bold tracking-tight text-app-text sm:text-2xl',
          tone === 'positive' && 'text-app-success',
          tone === 'warning' && 'text-app-warning',
          valueClassName,
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-app-text-muted">{detail}</p>
    </Card>
  )
}
