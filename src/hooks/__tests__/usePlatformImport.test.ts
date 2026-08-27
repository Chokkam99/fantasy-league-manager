import { act, renderHook, waitFor } from '@testing-library/react'
import { usePlatformImport } from '@/hooks/usePlatformImport'
import {
  loadAutomationSettings,
  PlatformImportRequestError,
  requestESPNImport,
} from '@/lib/platformImportClient'

jest.mock('@/lib/platformImportClient', () => ({
  loadAutomationSettings: jest.fn(),
  loadESPNTeamMapping: jest.fn(),
  PlatformImportRequestError: class PlatformImportRequestError extends Error {
    readonly payload: unknown

    constructor(message: string, errorPayload: unknown) {
      super(message)
      this.payload = errorPayload
    }
  },
  requestESPNImport: jest.fn(),
  saveAutomationSettings: jest.fn(),
  saveESPNTeamMapping: jest.fn(),
}))

const mockLoadSettings = loadAutomationSettings as jest.MockedFunction<
  typeof loadAutomationSettings
>
const mockRequestImport = requestESPNImport as jest.MockedFunction<
  typeof requestESPNImport
>

const settings = {
  auto_sync_enabled: false,
  cron_configured: true,
  has_espn_s2: false,
  has_swid: false,
  is_configured: true,
  last_sync_at: null,
  last_sync_error: null,
  latest_imported_week: 3,
  latest_import_run: null,
  league_id: '123',
  private_league: false,
  readiness: {
    can_enable_automatic: true,
    can_save_connection: true,
    checks: [],
  },
  season: '2026',
  sync_status: 'active',
  total_weeks: 17,
} as const

describe('usePlatformImport orchestration', () => {
  beforeEach(() => {
    mockLoadSettings.mockReset().mockResolvedValue(settings)
    mockRequestImport.mockReset()
  })

  it('loads sanitized status and stores a successful preview', async () => {
    mockRequestImport.mockResolvedValue({
      preview: {
        is_complete: true,
        matchups: [],
        scores: [{ member_id: 'one', points: 120, team_name: 'Team One' }],
        week: 4,
      },
      success: true,
      validation: {
        can_import: true,
        errors: [],
        is_valid: true,
        summary: {
          expected_matchups: 0,
          expected_teams: 1,
          matchup_count: 0,
          score_count: 1,
        },
        warnings: [],
      },
      week: 4,
    })
    const { result } = renderHook(() =>
      usePlatformImport('league-one', '2026'),
    )
    await waitFor(() => expect(result.current.isLoadingConfig).toBe(false))

    expect(result.current.manualWeek).toBe(4)
    expect(result.current.draft.espnLeagueId).toBe('123')
    await act(async () => result.current.runImport('preview', 'latest'))
    expect(result.current.preview?.data.week).toBe(4)
    expect(result.current.notice).toEqual({
      kind: 'success',
      message: 'Week 4 is complete and ready to import.',
    })
  })

  it('opens mapping recovery without retrying health for a mapping error', async () => {
    const mapping = {
      assignments: [],
      duplicate_matches: [],
      is_complete: false,
      members: [],
      teams: [],
      unmapped_espn_team_ids: [],
      unmapped_member_ids: [],
    }
    mockRequestImport.mockRejectedValue(
      new PlatformImportRequestError('Review assignments', {
        code: 'TEAM_MAPPING_REQUIRED',
        error: 'Review assignments',
        mapping,
        success: false,
      }),
    )
    const { result } = renderHook(() =>
      usePlatformImport('league-one', '2026'),
    )
    await waitFor(() => expect(result.current.isLoadingConfig).toBe(false))

    await act(async () => result.current.runImport('sync', 'latest'))
    expect(result.current.teamMapping).toEqual(mapping)
    expect(result.current.notice?.message).toBe('Review assignments')
    expect(mockLoadSettings).toHaveBeenCalledTimes(1)
  })
})
