import {
  getAutomationReadiness,
  validateAutomationSettings,
} from '../automationSettings'

describe('automation settings', () => {
  it('normalizes a valid public ESPN configuration', () => {
    expect(
      validateAutomationSettings({
        auto_sync_enabled: false,
        league_id: ' 1552816 ',
        private_league: false,
        season: '2025',
      }),
    ).toEqual({
      is_valid: true,
      value: {
        auto_sync_enabled: false,
        espn_s2: undefined,
        league_id: '1552816',
        private_league: false,
        season: '2025',
        swid: undefined,
      },
    })
  })

  it('rejects malformed IDs, seasons, booleans, and credentials', () => {
    const result = validateAutomationSettings({
      auto_sync_enabled: 'yes',
      espn_s2: 123,
      league_id: 'league-abc',
      private_league: 'private',
      season: '25',
      swid: 456,
    })

    expect(result.is_valid).toBe(false)
    if (!result.is_valid) expect(result.errors).toHaveLength(6)
  })

  it('requires both private cookies before a connection can be saved', () => {
    expect(
      getAutomationReadiness({
        cronConfigured: true,
        hasEspnS2: true,
        hasSwid: false,
        leagueId: '1552816',
        privateLeague: true,
      }),
    ).toMatchObject({
      can_enable_automatic: false,
      can_save_connection: false,
    })
  })

  it('requires cron security only for automatic activation readiness', () => {
    const readiness = getAutomationReadiness({
      cronConfigured: false,
      hasEspnS2: false,
      hasSwid: false,
      leagueId: '1552816',
      privateLeague: false,
    })

    expect(readiness.can_save_connection).toBe(true)
    expect(readiness.can_enable_automatic).toBe(false)
    expect(readiness.checks.find((check) => check.key === 'cron')?.ready).toBe(
      false,
    )
  })
})
