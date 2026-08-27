import type { LeagueSeasonRow } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { loadLeagueView } from '@/lib/leagueReadClient'

export const SEASON_CONFIG_COLUMNS = [
  'created_at',
  'divisions',
  'draft_food_cost',
  'fee_amount',
  'final_winners',
  'id',
  'is_active',
  'league_id',
  'playoff_spots',
  'playoff_start_week',
  'prize_structure',
  'season',
  'total_weeks',
  'updated_at',
  'weekly_prize_amount',
].join(', ')

export type SeasonConfigRecord = Omit<LeagueSeasonRow, 'archived_at'>

export interface SeasonConfigQueryError {
  code?: string
  message?: string
}

export interface SeasonConfigQueryResult {
  data: SeasonConfigRecord | null
  error: SeasonConfigQueryError | null
}

export interface SeasonConfigDataSource {
  loadSeasonConfig(
    leagueId: string,
    season: string,
  ): Promise<SeasonConfigQueryResult>
}

export const supabaseSeasonConfigDataSource: SeasonConfigDataSource = {
  async loadSeasonConfig(leagueId, season) {
    const result = await supabase
      .from('league_seasons')
      .select(SEASON_CONFIG_COLUMNS)
      .eq('league_id', leagueId)
      .eq('season', season)
      .single()

    return result as unknown as SeasonConfigQueryResult
  },
}

export function loadSeasonConfigRecord(
  leagueId: string,
  season: string,
  source?: SeasonConfigDataSource,
) {
  if (!source && typeof fetch === 'undefined') {
    source = supabaseSeasonConfigDataSource
  }
  if (source) return source.loadSeasonConfig(leagueId, season)
  return loadLeagueView<{ data: SeasonConfigRecord | null }>(
    leagueId,
    'season',
    { season },
  ).then((payload) => ({ data: payload.data, error: null }))
}
