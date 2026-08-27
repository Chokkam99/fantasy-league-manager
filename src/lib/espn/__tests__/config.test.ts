import { resolveESPNConfig } from '@/lib/espn/config'

describe('resolveESPNConfig', () => {
  it('prefers the generic platform configuration written by the UI', () => {
    expect(
      resolveESPNConfig({
        current_season: '2026',
        espn_league_id: 'legacy-id',
        platform_type: 'espn',
        platform_league_id: 'generic-id',
        platform_config: {
          credentials: { espn_s2: 'generic-s2', swid: 'generic-swid' },
          private_league: true,
        },
      }),
    ).toEqual({
      league_id: 'generic-id',
      year: 2026,
      private_league: true,
      espn_s2: 'generic-s2',
      swid: 'generic-swid',
      team_mappings: {},
    })
  })

  it('supports legacy ESPN fields for existing leagues', () => {
    expect(
      resolveESPNConfig({
        current_season: '2025',
        espn_league_id: 'legacy-id',
        espn_s2: 'legacy-s2',
        espn_swid: 'legacy-swid',
      }),
    ).toEqual({
      league_id: 'legacy-id',
      year: 2025,
      private_league: true,
      espn_s2: 'legacy-s2',
      swid: 'legacy-swid',
      team_mappings: {},
    })
  })

  it('does not treat a different configured platform as ESPN', () => {
    expect(
      resolveESPNConfig({
        current_season: '2026',
        espn_league_id: 'stale-legacy-id',
        platform_type: 'sleeper',
      }),
    ).toBeNull()
  })

  it('does not reuse stale legacy cookies for an explicitly public generic connection', () => {
    expect(
      resolveESPNConfig({
        current_season: '2026',
        espn_s2: 'legacy-s2',
        espn_swid: 'legacy-swid',
        platform_config: { private_league: false },
        platform_league_id: '1552816',
        platform_type: 'espn',
      }),
    ).toEqual({
      espn_s2: undefined,
      league_id: '1552816',
      private_league: false,
      swid: undefined,
      team_mappings: {},
      year: 2026,
    })
  })

  it('loads only mappings for the current season', () => {
    expect(
      resolveESPNConfig({
        current_season: '2026',
        platform_config: {
          team_mappings: {
            '2025': { '1': 'old-member' },
            '2026': { '1': 'current-member', invalid: 42 },
          },
        },
        platform_league_id: '1552816',
        platform_type: 'espn',
      })?.team_mappings,
    ).toEqual({ '1': 'current-member' })
  })
})
