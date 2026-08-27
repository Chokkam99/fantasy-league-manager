import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { OverviewViewModel } from '@/lib/overview'

function formatSyncTime(value?: string | null) {
  if (!value) return 'No successful sync recorded'

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

interface SeasonProgressCardProps {
  autoSyncEnabled: boolean
  isViewOnly: boolean
  lastSyncAt?: string | null
  overview: OverviewViewModel
  syncHasError: boolean
  syncIsConnected: boolean
  totalWeeks: number
}

export function SeasonProgressCard({
  autoSyncEnabled,
  isViewOnly,
  lastSyncAt,
  overview,
  syncHasError,
  syncIsConnected,
  totalWeeks,
}: SeasonProgressCardProps) {
  const roundedProgress = Math.round(overview.seasonProgress)

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-text-muted">
            Season progress
          </p>
          <h2 className="mt-1 text-xl font-bold text-app-text">
            {overview.latestWeek
              ? `Week ${overview.latestWeek} is the latest completed week`
              : 'Waiting for the first complete score import'}
          </h2>
        </div>
        <Badge variant={overview.latestWeek ? 'success' : 'neutral'}>
          {totalWeeks ? `${roundedProgress}% complete` : 'Weeks not configured'}
        </Badge>
      </div>
      <div
        aria-label={`${roundedProgress} percent of season scores imported`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={roundedProgress}
        className="mt-5 h-2 overflow-hidden rounded-full bg-app-surface-subtle"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-app-brand transition-[width]"
          style={{ width: `${overview.seasonProgress}%` }}
        />
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-app-border pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-app-text">
            {isViewOnly ? 'Score updates' : 'Score sync'}
          </p>
          <p className="mt-0.5 break-words text-app-text-muted">
            {lastSyncAt
              ? formatSyncTime(lastSyncAt)
              : overview.latestWeek
                ? `Scores recorded through week ${overview.latestWeek}`
                : 'No scores recorded yet'}
          </p>
        </div>
        <Badge
          variant={
            isViewOnly
              ? overview.latestWeek
                ? 'success'
                : 'neutral'
              : syncHasError
                ? 'danger'
                : syncIsConnected
                  ? 'success'
                  : 'warning'
          }
        >
          {isViewOnly
            ? overview.latestWeek
              ? `Week ${overview.latestWeek} posted`
              : 'Waiting for scores'
            : syncHasError
              ? 'Needs attention'
              : syncIsConnected
                ? autoSyncEnabled
                  ? 'Automatic sync on'
                  : 'Manual sync'
                : 'Platform not connected'}
        </Badge>
      </div>
    </Card>
  )
}
