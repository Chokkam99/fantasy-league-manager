import type { WeeklyScoreRow } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { loadLeagueView } from '@/lib/leagueReadClient'

export const WEEKLY_SCORE_COLUMNS = 'member_id, points'
export const WEEKLY_MATCHUP_COLUMNS =
  'id, is_tie, team1_member_id, team1_score, team2_member_id, team2_score, winner_member_id'

export type WeeklyScoreSummary = Pick<
  WeeklyScoreRow,
  'member_id' | 'points'
>

export interface WeeklyMatchupSummary {
  id: string
  is_tie: boolean
  team1_member_id: string
  team1_score: number | null
  team2_member_id: string
  team2_score: number | null
  winner_member_id: string | null
}

interface WeeklyQueryError {
  code?: string
  message?: string
}

interface WeeklyQueryResult<T> {
  data: T[] | null
  error: WeeklyQueryError | null
}

export interface WeeklyScoresDataSource {
  loadMatchups(
    leagueId: string,
    season: string,
    week: number,
  ): Promise<WeeklyQueryResult<WeeklyMatchupSummary>>
  loadScores(
    leagueId: string,
    season: string,
    week: number,
  ): Promise<WeeklyQueryResult<WeeklyScoreSummary>>
}

export interface WeeklyScoresSnapshot {
  matchups: WeeklyMatchupSummary[]
  scores: WeeklyScoreSummary[]
}

export const supabaseWeeklyScoresDataSource: WeeklyScoresDataSource = {
  async loadMatchups(leagueId, season, week) {
    const result = await supabase
      .from('matchup_results_with_scores')
      .select(WEEKLY_MATCHUP_COLUMNS)
      .eq('league_id', leagueId)
      .eq('week_number', week)
      .eq('season', season)
    return result as WeeklyQueryResult<WeeklyMatchupSummary>
  },
  async loadScores(leagueId, season, week) {
    const result = await supabase
      .from('weekly_scores')
      .select(WEEKLY_SCORE_COLUMNS)
      .eq('league_id', leagueId)
      .eq('week_number', week)
      .eq('season', season)
    return result as WeeklyQueryResult<WeeklyScoreSummary>
  },
}

export async function loadWeeklyScoresData(
  leagueId: string,
  season: string,
  week: number,
  source?: WeeklyScoresDataSource,
): Promise<WeeklyScoresSnapshot> {
  if (!source && typeof fetch === 'undefined') {
    source = supabaseWeeklyScoresDataSource
  }
  if (!source) {
    return loadLeagueView<WeeklyScoresSnapshot>(leagueId, 'week', {
      season,
      week,
    })
  }

  const [scoresResult, matchupsResult] = await Promise.all([
    source.loadScores(leagueId, season, week),
    source.loadMatchups(leagueId, season, week),
  ])

  if (scoresResult.error) throw scoresResult.error
  if (matchupsResult.error) throw matchupsResult.error

  return {
    matchups: matchupsResult.data || [],
    scores: scoresResult.data || [],
  }
}
