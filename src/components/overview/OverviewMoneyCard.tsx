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

      <div className="mt-5 flex items-end justify-between gap-4 border-b border-app-border pb-4">
        <div>
          <p className="text-xs text-app-text-muted">Season entry pool</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-app-text">{currency.format(overview.expected)}</p>
        </div>
        <p className="pb-1 text-right text-xs text-app-text-muted">{overview.totalMembers} players × {currency.format(overview.feeAmount)}</p>
      </div>
      <dl className="mt-1 divide-y divide-app-border text-sm">
        {[
          { label: 'Draft food and costs', value: overview.draftCost, color: 'bg-app-info' },
          { label: 'Weekly prizes', value: overview.weeklyPrizeTotal, color: 'bg-app-success' },
          { label: 'Final and special prizes', value: overview.finalPrizeTotal, color: 'bg-app-ink' },
        ].map((item) => (
          <div className="flex items-center justify-between gap-3 py-3" key={item.label}>
            <dt className="flex items-center gap-2.5 text-app-text-muted"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-sm ${item.color}`} />{item.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-app-text">{currency.format(item.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-app-surface-subtle px-3 py-3 text-xs">
        <span className="text-app-text-muted">{currency.format(overview.plannedOutflow)} allocated</span>
        <span className={`font-semibold ${balances ? 'text-app-success' : overview.unallocatedPrizes > 0 ? 'text-app-warning' : 'text-app-danger'}`}>{currency.format(overview.unallocatedPrizes)} remaining</span>
      </div>

      <Link
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-app-brand hover:text-app-brand-strong"
        href={prizesHref}
      >
        View full money breakdown <span aria-hidden="true" className="ml-2">→</span>
      </Link>
    </Card>
  )
}
