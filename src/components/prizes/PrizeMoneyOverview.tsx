import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import type { FinalPrizeRule, PrizePlan } from '@/lib/prizes'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: 'currency',
})

interface PrizeMoneyOverviewProps {
  collectedFees: number
  expectedFees: number
  finalRules: FinalPrizeRule[]
  outstandingFees: number
  paidPlayers: number
  partialPlayers: number
  prizePlan: PrizePlan
  selectedSeason: string
  totalWeeks: number
  weeklyPrizeAmount: number
}

export function PrizeMoneyOverview({
  collectedFees,
  expectedFees,
  finalRules,
  outstandingFees,
  paidPlayers,
  partialPlayers,
  prizePlan,
  selectedSeason,
  totalWeeks,
  weeklyPrizeAmount,
}: PrizeMoneyOverviewProps) {
  const balanceBadge =
    prizePlan.status === 'balanced'
      ? { label: 'Plan balances', variant: 'success' as const }
      : prizePlan.status === 'unallocated'
        ? {
            label: `${currency.format(prizePlan.balance)} unallocated`,
            variant: 'warning' as const,
          }
        : {
            label: `${currency.format(Math.abs(prizePlan.balance))} over plan`,
            variant: 'danger' as const,
          }
  const allocationScale = Math.max(
    prizePlan.expectedFees,
    prizePlan.totalOutflow,
    1,
  )
  const allocationSegments = [
    {
      amount: prizePlan.draftCost,
      color: 'bg-app-accent',
      label: 'Draft food and costs',
    },
    {
      amount: prizePlan.weeklyAllocation,
      color: 'bg-app-info',
      label: 'Weekly prizes',
    },
    {
      amount: prizePlan.finalAllocation,
      color: 'bg-app-brand',
      label: 'Final and special prizes',
    },
    {
      amount: Math.max(prizePlan.balance, 0),
      color: 'bg-app-border',
      label: 'Unallocated',
    },
  ].filter((segment) => segment.amount > 0)

  return (
    <>
      <PageHeader eyebrow={`${selectedSeason} season / The money`} title="League money" description="A clear picture of every entry fee, every prize, and who gets paid." action={<Badge variant={balanceBadge.variant}>{balanceBadge.label}</Badge>} />

      <Card className="mt-6 min-w-0 overflow-hidden">
        <section aria-labelledby="money-in-heading" className="bg-app-success-soft/70 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-success">
                Money in
              </p>
              <h2 className="mt-1 text-xl font-bold text-app-text" id="money-in-heading">
                Entry fees
              </h2>
              <p className="mt-1 text-sm text-app-text-muted">
                {prizePlan.activePlayers} players × {currency.format(prizePlan.entryFee)}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--app-radius-sm)] border border-app-brand/15 bg-app-brand/15 lg:min-w-[30rem]">
              {[
                { label: 'Expected', value: expectedFees },
                { label: 'Collected', value: collectedFees },
                { label: 'Outstanding', value: outstandingFees },
              ].map((item) => (
                <div className="min-w-0 bg-app-surface/90 p-3 text-center sm:p-4" key={item.label}>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-app-text-muted">
                    {item.label}
                  </dt>
                  <dd className="mt-1 break-words text-lg font-bold text-app-text sm:text-2xl">
                    {currency.format(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-3 text-xs font-medium text-app-success">
            {paidPlayers} of {prizePlan.activePlayers} players paid
            {partialPlayers > 0 ? ` · ${partialPlayers} partial` : ''}
          </p>
        </section>

        <section aria-labelledby="money-out-heading" className="border-t border-app-border p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">
                Money out
              </p>
              <h2 className="mt-1 text-xl font-bold text-app-text" id="money-out-heading">
                How {currency.format(prizePlan.expectedFees)} is divided
              </h2>
            </div>
            <p className="text-sm font-semibold text-app-text">
              {currency.format(prizePlan.totalOutflow)} planned
            </p>
          </div>

          {allocationSegments.length > 0 && (
            <div className="mt-5">
              <div
                aria-label={`Allocation of ${currency.format(prizePlan.expectedFees)} in expected fees`}
                className="flex h-3 overflow-hidden rounded-full bg-app-surface-subtle"
                role="img"
              >
                {allocationSegments.map((segment) => (
                  <div
                    className={segment.color}
                    key={segment.label}
                    style={{ width: `${(segment.amount / allocationScale) * 100}%` }}
                    title={`${segment.label}: ${currency.format(segment.amount)}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-app-text-muted">
                {allocationSegments.map((segment) => (
                  <span className="inline-flex items-center gap-2" key={segment.label}>
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${segment.color}`} />
                    {segment.label} · {currency.format(segment.amount)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 divide-y divide-app-border rounded-[var(--app-radius-sm)] border border-app-border">
            <AllocationRow
              amount={prizePlan.draftCost}
              detail="League expenses before prizes"
              label="Draft food and costs"
            />
            <AllocationRow
              amount={prizePlan.weeklyAllocation}
              detail={`${totalWeeks} weeks × ${currency.format(weeklyPrizeAmount)}`}
              label="Weekly prizes"
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-app-text">Final and special prizes</h3>
                  <p className="mt-1 text-xs text-app-text-muted">Season awards and bonuses</p>
                </div>
                <p className="shrink-0 font-bold text-app-text">
                  {currency.format(prizePlan.finalAllocation)}
                </p>
              </div>
              {finalRules.length > 0 && (
                <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                  {finalRules.map((rule) => (
                    <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-sm)] bg-app-surface-subtle px-3 py-2.5 text-sm" key={rule.key}>
                      <dt className="text-app-text-muted">{rule.label}</dt>
                      <dd className="shrink-0 font-semibold text-app-text">{currency.format(rule.amount)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </section>

        <div className={`border-t p-5 sm:p-6 ${
          prizePlan.status === 'balanced'
            ? 'border-app-success/20 bg-app-success-soft'
            : prizePlan.status === 'unallocated'
              ? 'border-app-warning/20 bg-app-warning-soft'
              : 'border-app-danger/20 bg-app-danger-soft'
        }`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-muted">Does it add up?</p>
              <p className="mt-1 text-lg font-bold text-app-text">
                {currency.format(prizePlan.expectedFees)} in − {currency.format(prizePlan.totalOutflow)} planned = {currency.format(prizePlan.balance)} remaining
              </p>
              {outstandingFees > 0 && (
                <p className="mt-1 text-sm text-app-warning">
                  The plan balances expected fees, but {currency.format(outstandingFees)} still needs to be collected.
                </p>
              )}
            </div>
            <Badge variant={balanceBadge.variant}>{balanceBadge.label}</Badge>
          </div>
        </div>
      </Card>
    </>
  )
}

function AllocationRow({
  amount,
  detail,
  label,
}: {
  amount: number
  detail: string
  label: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div>
        <h3 className="font-semibold text-app-text">{label}</h3>
        <p className="mt-1 text-xs text-app-text-muted">{detail}</p>
      </div>
      <p className="shrink-0 font-bold text-app-text">{currency.format(amount)}</p>
    </div>
  )
}
