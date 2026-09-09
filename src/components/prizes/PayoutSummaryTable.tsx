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
  busyMemberId,
  canManagePayouts,
  onPayoutStatusChange,
  summaries,
  trackingReady,
}: {
  busyMemberId: string | null
  canManagePayouts: boolean
  onPayoutStatusChange: (
    memberId: string,
    status: 'paid' | 'pending',
  ) => void
  summaries: PlayerWinningsSummary[]
  trackingReady: boolean
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
            Full season totals, including weekly wins. Check each player off when the handout is complete.
          </p>
        </div>
        <Badge variant={assignedTotal > 0 ? 'success' : 'neutral'}>
          {currency.format(assignedTotal)} assigned
        </Badge>
      </div>

      {summaries.length > 0 ? (
        <table aria-label="Payout tally" className="w-full table-fixed">
          <thead className="bg-app-surface-subtle text-[0.75rem] font-semibold uppercase tracking-wide text-app-text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left sm:px-6" scope="col">Player</th>
              <th className="hidden px-3 py-2.5 text-right sm:table-cell sm:w-28" scope="col">Weekly</th>
              <th className="hidden px-3 py-2.5 text-right md:table-cell md:w-28" scope="col">Season</th>
              <th className="w-20 px-2 py-2.5 text-right sm:w-24" scope="col">Total</th>
              <th className="w-[4.75rem] py-2.5 pl-2 pr-4 text-center sm:w-24 sm:pl-3 sm:pr-6" scope="col">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {summaries.map((summary) => {
              const isPaid = summary.payoutStatus === 'paid'
              const isBusy = busyMemberId === summary.member.id
              const details = [
                summary.finalAwards.join(', '),
                summary.weeklyWins.length > 0
                  ? `Week${summary.weeklyWins.length === 1 ? '' : 's'} ${summary.weeklyWins.join(', ')}`
                  : '',
              ].filter(Boolean)

              return (
                <tr key={summary.member.id}>
                  <th className="min-w-0 px-4 py-3 text-left font-normal sm:px-6" scope="row">
                    <p className="truncate text-sm font-semibold text-app-text">
                      {summary.member.team_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-app-text-muted">
                      {summary.member.manager_name}
                      {details.length > 0 ? ` · ${details.join(' · ')}` : ' · No winnings'}
                    </p>
                  </th>
                  <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-app-text sm:table-cell">
                    {currency.format(summary.weeklyAmount)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-sm tabular-nums text-app-text md:table-cell">
                    {currency.format(summary.finalAmount)}
                  </td>
                  <td className="px-2 py-3 text-right text-sm font-bold tabular-nums text-app-text">
                    {currency.format(summary.totalAmount)}
                  </td>
                  <td className="py-3 pl-2 pr-4 text-center sm:pl-3 sm:pr-6">
                    {canManagePayouts ? (
                      <input
                        aria-label={`Paid: ${summary.member.team_name} total payout`}
                        checked={isPaid}
                        className="h-5 w-5 accent-app-brand"
                        disabled={
                          !trackingReady || isBusy || summary.totalAmount <= 0
                        }
                        onChange={() =>
                          onPayoutStatusChange(
                            summary.member.id,
                            isPaid ? 'pending' : 'paid',
                          )
                        }
                        title={
                          !trackingReady
                            ? 'Player payout tracking needs the latest database update'
                            : summary.totalAmount <= 0
                              ? 'No payout is due'
                              : `Mark ${summary.member.manager_name} ${isPaid ? 'pending' : 'paid'}`
                        }
                        type="checkbox"
                      />
                    ) : summary.totalAmount <= 0 ? (
                      <span className="text-xs text-app-text-muted">None</span>
                    ) : (
                      <Badge
                        className="min-h-5 px-1.5 py-0 text-[0.75rem] sm:min-h-6 sm:px-2.5 sm:py-0.5 sm:text-xs"
                        variant={isPaid ? 'success' : 'warning'}
                      >
                        {isPaid ? 'Paid' : 'Pending'}
                      </Badge>
                    )}
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
      {!trackingReady && canManagePayouts && (
        <p className="border-t border-app-border px-4 py-3 text-xs leading-5 text-app-text-muted sm:px-6">
          Player payout checkboxes will be enabled after the prepared payout-tracking migration is applied.
        </p>
      )}
    </Card>
  )
}
