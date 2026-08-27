import { Badge } from '@/components/ui/Badge'
import type { ImportRunSummary } from '@/lib/platformImport'

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

function formatImportError(value: string) {
  const weekMatch = value.match(/ESPN week (\d+)/i)
  const lowerValue = value.toLowerCase()

  if (
    lowerValue.includes('fetch failed') ||
    lowerValue.includes('network') ||
    lowerValue.includes('could not be reached')
  ) {
    return `ESPN could not be reached${weekMatch ? ` for week ${weekMatch[1]}` : ''}. Retry when the connection is available.`
  }

  return value.replace(/typeerror:\s*/gi, '').trim()
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
      {run.error_message && run.error_message !== lastSyncError && (
        <p className="mt-2 text-sm leading-5 text-app-danger">
          {formatImportError(run.error_message)}
        </p>
      )}
    </div>
  )
}
