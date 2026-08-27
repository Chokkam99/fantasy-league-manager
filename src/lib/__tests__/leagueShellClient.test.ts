import {
  loadLeagueShellData,
  type LeagueShellDataSource,
} from '@/lib/leagueShellClient'

function source(): jest.Mocked<LeagueShellDataSource> {
  return {
    loadLeague: jest.fn().mockResolvedValue({
      data: {
        archived_at: null,
        auto_sync_enabled: false,
        created_at: null,
        current_season: '2026',
        id: 'league-one',
        last_sync_at: null,
        last_sync_error: null,
        name: 'Gridiron Gurus',
        platform_league_id: null,
        platform_type: null,
        sync_status: null,
        updated_at: null,
      },
      error: null,
    }),
    loadLegacyLeague: jest.fn(),
    loadLegacySeasons: jest.fn(),
    loadSeasons: jest.fn().mockResolvedValue({
      data: [{ archived_at: null, season: '2026' }],
      error: null,
    }),
  }
}

describe('league shell loading', () => {
  it('uses two fixed public reads in the normal schema', async () => {
    const dataSource = source()

    await expect(
      loadLeagueShellData('league-one', dataSource),
    ).resolves.toMatchObject({
      leagueResult: { data: { id: 'league-one' } },
      seasonsResult: { data: [{ season: '2026' }] },
    })
    expect(dataSource.loadLeague).toHaveBeenCalledWith('league-one')
    expect(dataSource.loadSeasons).toHaveBeenCalledWith('league-one')
    expect(dataSource.loadLegacyLeague).not.toHaveBeenCalled()
    expect(dataSource.loadLegacySeasons).not.toHaveBeenCalled()
  })

  it('adds only the matching compatibility read when lifecycle migration 004 is pending', async () => {
    const dataSource = source()
    dataSource.loadLeague.mockResolvedValue({
      data: null,
      error: { code: '42703', message: 'column archived_at does not exist' },
    })
    dataSource.loadLegacyLeague.mockResolvedValue({
      data: {
        auto_sync_enabled: false,
        created_at: null,
        current_season: '2026',
        id: 'league-one',
        last_sync_at: null,
        last_sync_error: null,
        name: 'Gridiron Gurus',
        platform_league_id: null,
        platform_type: null,
        sync_status: null,
        updated_at: null,
      },
      error: null,
    })

    await loadLeagueShellData('league-one', dataSource)

    expect(dataSource.loadLegacyLeague).toHaveBeenCalledTimes(1)
    expect(dataSource.loadLegacySeasons).not.toHaveBeenCalled()
  })

  it('does not hide non-schema failures behind a legacy retry', async () => {
    const dataSource = source()
    dataSource.loadSeasons.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    await expect(
      loadLeagueShellData('league-one', dataSource),
    ).resolves.toMatchObject({
      seasonsResult: { error: { code: '42501' } },
    })
    expect(dataSource.loadLegacySeasons).not.toHaveBeenCalled()
  })
})
