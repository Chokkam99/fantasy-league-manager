import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { WeeklyPrizeResult } from '@/lib/prizes'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: 'currency',
})

interface WeeklyPrizeWinnersProps {
  completedResults: number
  results: WeeklyPrizeResult[]
  totalWeeks: number
}

export function WeeklyPrizeWinners({
  completedResults,
  results,
  totalWeeks,
}: WeeklyPrizeWinnersProps) {
  return (
    <Card className="mt-6 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            Weekly awards
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">Weekly winners</h2>
          <p className="mt-1 text-sm leading-6 text-app-text-muted">
            Winners are calculated from complete recorded weeks. Tied high scores split that week&apos;s prize evenly.
          </p>
        </div>
        <Badge variant={completedResults > 0 ? 'success' : 'neutral'}>
          {completedResults}/{totalWeeks} results
        </Badge>
      </div>

      {results.length > 0 ? (
        <ol className="divide-y divide-app-border">
          {results.map((result) => (
            <li
              className="grid min-w-0 gap-3 p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:px-6"
              key={result.week}
            >
              <div className="flex items-center justify-between gap-3 sm:block">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
                  Week
                </p>
                <p className="text-xl font-bold text-app-text sm:mt-1">{result.week}</p>
              </div>

              {result.complete ? (
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 font-bold text-app-text">
                      {result.winners.map((winner) => winner.team_name).join(' & ')}
                    </p>
                    {result.winners.length > 1 && <Badge variant="info">Tie</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-app-text-muted">
                    {result.winners.map((winner) => winner.manager_name).join(' & ')} · {result.score?.toFixed(2)} points
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-app-text">Result pending</p>
                    <Badge variant="warning">Incomplete</Badge>
                  </div>
                  <p className="mt-1 text-sm text-app-text-muted">
                    {result.recordedTeams}/{result.expectedTeams} team scores recorded
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-sm)] bg-app-surface-subtle px-3 py-2.5 sm:block sm:min-w-28 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
                  {!result.complete
                    ? 'Planned prize'
                    : result.winners.length > 1
                      ? 'Each winner'
                      : 'Prize'}
                </p>
                <p className="font-bold text-app-text sm:mt-1">
                  {currency.format(
                    result.complete ? result.sharePerWinner : result.prizeAmount,
                  )}
                </p>
                {result.winners.length > 1 && (
                  <p className="text-xs text-app-text-muted">
                    {currency.format(result.prizeAmount)} split
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="p-8 text-center sm:p-10">
          <p className="font-semibold text-app-text">No weekly results yet</p>
          <p className="mt-1 text-sm text-app-text-muted">
            Weekly winners will appear after a complete week of scores is recorded.
          </p>
        </div>
      )}
    </Card>
  )
}
