import {
  createSeasonConfigPayload,
  createUnsavedSeasonConfig,
  DEFAULT_SEASON_CONFIG,
  normalizeSeasonConfig,
} from '@/lib/seasonConfig'
import type { LeagueSeasonRow } from '@/lib/supabase'

describe('season configuration defaults', () => {
  it('builds a persisted season payload without inventing prize money', () => {
    expect(createSeasonConfigPayload('league-1', '2026', 75)).toEqual({
      league_id: 'league-1',
      season: '2026',
      ...DEFAULT_SEASON_CONFIG,
      fee_amount: 75,
    })
  })

  it('builds an explicitly unsaved display configuration', () => {
    const config = createUnsavedSeasonConfig('league-1', '2026')

    expect(config).toMatchObject({
      id: 'unsaved',
      league_id: 'league-1',
      season: '2026',
      fee_amount: 0,
      draft_food_cost: 0,
      weekly_prize_amount: 0,
    })
  })

  it('normalizes deployed nullable and JSON fields at the view boundary', () => {
    const row: LeagueSeasonRow = {
      created_at: null,
      divisions: { divisions: ['East', 'West', 3] },
      draft_food_cost: null,
      fee_amount: 75,
      final_winners: { first: 'member-1', second: 2 },
      id: 'season-1',
      is_active: null,
      league_id: 'league-1',
      playoff_spots: null,
      playoff_start_week: 15,
      prize_structure: { first: 300, second: '100', note: 'ignored' },
      season: '2026',
      total_weeks: 17,
      updated_at: null,
      weekly_prize_amount: null,
    }

    expect(normalizeSeasonConfig(row)).toEqual({
      created_at: '',
      divisions: { divisions: ['East', 'West'] },
      draft_food_cost: 0,
      fee_amount: 75,
      final_winners: { first: 'member-1', second: null },
      id: 'season-1',
      is_active: false,
      league_id: 'league-1',
      playoff_spots: 0,
      playoff_start_week: 15,
      prize_structure: { first: 300, second: 100, third: 0 },
      season: '2026',
      total_weeks: 17,
      updated_at: '',
      weekly_prize_amount: 0,
    })
  })
})
