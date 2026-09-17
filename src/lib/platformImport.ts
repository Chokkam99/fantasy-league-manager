import { formatAppError } from '@/lib/appErrors'
export interface ImportRunSummary {
  completed_at: string | null
  error_message: string | null
  matchup_count: number
  score_count: number
  started_at: string
  status: string
  trigger_mode: string
  week_number: number
}

interface PlatformSettingsForDraft {
  auto_sync_enabled: boolean
  latest_imported_week: number
  league_id: string
  private_league: boolean
  total_weeks: number
}

export interface PlatformConnectionDraft {
  autoSyncEnabled: boolean
  espnLeagueId: string
  espnS2: string
  privateLeague: boolean
  swid: string
}

export type PlatformImportOperation =
  | 'config'
  | 'mapping-load'
  | 'mapping-save'
  | 'preview'
  | 'sync'
  | null

export type PlatformImportNotice = {
  kind: 'error' | 'success'
  message: string
} | null

export function connectionDraftFromSettings(
  settings: PlatformSettingsForDraft,
): PlatformConnectionDraft {
  return {
    autoSyncEnabled: settings.auto_sync_enabled,
    espnLeagueId: settings.league_id,
    espnS2: '',
    privateLeague: settings.private_league,
    swid: '',
  }
}

export function nextManualImportWeek(settings: PlatformSettingsForDraft) {
  return Math.min(
    Math.max(settings.latest_imported_week + 1, 1),
    Math.max(settings.total_weeks, 1),
  )
}

export function normalizePlatformSyncHealth({
  autoSyncEnabled,
  lastSyncError,
  syncStatus,
  totalWeeks,
}: {
  autoSyncEnabled: boolean
  lastSyncError: string | null
  syncStatus: string
  totalWeeks: number
}) {
  const parsedMaximumWeek = Math.trunc(Number(totalWeeks) || 0)
  const maximumWeek = parsedMaximumWeek > 0 ? parsedMaximumWeek : null
  const weekReferences = lastSyncError
    ? Array.from(
        lastSyncError.matchAll(
          /(?:\bweek\s*(\d+)\b|\b(\d+)(?:st|nd|rd|th)\s+week\b)/gi,
        ),
        (match) => Number(match[1] || match[2]),
      )
    : []
  const isOutOfRangeError = weekReferences.some(
    (week) =>
      maximumWeek !== null && Number.isInteger(week) && week > maximumWeek,
  )

  return {
    lastSyncError: isOutOfRangeError || !lastSyncError ? null : formatPlatformSyncError(lastSyncError),
    syncStatus:
      isOutOfRangeError && syncStatus === 'error'
        ? autoSyncEnabled
          ? 'active'
          : 'disabled'
        : syncStatus,
  }
}

export function getPlatformImportHealth({
  isConfigured,
  isLoading,
  isAutomatic,
  syncStatus,
}: {
  isAutomatic: boolean
  isConfigured: boolean
  isLoading: boolean
  syncStatus: string
}) {
  if (isLoading) return { label: 'Loading', variant: 'neutral' as const }
  if (!isConfigured) {
    return { label: 'Not connected', variant: 'neutral' as const }
  }
  if (syncStatus === 'error') {
    return { label: 'Needs attention', variant: 'danger' as const }
  }
  return isAutomatic
    ? { label: 'Automatic weekly', variant: 'success' as const }
    : { label: 'Manual sync', variant: 'warning' as const }
}

export function formatPlatformSyncTime(value: string | null) {
  if (!value) return 'Never synced'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatPlatformSyncError(value: string) {
  const contextual = /fetch failed|failed to fetch|network|timeout|timed out/i.test(value) && !/ESPN/i.test(value)
    ? `ESPN ${value}` : value
  return formatAppError(contextual, 'The ESPN sync could not be completed. Try syncing again. If this continues, contact the app maintainer.')
}
