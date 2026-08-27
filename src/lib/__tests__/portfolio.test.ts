import { buildPortfolioLeagues, summarizePortfolio } from '@/lib/portfolio'
import type { League, LeagueSeason } from '@/lib/supabase'

function league(overrides: Partial<League> = {}): League {
  return {
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
    ...overrides,
  }
}

function season(overrides: Partial<LeagueSeason> = {}): LeagueSeason {
  return {
    created_at: '',
    divisions: null,
    draft_food_cost: 20,
    fee_amount: 100,
    final_winners: null,
    id: 'season-one',
    is_active: true,
    league_id: 'league-one',
    playoff_spots: 6,
    playoff_start_week: 15,
    prize_structure: { first: 180, second: 100, third: 50 },
    season: '2026',
    total_weeks: 17,
    updated_at: '',
    weekly_prize_amount: 10,
    ...overrides,
  }
}

describe('portfolio view model', () => {
  it('indexes current-season dues, scores, and allocation without mixing history', () => {
    const result = buildPortfolioLeagues({
      leagues: [league()],
      members: [
        { is_active: true, league_id: 'league-one', payment_status: 'paid', season: '2026' },
        { is_active: true, league_id: 'league-one', payment_status: 'pending', season: '2026' },
        { is_active: true, league_id: 'league-one', payment_status: 'paid', season: '2025' },
        { is_active: false, league_id: 'league-one', payment_status: 'paid', season: '2026' },
      ],
      scores: [
        { is_final_score: false, league_id: 'league-one', points: 110, season: '2026', week_number: 3, week_status: 'completed' },
        { is_final_score: false, league_id: 'league-one', points: 0, season: '2026', week_number: 4, week_status: 'pending' },
        { is_final_score: true, league_id: 'league-one', points: 0, season: '2025', week_number: 17, week_status: 'completed' },
      ],
      seasons: [season(), season({ id: 'old-season', season: '2025' })],
    })

    expect(result[0]).toMatchObject({
      collectedAmount: 100,
      expectedAmount: 200,
      latestWeek: 3,
      paidMembers: 1,
      pendingMembers: 1,
      totalMembers: 2,
      totalWeeks: 17,
    })
    expect(result[0].attentionReasons).toContain('1 player has dues pending')
    expect(result[0].attentionReasons).toContain(
      'Prizes exceed the pool by $320',
    )
  })

  it('keeps missing configuration and sync failure actionable', () => {
    const [result] = buildPortfolioLeagues({
      leagues: [league({ sync_status: 'error' })],
      members: [],
      scores: [],
      seasons: [],
    })

    expect(result.attentionReasons).toEqual([
      'Season configuration is missing',
      'The last score sync failed',
    ])
  })

  it('excludes archived leagues from active portfolio totals', () => {
    const active = buildPortfolioLeagues({
      leagues: [league()],
      members: [
        { is_active: true, league_id: 'league-one', payment_status: 'paid', season: '2026' },
      ],
      scores: [],
      seasons: [season()],
    })[0]
    const archived = {
      ...active,
      archived_at: '2026-08-25T00:00:00.000Z',
      id: 'league-archived',
    }

    expect(summarizePortfolio([active, archived])).toEqual({
      activeLeagueCount: 1,
      attentionCount: 1,
      collectedAmount: 100,
      totalPlayers: 1,
    })
  })
})
