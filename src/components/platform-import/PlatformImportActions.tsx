import { Button } from '@/components/ui/Button'
import type { PlatformImportOperation } from '@/lib/platformImport'

interface PlatformImportActionsProps {
  isBusy: boolean
  manualWeek: number
  onLoadMapping: () => void
  onManualWeekChange: (week: number) => void
  onRunImport: (
    action: 'preview' | 'sync',
    week: number | 'latest',
  ) => void
  onToggleManual: () => void
  operation: PlatformImportOperation
  showManualFallback: boolean
  syncHasError: boolean
  totalWeeks: number
}

export function PlatformImportActions({
  isBusy,
  manualWeek,
  onLoadMapping,
  onManualWeekChange,
  onRunImport,
  onToggleManual,
  operation,
  showManualFallback,
  syncHasError,
  totalWeeks,
}: PlatformImportActionsProps) {
  return (
    <div className="p-4 sm:px-5 sm:py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          disabled={isBusy}
          onClick={() => onRunImport('sync', 'latest')}
          size="sm"
        >
          {operation === 'sync'
            ? 'Syncing…'
            : syncHasError
              ? 'Retry completed week'
              : 'Sync completed week'}
        </Button>
        <Button
          disabled={isBusy}
          onClick={() => onRunImport('preview', 'latest')}
          size="sm"
          variant="secondary"
        >
          {operation === 'preview' ? 'Loading preview…' : 'Preview completed week'}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
        <button disabled={isBusy} onClick={onLoadMapping} className="min-h-10 text-left text-xs font-semibold text-app-text-muted hover:text-app-brand disabled:opacity-50" type="button">
          {operation === 'mapping-load' ? 'Loading assignments…' : 'Review assignments'}
        </button>
        <button aria-expanded={showManualFallback} className="min-h-10 text-left text-xs font-semibold text-app-text-muted hover:text-app-brand" onClick={onToggleManual} type="button">
          {showManualFallback ? 'Hide selected-week fallback' : 'Need a different week?'}
        </button>
      </div>

      {showManualFallback && (
        <div className="rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface-subtle p-3 sm:p-4">
          <label className="block text-sm font-semibold text-app-text" htmlFor="manual-import-week">
            Selected week
          </label>
          <div className="relative mt-1 w-32">
            <select
              className="min-h-11 w-full appearance-none rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface py-2 pl-3 pr-9 text-base text-app-text outline-none focus:border-app-brand focus:ring-2 focus:ring-app-brand-soft sm:text-sm"
              id="manual-import-week"
              onChange={(event) => onManualWeekChange(Number(event.target.value))}
              value={manualWeek}
            >
              {Array.from({ length: totalWeeks }, (_, index) => index + 1).map(
                (week) => (
                  <option key={week} value={week}>Week {week}</option>
                ),
              )}
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-text-muted"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m7 10 5 5 5-5" />
            </svg>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              disabled={isBusy}
              onClick={() => onRunImport('preview', manualWeek)}
              size="sm"
              variant="secondary"
            >
              Preview week {manualWeek}
            </Button>
            <Button
              disabled={isBusy}
              onClick={() => onRunImport('sync', manualWeek)}
              size="sm"
            >
              Import week {manualWeek}
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-app-text-muted">
            Imports are blocked until ESPN marks the week complete and every active team and matchup validates. You can still edit scores manually below.
          </p>
        </div>
      )}
    </div>
  )
}
