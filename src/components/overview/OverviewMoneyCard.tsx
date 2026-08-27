import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { OverviewViewModel } from '@/lib/overview'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

export function OverviewMoneyCard({
  overview,
  prizesHref,
}: {
  overview: OverviewViewModel
  prizesHref: string
}) {
  const balances = Math.abs(overview.unallocatedPrizes) < 0.01
  const balanceVariant = balances
    ? 'success'
    : overview.unallocatedPrizes > 0
      ? 'warning'
      : 'danger'

  return (
    <Card className="p-5 sm:p-6" id="payout-plan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
            League money
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">
            Where the entry fees go
          </h2>
        </div>
        <Badge variant={balanceVariant}>
          {balances
            ? 'Plan balances'
            : overview.unallocatedPrizes > 0
              ? `${currency.format(overview.unallocatedPrizes)} unallocated`
              : `${currency.format(Math.abs(overview.unallocatedPrizes))} over`}
        </Badge>
      </div>

      <div className="mt-5 overflow-hidden rounded-[var(--app-radius-sm)] border border-app-border">
        <section className="bg-app-brand-soft/55 p-4" aria-labelledby="overview-money-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-app-success">Money in</p>
              <h3 className="mt-1 font-bold text-app-text" id="overview-money-in">Entry fees</h3>
              <p className="mt-1 text-xs text-app-text-muted">
                {overview.totalMembers} players × {currency.format(overview.feeAmount)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-bold text-app-text">{currency.format(overview.expected)}</p>
              <p className="mt-1 text-xs text-app-text-muted">
                {currency.format(overview.collected)} collected
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-app-border p-4" aria-labelledby="overview-money-out">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-app-text-muted">Money out</p>
              <h3 className="mt-1 font-bold text-app-text" id="overview-money-out">Planned split</h3>
            </div>
            <p className="shrink-0 text-xl font-bold text-app-text">{currency.format(overview.plannedOutflow)}</p>
          </div>
          <dl className="mt-3 divide-y divide-app-border text-sm">
            {[
              { label: 'Draft food and costs', value: overview.draftCost },
              { label: 'Weekly prizes', value: overview.weeklyPrizeTotal },
              { label: 'Final and special prizes', value: overview.finalPrizeTotal },
            ].map((item) => (
              <div className="flex justify-between gap-4 py-2.5" key={item.label}>
                <dt className="text-app-text-muted">{item.label}</dt>
                <dd className="shrink-0 font-semibold text-app-text">{currency.format(item.value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className={`border-t px-4 py-3 ${
          balances
            ? 'border-app-success/20 bg-app-brand-soft'
            : overview.unallocatedPrizes > 0
              ? 'border-app-warning/20 bg-app-warning-soft'
              : 'border-app-danger/20 bg-app-danger-soft'
        }`}>
          <p className="text-sm font-bold text-app-text">
            {currency.format(overview.expected)} in − {currency.format(overview.plannedOutflow)} planned = {currency.format(overview.unallocatedPrizes)} remaining
          </p>
          {overview.outstanding > 0 && (
            <p className="mt-1 text-xs text-app-warning">
              {currency.format(overview.outstanding)} of the expected fees still needs to be collected.
            </p>
          )}
        </div>
      </div>

      <Link
        className="mt-4 inline-flex min-h-11 items-center font-semibold text-app-brand hover:text-app-brand-strong"
        href={prizesHref}
      >
        View full money breakdown <span aria-hidden="true" className="ml-2">→</span>
      </Link>
    </Card>
  )
}
