import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { OverviewViewModel } from '@/lib/overview'

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

export interface OverviewAttentionItem {
  href: string
  label: string
}

interface OverviewSidebarProps {
  attentionItems: OverviewAttentionItem[]
  historyHref: string
  isViewOnly: boolean
  overview: OverviewViewModel
  playoffSpots: number
  playoffStartWeek: number
  rulesHref: string
  standingsHref: string
}

export function OverviewSidebar({
  attentionItems,
  historyHref,
  isViewOnly,
  overview,
  playoffSpots,
  playoffStartWeek,
  rulesHref,
  standingsHref,
}: OverviewSidebarProps) {
  return (
    <aside className="min-w-0 space-y-6">
      {!isViewOnly && (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-app-text">Needs attention</h2>
            <Badge variant={attentionItems.length ? 'warning' : 'success'}>
              {attentionItems.length || 'All clear'}
            </Badge>
          </div>
          {attentionItems.length ? (
            <ul className="mt-4 space-y-2">
              {attentionItems.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--app-radius-sm)] bg-app-warning-soft px-3 py-2.5 text-sm font-medium text-app-text hover:text-app-brand-strong"
                    href={item.href}
                  >
                    <span className="min-w-0 break-words">{item.label}</span>
                    <span aria-hidden="true" className="shrink-0">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-app-text-muted">
              Dues, sync health, season setup, and prize allocation all look good.
            </p>
          )}
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-app-text">League snapshot</h2>
        <dl className="mt-4 space-y-4 text-sm">
          {[
            { label: 'Players', value: String(overview.totalMembers) },
            { label: 'Entry fee', value: currency.format(overview.feeAmount) },
            {
              label: 'Playoff spots',
              value: playoffSpots > 0 ? String(playoffSpots) : 'Not set',
            },
            {
              label: 'Playoffs begin',
              value: playoffStartWeek > 0 ? `Week ${playoffStartWeek}` : 'Not set',
            },
          ].map((item) => (
            <div className="flex items-start justify-between gap-4" key={item.label}>
              <dt className="text-app-text-muted">{item.label}</dt>
              <dd className="font-semibold text-app-text">{item.value}</dd>
            </div>
          ))}
        </dl>
        <SidebarLink href={standingsHref}>Open standings</SidebarLink>
        <SidebarLink href={rulesHref}>Read league rules</SidebarLink>
        <SidebarLink href={historyHref}>Browse league history</SidebarLink>
      </Card>
    </aside>
  )
}

function SidebarLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      className="flex min-h-11 items-center font-semibold text-app-brand hover:text-app-brand-strong first-of-type:mt-5"
      href={href}
    >
      {children} <span aria-hidden="true" className="ml-2">→</span>
    </Link>
  )
}
