import {
  connectionDraftFromSettings,
  formatPlatformSyncError,
  getPlatformImportHealth,
  nextManualImportWeek,
  normalizePlatformSyncHealth,
} from '@/lib/platformImport'
import type { AutomationSettingsSnapshot } from '@/lib/platformImportClient'

function settings(
  overrides: Partial<AutomationSettingsSnapshot> = {},
): AutomationSettingsSnapshot {
  return {
    auto_sync_enabled: false,
    cron_configured: true,
    has_espn_s2: true,
    has_swid: true,
    is_configured: true,
    last_sync_at: null,
    last_sync_error: null,
    latest_imported_week: 4,
    latest_import_run: null,
    league_id: '12345',
    private_league: true,
    readiness: {
      can_enable_automatic: true,
      can_save_connection: true,
      checks: [],
    },
    season: '2026',
    sync_status: 'active',
    total_weeks: 17,
    ...overrides,
  }
}

describe('platform import presentation model', () => {
  it('hydrates non-secret connection fields and chooses the next bounded week', () => {
    expect(connectionDraftFromSettings(settings())).toEqual({
      autoSyncEnabled: false,
      espnLeagueId: '12345',
      espnS2: '',
      privateLeague: true,
      swid: '',
    })
    expect(nextManualImportWeek(settings())).toBe(5)
    expect(nextManualImportWeek(settings({ latest_imported_week: 17 }))).toBe(17)
  })

  it('describes loading, error, automatic, and manual connection health', () => {
    expect(
      getPlatformImportHealth({
        isAutomatic: false,
        isConfigured: false,
        isLoading: true,
        syncStatus: 'none',
      }).label,
    ).toBe('Loading')
    expect(
      getPlatformImportHealth({
        isAutomatic: true,
        isConfigured: true,
        isLoading: false,
        syncStatus: 'error',
      }).label,
    ).toBe('Needs attention')
    expect(
      getPlatformImportHealth({
        isAutomatic: true,
        isConfigured: true,
        isLoading: false,
        syncStatus: 'active',
      }).label,
    ).toBe('Automatic weekly')
  })

  it('turns low-level ESPN network failures into actionable copy', () => {
    expect(formatPlatformSyncError('TypeError: fetch failed for ESPN week 8')).toBe(
      'ESPN could not be reached for week 8. Retry when the connection is available.',
    )
  })

  it('ignores stale errors beyond the configured final week', () => {
    expect(
      normalizePlatformSyncHealth({
        autoSyncEnabled: true,
        lastSyncError: 'ESPN week 18 failed import validation.',
        syncStatus: 'error',
        totalWeeks: 17,
      }),
    ).toEqual({ lastSyncError: null, syncStatus: 'active' })

    expect(
      normalizePlatformSyncHealth({
        autoSyncEnabled: true,
        lastSyncError: 'ESPN week 17 failed import validation.',
        syncStatus: 'error',
        totalWeeks: 17,
      }),
    ).toEqual({
      lastSyncError: 'ESPN week 17 failed import validation.',
      syncStatus: 'error',
    })

    expect(
      normalizePlatformSyncHealth({
        autoSyncEnabled: false,
        lastSyncError: 'Failed to fetch Week 18',
        syncStatus: 'error',
        totalWeeks: 17,
      }),
    ).toEqual({ lastSyncError: null, syncStatus: 'disabled' })

    expect(
      normalizePlatformSyncHealth({
        autoSyncEnabled: false,
        lastSyncError: 'Failed to fetch Week 18',
        syncStatus: 'error',
        totalWeeks: 0,
      }),
    ).toEqual({
      lastSyncError: 'Failed to fetch Week 18',
      syncStatus: 'error',
    })
  })
})
