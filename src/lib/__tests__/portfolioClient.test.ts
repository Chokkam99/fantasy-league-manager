import {
  loadPortfolioLeagues,
  type PortfolioDataSource,
} from '@/lib/portfolioClient'
import type { League, LeagueSeasonRow } from '@/lib/supabase'

const configuredLeagues: League[] = [
  {
    archived_at: null,
    auto_sync_enabled: false,
    created_at: null,
    current_season: '2026',
    id: 'league-one',
    last_sync_at: null,
    last_sync_error: null,
    name: 'League One',
    platform_league_id: null,
    platform_type: 'manual',
    sync_status: 'active',
    updated_at: null,
  },
  {
    archived_at: null,
    auto_sync_enabled: false,
    created_at: null,
    current_season: '2027',
    id: 'league-two',
    last_sync_at: null,
    last_sync_error: null,
    name: 'League Two',
    platform_league_id: null,
    platform_type: 'manual',
    sync_status: 'active',
    updated_at: null,
  },
]

function seasonRow(leagueId: string, season: string): LeagueSeasonRow {
  return {
    archived_at: null,
    created_at: null,
    divisions: null,
    draft_food_cost: 0,
    fee_amount: 100,
    final_winners: null,
    id: `${leagueId}-${season}`,
    is_active: true,
    league_id: leagueId,
    playoff_spots: 6,
    playoff_start_week: 15,
    prize_structure: { first: 100 },
    season,
    total_weeks: 17,
    updated_at: null,
    weekly_prize_amount: 0,
  }
}

function dataSource(
  leagueResult: Awaited<ReturnType<PortfolioDataSource['loadLifecycleLeagues']>> = {
    data: configuredLeagues,
    error: null,
  },
): jest.Mocked<PortfolioDataSource> {
  return {
    loadLegacyLeagues: jest.fn().mockResolvedValue({ data: configuredLeagues, error: null }),
    loadLifecycleLeagues: jest.fn().mockResolvedValue(leagueResult),
    loadMembers: jest.fn().mockResolvedValue({ data: [], error: null }),
    loadScores: jest.fn().mockResolvedValue({ data: [], error: null }),
    loadSeasons: jest.fn().mockResolvedValue({
      data: [seasonRow('league-one', '2026'), seasonRow('league-two', '2027')],
      error: null,
    }),
  }
}

describe('portfolio query plan', () => {
  it('uses four batched reads regardless of league count and scopes details to current seasons', async () => {
    const source = dataSource()

    await expect(loadPortfolioLeagues(source)).resolves.toHaveLength(2)
    expect(source.loadLifecycleLeagues).toHaveBeenCalledTimes(1)
    expect(source.loadLegacyLeagues).not.toHaveBeenCalled()
    for (const detailLoader of [
      source.loadSeasons,
      source.loadMembers,
      source.loadScores,
    ]) {
      expect(detailLoader).toHaveBeenCalledTimes(1)
      expect(detailLoader).toHaveBeenCalledWith(
        ['league-one', 'league-two'],
        ['2026', '2027'],
      )
    }
  })

  it('adds only one compatibility read while lifecycle migration 004 is pending', async () => {
    const source = dataSource({
      data: null,
      error: { code: '42703', message: 'column archived_at does not exist' },
    })

    await expect(loadPortfolioLeagues(source)).resolves.toHaveLength(2)
    expect(source.loadLifecycleLeagues).toHaveBeenCalledTimes(1)
    expect(source.loadLegacyLeagues).toHaveBeenCalledTimes(1)
    expect(source.loadSeasons).toHaveBeenCalledTimes(1)
    expect(source.loadMembers).toHaveBeenCalledTimes(1)
    expect(source.loadScores).toHaveBeenCalledTimes(1)
  })

  it('does not run detail reads for an empty portfolio', async () => {
    const source = dataSource({ data: [], error: null })

    await expect(loadPortfolioLeagues(source)).resolves.toEqual([])
    expect(source.loadSeasons).not.toHaveBeenCalled()
    expect(source.loadMembers).not.toHaveBeenCalled()
    expect(source.loadScores).not.toHaveBeenCalled()
  })

  it('does not hide non-lifecycle database failures', async () => {
    const source = dataSource({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    await expect(loadPortfolioLeagues(source)).rejects.toMatchObject({
      code: '42501',
    })
    expect(source.loadLegacyLeagues).not.toHaveBeenCalled()
  })
})
