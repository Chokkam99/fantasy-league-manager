import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
  paidPayoutAmount: number
  schemaReady: boolean
}

export function SeasonAwardCards({
  awards,
  busyFinanceId,
  canManagePayouts,
  members,
  onPayoutStatusChange,
  onRecipientChange,
  paidPayoutAmount,
  schemaReady,
}: SeasonAwardCardsProps) {
  return (
    <Card className="mt-6 min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
            Season awards
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">
            Final prize recipients
          </h2>
          <p className="mt-1 text-sm text-app-text-muted">
            See who receives each prize and whether the money was sent.
          </p>
        </div>
        {schemaReady && awards.some((award) => award.payout) && (
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">
              Payout progress
            </p>
            <p className="mt-1 font-bold text-app-text">
              {currency.format(paidPayoutAmount)} sent
            </p>
          </div>
        )}
      </div>

      {awards.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {awards.map((awardView) => {
            const { award, payout, recipient } = awardView
            const isBusy =
              busyFinanceId === awardView.id || busyFinanceId === payout?.id

            return (
              <article
                className="flex min-w-0 flex-col rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle p-4"
                key={awardView.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-app-text">{awardView.label}</h3>
                    <p className="mt-0.5 text-lg font-bold text-app-brand">
                      {currency.format(awardView.amount)}
                    </p>
                  </div>
                  <AwardStatusBadge status={awardView.status} />
                </div>

                {recipient && (
                  <div className="mt-4 border-t border-app-border pt-3">
                    <p className="truncate font-semibold text-app-text">
                      {recipient.team_name}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-app-text-muted">
                      {recipient.manager_name}
                    </p>
                  </div>
                )}

                {canManagePayouts && award && (
                  <div className="mt-auto grid gap-2 pt-4">
                    <label
                      className="text-xs font-semibold text-app-text-muted"
                      htmlFor={`recipient-${award.id}`}
                    >
                      Recipient
                    </label>
                    <select
                      className="min-h-11 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-base text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand-soft sm:text-sm"
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
                    {payout && (
                      <Button
                        disabled={isBusy}
                        onClick={() =>
                          onPayoutStatusChange(
                            payout.id,
                            payout.status === 'paid' ? 'pending' : 'paid',
                          )
                        }
                        variant={payout.status === 'paid' ? 'secondary' : 'primary'}
                      >
                        {isBusy
                          ? 'Updating…'
                          : payout.status === 'paid'
                            ? 'Mark payout pending'
                            : 'Mark payout paid'}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-[var(--app-radius-sm)] border border-dashed border-app-border p-6 text-center">
          <p className="font-semibold text-app-text">No final prizes configured</p>
          {schemaReady && (
            <p className="mt-1 text-sm text-app-text-muted">
              Add final or special prize amounts in Season Setup.
            </p>
          )}
        </div>
      )}

      {!schemaReady && canManagePayouts && (
        <p className="mt-4 text-xs leading-5 text-app-text-muted">
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
