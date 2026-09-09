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
  showAttention?: boolean
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
  showAttention = true,
  overview,
  playoffSpots,
  playoffStartWeek,
  rulesHref,
  standingsHref,
}: OverviewSidebarProps) {
  return (
    <aside className="min-w-0 space-y-6">
      {!isViewOnly && showAttention && <OverviewAttention attentionItems={attentionItems} />}


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

export function OverviewAttention({ attentionItems }: { attentionItems: OverviewAttentionItem[] }) {
  return (
    <section aria-label="Commissioner attention" className={`rounded-xl border px-4 py-3 ${attentionItems.length ? 'border-app-warning/20 bg-app-warning-soft/60' : 'border-app-border bg-app-surface'}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${attentionItems.length ? 'bg-app-warning/10 text-app-warning' : 'bg-app-success-soft text-app-success'}`}>{attentionItems.length ? '!' : '✓'}</span>
          <h2 className="text-sm font-semibold text-app-text">Needs attention</h2>
          <Badge variant={attentionItems.length ? 'warning' : 'success'}>{attentionItems.length || 'All clear'}</Badge>
        </div>
        {attentionItems.length ? (
          <ul className="flex flex-1 flex-wrap gap-x-5 gap-y-1">
            {attentionItems.map((item) => <li key={`${item.href}-${item.label}`}><Link className="inline-flex min-h-10 items-center gap-3 text-sm text-app-text hover:underline" href={item.href}>{item.label}<span aria-hidden="true">→</span></Link></li>)}
          </ul>
        ) : <p className="text-xs leading-5 text-app-text-muted">Dues, sync health, season setup, and prize allocation all look good.</p>}
      </div>
    </section>
  )
}
