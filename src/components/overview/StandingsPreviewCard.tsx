import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { OverviewStanding } from '@/lib/overview'

function record(standing: OverviewStanding) {
  const { losses, ties, wins } = standing.row
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`
}

export function StandingsPreviewCard({
  loadError,
  standings,
  standingsHref,
}: {
  loadError?: string | null
  standings: OverviewStanding[]
  standingsHref: string
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-end justify-between gap-3 border-b border-app-border p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
            Playoff picture
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">Standings leaders</h2>
        </div>
        <Link className="font-semibold text-app-brand hover:text-app-brand-strong" href={standingsHref}>
          Full standings <span aria-hidden="true">→</span>
        </Link>
      </div>
      {loadError ? (
        <div className="p-6 text-center" role="status">
          <p className="font-semibold text-app-text">Standings preview unavailable</p>
          <p className="mt-1 text-sm text-app-text-muted">{loadError}</p>
        </div>
      ) : standings.length > 0 ? (
        <ol className="divide-y divide-app-border">
          {standings.map((standing, index) => (
            <li className="flex min-w-0 items-center gap-3 px-5 py-3.5 sm:px-6" key={standing.row.member.id}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-surface-subtle font-mono text-sm font-bold text-app-text">
                {standing.seed || index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-app-text">{standing.row.member.team_name}</p>
                <p className="truncate text-sm text-app-text-muted">{standing.row.member.manager_name}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-app-text">{record(standing)}</p>
                <p className="text-xs text-app-text-muted">{standing.row.points_for.toFixed(2)} PF</p>
              </div>
              {standing.isDivisionLeader ? (
                <Badge variant="success">Division</Badge>
              ) : standing.isPlayoffPosition ? (
                <Badge variant="info">Seed {standing.seed}</Badge>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="p-6 text-center">
          <p className="font-semibold text-app-text">No completed standings yet</p>
          <p className="mt-1 text-sm text-app-text-muted">
            Leaders will appear after a complete week of scores and matchups is recorded.
          </p>
        </div>
      )}
    </Card>
  )
}
