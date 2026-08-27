import type {
  StandingsMatchup,
  StandingsMember,
  StandingsScore,
} from '@/lib/standings'
import { supabase } from '@/lib/supabase'
import { loadLeagueView } from '@/lib/leagueReadClient'

export const STANDINGS_MEMBER_COLUMNS =
  'id, manager_name, team_name, division'
export const STANDINGS_SCORE_COLUMNS = 'member_id, points, week_number'
export const STANDINGS_MATCHUP_COLUMNS =
  'is_tie, team1_member_id, team1_score, team2_member_id, team2_score, week_number, winner_member_id'

interface StandingsQueryError {
  code?: string
  message?: string
}

interface StandingsQueryResult<T> {
  data: T[] | null
  error: StandingsQueryError | null
}

export interface StandingsDataSource {
  loadMatchups(
    leagueId: string,
    season: string,
  ): Promise<StandingsQueryResult<StandingsMatchup>>
  loadMembers(
    leagueId: string,
    season: string,
  ): Promise<StandingsQueryResult<StandingsMember>>
  loadScores(
    leagueId: string,
    season: string,
  ): Promise<StandingsQueryResult<StandingsScore>>
}

export interface StandingsSnapshot {
  matchups: StandingsMatchup[]
  members: StandingsMember[]
  scores: StandingsScore[]
}

export const supabaseStandingsDataSource: StandingsDataSource = {
  async loadMatchups(leagueId, season) {
    const result = await supabase
      .from('matchup_results_with_scores')
      .select(STANDINGS_MATCHUP_COLUMNS)
      .eq('league_id', leagueId)
      .eq('season', season)
    return result as StandingsQueryResult<StandingsMatchup>
  },
  async loadMembers(leagueId, season) {
    const result = await supabase
      .from('league_members')
      .select(STANDINGS_MEMBER_COLUMNS)
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('is_active', true)
    return result as StandingsQueryResult<StandingsMember>
  },
  async loadScores(leagueId, season) {
    const result = await supabase
      .from('weekly_scores')
      .select(STANDINGS_SCORE_COLUMNS)
      .eq('league_id', leagueId)
      .eq('season', season)
    return result as StandingsQueryResult<StandingsScore>
  },
}

export async function loadStandingsData(
  leagueId: string,
  season: string,
  source?: StandingsDataSource,
): Promise<StandingsSnapshot> {
  if (!source) {
    return loadLeagueView<StandingsSnapshot>(leagueId, 'standings', { season })
  }

  const [membersResult, scoresResult, matchupsResult] = await Promise.all([
    source.loadMembers(leagueId, season),
    source.loadScores(leagueId, season),
    source.loadMatchups(leagueId, season),
  ])
  const error = membersResult.error || scoresResult.error || matchupsResult.error
  if (error) throw error

  return {
    matchups: matchupsResult.data || [],
    members: membersResult.data || [],
    scores: scoresResult.data || [],
  }
}
