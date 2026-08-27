import { Card } from '@/components/ui/Card'
import type { PortfolioSummary } from '@/lib/portfolio'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

export function PortfolioOverview({ summary }: { summary: PortfolioSummary }) {
  return (
    <>
      <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-3 sm:p-5">
          <p className="text-xs font-semibold text-app-text-muted">Active leagues</p>
          <p className="mt-1 text-xl font-bold text-app-text sm:text-2xl">
            {summary.activeLeagueCount}
          </p>
        </Card>
        <Card className="p-3 sm:p-5">
          <p className="text-xs font-semibold text-app-text-muted">Players tracked</p>
          <p className="mt-1 text-xl font-bold text-app-text sm:text-2xl">
            {summary.totalPlayers}
          </p>
        </Card>
        <Card className="col-span-2 p-3 sm:col-span-1 sm:p-5">
          <p className="text-xs font-semibold text-app-text-muted">Dues collected</p>
          <p className="mt-1 text-base font-bold tracking-tight text-app-success sm:text-2xl">
            {currency.format(summary.collectedAmount)}
          </p>
        </Card>
      </section>

      {summary.attentionCount > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-[var(--app-radius-md)] border border-app-warning/20 bg-app-warning-soft px-4 py-3 text-sm text-app-warning">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-app-warning"
          />
          <p>
            {summary.attentionCount}{' '}
            {summary.attentionCount === 1 ? 'league needs' : 'leagues need'} a review.
          </p>
        </div>
      )}

      <div className="mt-6">
        <div>
          <h2 className="text-lg font-bold text-app-text sm:text-xl">Your leagues</h2>
          <p className="mt-1 text-sm text-app-text-muted">
            Current seasons and league health at a glance.
          </p>
        </div>
      </div>
    </>
  )
}
