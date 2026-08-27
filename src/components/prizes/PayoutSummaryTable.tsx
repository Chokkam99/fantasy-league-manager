import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { PlayerWinningsSummary } from '@/lib/prizeViewModel'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: 'currency',
})

export function PayoutSummaryTable({
  summaries,
}: {
  summaries: PlayerWinningsSummary[]
}) {
  const assignedTotal = summaries.reduce(
    (total, summary) => total + summary.totalAmount,
    0,
  )

  return (
    <Card className="mt-6 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border p-4 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            Quick handout
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">Payout tally</h2>
          <p className="mt-1 text-sm leading-5 text-app-text-muted">
            Each player&apos;s weekly prizes and assigned season awards in one place.
          </p>
        </div>
        <Badge variant={assignedTotal > 0 ? 'success' : 'neutral'}>
          {currency.format(assignedTotal)} assigned
        </Badge>
      </div>

      {summaries.length > 0 ? (
        <table className="w-full table-fixed">
          <thead className="bg-app-surface-subtle text-left text-[0.68rem] font-semibold uppercase tracking-wide text-app-text-muted">
            <tr>
              <th className="px-4 py-2.5 sm:px-6">Player</th>
              <th className="hidden w-28 px-3 py-2.5 text-right sm:table-cell">Weekly</th>
              <th className="hidden w-28 px-3 py-2.5 text-right md:table-cell">Season</th>
              <th className="w-24 px-4 py-2.5 text-right sm:px-6">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {summaries.map((summary) => {
              const details = [
                summary.finalAwards.join(', '),
                summary.weeklyWins.length > 0
                  ? `Week${summary.weeklyWins.length === 1 ? '' : 's'} ${summary.weeklyWins.join(', ')}`
                  : '',
              ].filter(Boolean)

              return (
                <tr key={summary.member.id}>
                  <td className="min-w-0 px-4 py-3 sm:px-6">
                    <p className="truncate text-sm font-semibold text-app-text">
                      {summary.member.team_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-app-text-muted">
                      {summary.member.manager_name}
                      {details.length > 0 ? ` · ${details.join(' · ')}` : ' · No winnings'}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-app-text sm:table-cell">
                    {currency.format(summary.weeklyAmount)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-app-text md:table-cell">
                    {currency.format(summary.finalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-app-text sm:px-6">
                    {currency.format(summary.totalAmount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className="p-8 text-center">
          <p className="font-semibold text-app-text">No players to summarize</p>
          <p className="mt-1 text-sm text-app-text-muted">
            The payout tally will appear after players are added to this season.
          </p>
        </div>
      )}
    </Card>
  )
}
