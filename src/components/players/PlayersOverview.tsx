import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import type { DuesFilter } from '@/lib/playerRoster'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  style: 'currency',
})

function RosterMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-xl font-bold tracking-tight text-app-text sm:text-2xl">
        {value}
      </dd>
    </div>
  )
}

interface PlayersOverviewProps {
  alumniCount: number
  collectedAmount: number
  currentPlayerCount: number
  duesFilter: DuesFilter
  expectedAmount: number
  isViewOnly: boolean
  onAddPlayer: () => void
  onImportSeason?: () => void
  onDuesFilterChange: (filter: DuesFilter) => void
  onSearchChange: (search: string) => void
  paidPlayers: number
  partialPlayers: number
  pendingPlayers: number
  representedSeasons: number
  returningPlayers: number
  search: string
  selectedSeason: string
}

export function PlayersOverview({
  alumniCount,
  collectedAmount,
  currentPlayerCount,
  duesFilter,
  expectedAmount,
  isViewOnly,
  onAddPlayer,
  onImportSeason,
  onDuesFilterChange,
  onSearchChange,
  paidPlayers,
  partialPlayers,
  pendingPlayers,
  representedSeasons,
  returningPlayers,
  search,
  selectedSeason,
}: PlayersOverviewProps) {
  return (
    <>
      <section>
        <PageHeader eyebrow={`${selectedSeason} season / The roster`} title={isViewOnly ? 'League roster' : 'Players & dues'} description={isViewOnly ? 'The players, their teams, and current dues status. Payment notes stay private.' : 'Your people, their teams, and every entry fee accounted for.'} action={!isViewOnly ? <div className="flex flex-wrap gap-2">{onImportSeason && <Button onClick={onImportSeason}><span aria-hidden="true">↻</span> Import from ESPN</Button>}<Button onClick={onAddPlayer} variant={onImportSeason ? 'secondary' : 'primary'}><span aria-hidden="true">＋</span> Add player</Button></div> : undefined} />

        <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-app-border bg-app-surface lg:grid-cols-4 [&>div+div]:border-l [&>div+div]:border-app-border">
          <RosterMetric label="Current players" value={String(currentPlayerCount)} />
          {isViewOnly ? (
            <>
              <RosterMetric label="Returning" value={String(returningPlayers)} />
              <RosterMetric label="League alumni" value={String(alumniCount)} />
              <RosterMetric label="Seasons" value={String(representedSeasons)} />
            </>
          ) : (
            <>
              <RosterMetric label="Paid in full" value={String(paidPlayers)} />
              <RosterMetric
                label="Needs attention"
                value={
                  partialPlayers > 0
                    ? `${pendingPlayers} unpaid · ${partialPlayers} partial`
                    : `${pendingPlayers} unpaid`
                }
              />
              <RosterMetric
                label="Collected"
                value={`${currency.format(collectedAmount)} / ${currency.format(expectedAmount)}`}
              />
            </>
          )}
        </dl>
      </section>

      <Card className="mt-6 border-0 bg-transparent shadow-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="player-search">
              Search players
            </label>
            <div className="relative">
              <svg aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                className="min-h-11 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface pl-10 pr-3 text-base text-app-text outline-none transition focus:border-app-brand focus:ring-2 focus:ring-app-brand-soft sm:text-sm"
                id="player-search"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search manager, team, or season"
                type="search"
                value={search}
              />
            </div>
          </div>

          {!isViewOnly && (
            <div
              aria-label="Filter roster by dues status"
              className="grid grid-cols-4 gap-0.5 rounded-[var(--app-radius-sm)] bg-app-surface-subtle p-1"
              role="group"
            >
              {(['all', 'pending', 'partial', 'paid'] as DuesFilter[]).map(
                (filter) => (
                  <button
                    aria-pressed={duesFilter === filter}
                    className={cn(
                      'min-h-10 rounded-lg px-2 text-[0.8125rem] font-semibold capitalize transition-colors',
                      duesFilter === filter
                        ? 'bg-app-surface text-app-text shadow-sm'
                        : 'text-app-text-muted hover:text-app-text',
                    )}
                    key={filter}
                    onClick={() => onDuesFilterChange(filter)}
                    type="button"
                  >
                    {filter === 'pending' ? 'Unpaid' : filter}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </Card>
    </>
  )
}
