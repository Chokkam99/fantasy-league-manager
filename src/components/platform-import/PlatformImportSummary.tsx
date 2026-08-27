import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ImportRunStatus } from '@/components/league/ImportRunStatus'
import { Notice } from '@/components/ui/Notice'
import {
  formatPlatformSyncError,
  formatPlatformSyncTime,
  getPlatformImportHealth,
} from '@/lib/platformImport'
import type { AutomationSettingsSnapshot } from '@/lib/platformImportClient'

interface PlatformImportSummaryProps {
  isLoading: boolean
  onToggleConfig: () => void
  settings: AutomationSettingsSnapshot | null
  showConfig: boolean
}

export function PlatformImportSummary({
  isLoading,
  onToggleConfig,
  settings,
  showConfig,
}: PlatformImportSummaryProps) {
  const isConfigured = settings?.is_configured || false
  const health = getPlatformImportHealth({
    isAutomatic: settings?.auto_sync_enabled || false,
    isConfigured,
    isLoading,
    syncStatus: settings?.sync_status || 'none',
  })

  return (
    <div className="border-b border-app-border p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-app-text">Score imports</h2>
            <Badge variant={health.variant}>{health.label}</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-app-text-muted">
            {isLoading
              ? 'Loading secure ESPN connection status…'
              : isConfigured
                ? `ESPN · ${formatPlatformSyncTime(settings?.last_sync_at || null)}`
                : 'Connect ESPN to preview and import completed weeks.'}
          </p>
        </div>
        <Button
          aria-expanded={showConfig}
          disabled={isLoading}
          onClick={onToggleConfig}
          size="sm"
          variant="ghost"
        >
          {isConfigured ? 'Connection settings' : 'Connect ESPN'}
        </Button>
      </div>

      {isConfigured && settings && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryItem
            label="Schedule"
            value={
              settings.auto_sync_enabled
                ? 'Wednesday, 2:00 AM Phoenix'
                : 'Automatic sync is off'
            }
          />
          <SummaryItem
            label="Season"
            value={`${settings.season} · ${settings.total_weeks} weeks`}
          />
        </div>
      )}

      {settings?.last_sync_error && (
        <Notice className="mt-4" tone="danger">
          <p className="font-semibold">Last sync needs attention</p>
          <p className="mt-1 break-words leading-5">
            {formatPlatformSyncError(settings.last_sync_error)}
          </p>
        </Notice>
      )}

      {settings?.latest_import_run && (
        <ImportRunStatus
          lastSyncError={settings.last_sync_error}
          run={settings.latest_import_run}
        />
      )}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--app-radius-sm)] bg-app-surface-subtle p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-app-text">{value}</p>
    </div>
  )
}
