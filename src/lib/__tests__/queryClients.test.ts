const queries: Array<{
  eq: jest.Mock
  limit: jest.Mock
  order: jest.Mock
  select: jest.Mock
  single: jest.Mock
  table: string
}> = []

const resultByTable: Record<string, { data: unknown; error: unknown }> = {}

const mockFrom = jest.fn((table: string) => {
  const query = {
    eq: jest.fn(),
    limit: jest.fn(),
    order: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
    table,
  }
  query.eq.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.single.mockImplementation(async () => resultByTable[table])
  Object.assign(query, {
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(resultByTable[table]).then(resolve, reject),
  })
  queries.push(query)
  return query
})

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import {
  LATEST_SCORE_WEEK_COLUMNS,
  SCORE_ROSTER_COLUMNS,
  loadScoresPageData,
  supabaseScoresPageDataSource,
  type ScoresPageDataSource,
} from '@/lib/scoresClient'
import {
  SEASON_CONFIG_COLUMNS,
  supabaseSeasonConfigDataSource,
} from '@/lib/seasonConfigClient'
import {
  STANDINGS_MATCHUP_COLUMNS,
  STANDINGS_MEMBER_COLUMNS,
  STANDINGS_SCORE_COLUMNS,
  loadStandingsData,
  supabaseStandingsDataSource,
  type StandingsDataSource,
} from '@/lib/standingsClient'
import {
  WEEKLY_MATCHUP_COLUMNS,
  WEEKLY_SCORE_COLUMNS,
  loadWeeklyScoresData,
  supabaseWeeklyScoresDataSource,
  type WeeklyScoresDataSource,
} from '@/lib/weeklyScoresClient'

function queryFor(table: string) {
  const query = queries.find((candidate) => candidate.table === table)
  if (!query) throw new Error(`No query recorded for ${table}`)
  return query
}

describe('league page query contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queries.length = 0
    for (const key of Object.keys(resultByTable)) delete resultByTable[key]
    resultByTable.league_members = { data: [], error: null }
    resultByTable.league_seasons = { data: null, error: null }
    resultByTable.matchup_results_with_scores = { data: [], error: null }
    resultByTable.weekly_scores = { data: [], error: null }
  })

  it('loads season configuration once with only normalized public fields', async () => {
    await supabaseSeasonConfigDataSource.loadSeasonConfig('league-one', '2026')

    const query = queryFor('league_seasons')
    expect(query.select).toHaveBeenCalledWith(SEASON_CONFIG_COLUMNS)
    expect(query.eq).toHaveBeenNthCalledWith(1, 'league_id', 'league-one')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'season', '2026')
    expect(query.single).toHaveBeenCalledTimes(1)
    expect(SEASON_CONFIG_COLUMNS).not.toContain('archived_at')
  })

  it('loads a minimal score roster and only the newest recorded week row', async () => {
    await Promise.all([
      supabaseScoresPageDataSource.loadMembers('league-one', '2026'),
      supabaseScoresPageDataSource.loadLatestRecordedWeek('league-one', '2026'),
    ])

    const memberQuery = queryFor('league_members')
    const scoreQuery = queryFor('weekly_scores')
    expect(memberQuery.select).toHaveBeenCalledWith(SCORE_ROSTER_COLUMNS)
    expect(scoreQuery.select).toHaveBeenCalledWith(LATEST_SCORE_WEEK_COLUMNS)
    expect(scoreQuery.order).toHaveBeenCalledWith('week_number', {
      ascending: false,
    })
    expect(scoreQuery.limit).toHaveBeenCalledWith(1)
  })

  it('loads each selected week with two narrow season-scoped reads', async () => {
    await Promise.all([
      supabaseWeeklyScoresDataSource.loadScores('league-one', '2026', 4),
      supabaseWeeklyScoresDataSource.loadMatchups('league-one', '2026', 4),
    ])

    const scoreQuery = queryFor('weekly_scores')
    const matchupQuery = queryFor('matchup_results_with_scores')
    expect(scoreQuery.select).toHaveBeenCalledWith(WEEKLY_SCORE_COLUMNS)
    expect(matchupQuery.select).toHaveBeenCalledWith(WEEKLY_MATCHUP_COLUMNS)
    expect(scoreQuery.eq).toHaveBeenCalledWith('week_number', 4)
    expect(matchupQuery.eq).toHaveBeenCalledWith('week_number', 4)
  })

  it('loads standings with three narrow season-scoped reads', async () => {
    await Promise.all([
      supabaseStandingsDataSource.loadMembers('league-one', '2026'),
      supabaseStandingsDataSource.loadScores('league-one', '2026'),
      supabaseStandingsDataSource.loadMatchups('league-one', '2026'),
    ])

    expect(queryFor('league_members').select).toHaveBeenCalledWith(
      STANDINGS_MEMBER_COLUMNS,
    )
    expect(queryFor('weekly_scores').select).toHaveBeenCalledWith(
      STANDINGS_SCORE_COLUMNS,
    )
    expect(
      queryFor('matchup_results_with_scores').select,
    ).toHaveBeenCalledWith(STANDINGS_MATCHUP_COLUMNS)
  })
})

describe('league page fixed request plans', () => {
  it('uses exactly two Scores page reads and resolves the ordered latest row', async () => {
    const source: jest.Mocked<ScoresPageDataSource> = {
      loadLatestRecordedWeek: jest.fn().mockResolvedValue({
        data: [{ week_number: 9 }],
        error: null,
      }),
      loadMembers: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    await expect(
      loadScoresPageData('league-one', '2026', source),
    ).resolves.toMatchObject({ latestRecordedWeek: 9 })
    expect(source.loadMembers).toHaveBeenCalledTimes(1)
    expect(source.loadLatestRecordedWeek).toHaveBeenCalledTimes(1)
  })

  it('uses exactly two weekly reads and fails closed on either required result', async () => {
    const source: jest.Mocked<WeeklyScoresDataSource> = {
      loadMatchups: jest.fn().mockResolvedValue({ data: [], error: null }),
      loadScores: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    await loadWeeklyScoresData('league-one', '2026', 3, source)
    expect(source.loadScores).toHaveBeenCalledWith('league-one', '2026', 3)
    expect(source.loadMatchups).toHaveBeenCalledWith('league-one', '2026', 3)

    source.loadMatchups.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })
    await expect(
      loadWeeklyScoresData('league-one', '2026', 3, source),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('uses exactly three standings reads and rejects incomplete inputs', async () => {
    const source: jest.Mocked<StandingsDataSource> = {
      loadMatchups: jest.fn().mockResolvedValue({ data: [], error: null }),
      loadMembers: jest.fn().mockResolvedValue({ data: [], error: null }),
      loadScores: jest.fn().mockResolvedValue({ data: [], error: null }),
    }

    await loadStandingsData('league-one', '2026', source)
    for (const loader of [
      source.loadMembers,
      source.loadScores,
      source.loadMatchups,
    ]) {
      expect(loader).toHaveBeenCalledTimes(1)
      expect(loader).toHaveBeenCalledWith('league-one', '2026')
    }

    source.loadScores.mockResolvedValue({
      data: null,
      error: { message: 'scores unavailable' },
    })
    await expect(
      loadStandingsData('league-one', '2026', source),
    ).rejects.toMatchObject({ message: 'scores unavailable' })
  })
})
