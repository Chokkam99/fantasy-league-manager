import { Badge } from '@/components/ui/Badge'
import { formatPlatformSyncError, type ImportRunSummary } from '@/lib/platformImport'

export type { ImportRunSummary } from '@/lib/platformImport'

interface ImportRunStatusProps {
  lastSyncError?: string | null
  run: ImportRunSummary
}

function formatImportTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}


export function ImportRunStatus({ lastSyncError, run }: ImportRunStatusProps) {
  const triggerLabel =
    run.trigger_mode === 'scheduled_correction'
      ? 'Automatic correction'
      : run.trigger_mode === 'scheduled'
        ? 'Automatic'
        : 'Manual'
  const displayStatus =
    run.status === 'succeeded'
      ? { label: 'Completed', variant: 'success' as const }
      : run.status === 'failed'
        ? { label: 'Failed', variant: 'danger' as const }
        : { label: 'Running', variant: 'warning' as const }

  return (
    <div className="mt-4 rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">
            Latest import attempt
          </p>
          <p className="mt-1 text-sm font-semibold text-app-text">
            Week {run.week_number} · {triggerLabel}
          </p>
        </div>
        <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-app-text-muted">
        {formatImportTime(run.completed_at || run.started_at)}
        {run.status === 'succeeded'
          ? ` · ${run.score_count} scores · ${run.matchup_count} matchups`
          : ''}
      </p>
      {run.error_message && formatPlatformSyncError(run.error_message) !== (lastSyncError ? formatPlatformSyncError(lastSyncError) : null) && (
        <p className="mt-2 text-sm leading-5 text-app-danger">
          {formatPlatformSyncError(run.error_message)}
        </p>
      )}
    </div>
  )
}
