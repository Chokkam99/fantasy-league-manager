import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { FinanceAward } from '@/lib/financeClient'
import type { PrizeMember } from '@/lib/prizes'
import type { SeasonAwardView } from '@/lib/prizeViewModel'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: 'currency',
})

interface SeasonAwardCardsProps {
  awards: SeasonAwardView[]
  busyFinanceId: string | null
  canManagePayouts: boolean
  members: PrizeMember[]
  onPayoutStatusChange: (
    payoutId: string,
    status: 'paid' | 'pending',
  ) => void
  onRecipientChange: (award: FinanceAward, memberId: string | null) => void
  schemaReady: boolean
}

export function SeasonAwardCards({
  awards,
  busyFinanceId,
  canManagePayouts,
  members,
  onPayoutStatusChange,
  onRecipientChange,
  schemaReady,
}: SeasonAwardCardsProps) {
  return (
    <Card className="mt-6 min-w-0 overflow-hidden">
      <div className="border-b border-app-border p-4 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            Season awards
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">
            Final &amp; bonus prizes
          </h2>
          <p className="mt-1 text-sm text-app-text-muted">
            {canManagePayouts
              ? 'Assign each winner and check off the payout when it is sent.'
              : 'Final placements and any extra season awards.'}
          </p>
        </div>
      </div>

      {awards.length > 0 ? (
        <div>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)_6rem_3rem] gap-3 bg-app-surface-subtle px-6 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wide text-app-text-muted sm:grid">
            <span>Prize</span>
            <span>Recipient</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Paid</span>
          </div>
          {awards.map((awardView) => {
            const { award, payout, recipient } = awardView
            const isBusy =
              busyFinanceId === awardView.id || busyFinanceId === payout?.id
            const isPaid = payout?.status === 'paid'

            return (
              <article
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-app-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)_6rem_3rem] sm:px-6"
                key={awardView.id}
              >
                <div className="min-w-0 sm:col-start-1 sm:row-start-1">
                  <h3 className="truncate text-sm font-semibold text-app-text">
                    {awardView.label}
                  </h3>
                </div>

                <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
                  {canManagePayouts && award ? (
                    <>
                      <label className="sr-only" htmlFor={`recipient-${award.id}`}>
                        Recipient for {awardView.label}
                      </label>
                      <select
                        className="min-h-10 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-base text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand-soft sm:text-sm"
                        disabled={isBusy}
                        id={`recipient-${award.id}`}
                        onChange={(event) =>
                          onRecipientChange(award, event.target.value || null)
                        }
                        value={payout?.league_member_id || ''}
                      >
                        <option value="">Not assigned</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.team_name} — {member.manager_name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : recipient ? (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-app-text">
                        {recipient.team_name}
                      </p>
                      <p className="truncate text-xs text-app-text-muted">
                        {recipient.manager_name}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-app-text-muted">Not assigned</p>
                  )}
                </div>

                <p className="col-start-2 row-start-1 text-right text-sm font-bold tabular-nums text-app-text sm:col-start-3">
                  {currency.format(awardView.amount)}
                </p>

                <div className="col-start-2 row-start-2 flex justify-end sm:col-start-4 sm:row-start-1 sm:justify-center">
                  {canManagePayouts ? (
                    <input
                      aria-label={`Paid: ${awardView.label}`}
                      checked={isPaid}
                      className="h-5 w-5 accent-app-brand"
                      disabled={!payout || isBusy}
                      onChange={() => {
                        if (!payout) return
                        onPayoutStatusChange(
                          payout.id,
                          isPaid ? 'pending' : 'paid',
                        )
                      }}
                      title={
                        payout
                          ? `Mark ${awardView.label} ${isPaid ? 'pending' : 'paid'}`
                          : 'Assign a recipient first'
                      }
                      type="checkbox"
                    />
                  ) : (
                    <AwardStatusBadge status={awardView.status} />
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="font-semibold text-app-text">No final prizes configured</p>
          {schemaReady && (
            <p className="mt-1 text-sm text-app-text-muted">
              Add final or special prize amounts in Season Setup.
            </p>
          )}
        </div>
      )}

      {!schemaReady && canManagePayouts && (
        <p className="border-t border-app-border px-4 py-3 text-xs leading-5 text-app-text-muted sm:px-6">
          Recipient and payment tracking will appear here when payout tools are available.
        </p>
      )}
    </Card>
  )
}

function AwardStatusBadge({ status }: { status: SeasonAwardView['status'] }) {
  if (status === 'paid') return <Badge variant="success">Paid</Badge>
  if (status === 'pending') return <Badge variant="warning">Pending payout</Badge>
  if (status === 'saved') return <Badge variant="success">Recipient saved</Badge>
  return <Badge variant="neutral">Awaiting result</Badge>
}
