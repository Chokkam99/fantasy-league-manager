import Link from 'next/link'
import { FieldArtwork } from '@/components/ui/BrandMark'
import type { OverviewViewModel } from '@/lib/overview'

const currency = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })

interface OverviewHeaderProps {
  overview: OverviewViewModel
  scoresHref: string
  selectedSeason: string
  totalWeeks: number
}

export function OverviewHeader({ overview, scoresHref, selectedSeason, totalWeeks }: OverviewHeaderProps) {
  return (
    <section className="season-banner relative overflow-hidden rounded-[var(--app-radius-lg)] px-5 py-7 sm:px-8 sm:py-8">
      <FieldArtwork className="pointer-events-none absolute -right-20 -top-8 hidden h-80 w-[520px] rotate-[-18deg] text-app-lime/20 md:block" />
      <div className="relative max-w-lg">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-lime">
          <span className="h-1.5 w-1.5 rounded-full bg-app-lime" aria-hidden="true" />
          {selectedSeason} season <span className="mx-1 text-white/30">/</span> The league at a glance
        </p>
        <h1 className="editorial-title mt-4 text-2xl text-white sm:text-4xl">Season overview</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-white/65">The scores, the stakes, and the stories.<br className="hidden sm:block" /> Everything your season comes down to.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center gap-6 rounded-lg bg-app-lime px-4 text-sm font-semibold text-app-ink transition-colors hover:bg-white" href={scoresHref}>
          View weekly scores <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="absolute bottom-8 right-8 hidden text-right md:block">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-white/50">Season checkpoint</p>
        <p className="mt-1 font-mono text-3xl font-light text-app-lime">{String(overview.latestWeek).padStart(2, '0')}<span className="text-base text-white/40"> / {totalWeeks || '—'}</span></p>
        <p className="mt-1 text-xs text-white/60">weeks in the books</p>
      </div>
    </section>
  )
}

export function OverviewMetrics({ overview, isViewOnly }: { overview: OverviewViewModel; isViewOnly: boolean }) {
  const attention = overview.pendingMembers + overview.partialMembers
  const metrics = [
    { label: isViewOnly ? 'Season entry pool' : 'Dues collected', value: currency.format(isViewOnly ? overview.expected : overview.collected), detail: isViewOnly ? `${overview.totalMembers} teams in the running` : `${overview.paidMembers} of ${overview.totalMembers} paid`, accent: false },
    { label: isViewOnly ? 'Entry fee' : 'Still to collect', value: currency.format(isViewOnly ? overview.feeAmount : overview.outstanding), detail: isViewOnly ? 'Per player, per season' : attention ? `${attention} ${attention === 1 ? 'player needs' : 'players need'} attention` : 'Everyone is paid up', accent: !isViewOnly && overview.outstanding > 0 },
    { label: 'Latest weekly leader', value: overview.latestWeeklyWinners.length > 1 ? `${overview.latestWeeklyWinners.length}-way tie` : overview.latestWeeklyWinners[0] || 'Waiting for kickoff', detail: overview.latestWeeklyScore === null ? 'No completed scores yet' : `${overview.latestWeeklyScore.toFixed(2)} points · Week ${overview.latestWeek}`, accent: false },
  ]
  return (
    <section aria-label="League summary" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`min-w-0 rounded-xl border border-app-border bg-app-surface p-4 sm:p-5 ${index === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-text-muted">{metric.label}</p>
          <p className={`mt-3 break-words font-bold tracking-tight ${index === 2 ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'} ${metric.accent ? 'text-app-brand' : 'text-app-text'}`}>{metric.value}</p>
          <p className="mt-2 text-xs leading-5 text-app-text-muted">{metric.detail}</p>
        </div>
      ))}
    </section>
  )
}
