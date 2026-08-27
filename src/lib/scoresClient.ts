import type { LeagueMemberRow } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { getLatestRecordedWeek } from '@/lib/weeklyRanking'
import { loadLeagueView } from '@/lib/leagueReadClient'

export const SCORE_ROSTER_COLUMNS =
  'id, manager_name, team_name, season'
export const LATEST_SCORE_WEEK_COLUMNS = 'week_number'

export type ScoreRosterMember = Pick<
  LeagueMemberRow,
  'id' | 'manager_name' | 'season' | 'team_name'
>

interface ScoresQueryError {
  code?: string
  message?: string
}

interface ScoresQueryResult<T> {
  data: T[] | null
  error: ScoresQueryError | null
}

export interface ScoresPageDataSource {
  loadLatestRecordedWeek(
    leagueId: string,
    season: string,
  ): Promise<ScoresQueryResult<{ week_number: number }>>
  loadMembers(
    leagueId: string,
    season: string,
  ): Promise<ScoresQueryResult<ScoreRosterMember>>
}

export interface ScoresPageSnapshot {
  latestRecordedWeek: number
  members: ScoreRosterMember[]
}

export const supabaseScoresPageDataSource: ScoresPageDataSource = {
  async loadLatestRecordedWeek(leagueId, season) {
    const result = await supabase
      .from('weekly_scores')
      .select(LATEST_SCORE_WEEK_COLUMNS)
      .eq('league_id', leagueId)
      .eq('season', season)
      .order('week_number', { ascending: false })
      .limit(1)
    return result as ScoresQueryResult<{ week_number: number }>
  },
  async loadMembers(leagueId, season) {
    const result = await supabase
      .from('league_members')
      .select(SCORE_ROSTER_COLUMNS)
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
    return result as ScoresQueryResult<ScoreRosterMember>
  },
}

export async function loadScoresPageData(
  leagueId: string,
  season: string,
  source?: ScoresPageDataSource,
): Promise<ScoresPageSnapshot> {
  if (!source) {
    const payload = await loadLeagueView<{
      latest: Array<{ week_number: number }>
      members: ScoreRosterMember[]
    }>(leagueId, 'scores', { season })
    return {
      latestRecordedWeek: getLatestRecordedWeek(payload.latest),
      members: payload.members,
    }
  }

  const [membersResult, latestWeekResult] = await Promise.all([
    source.loadMembers(leagueId, season),
    source.loadLatestRecordedWeek(leagueId, season),
  ])
  const error = membersResult.error || latestWeekResult.error
  if (error) throw error

  return {
    latestRecordedWeek: getLatestRecordedWeek(latestWeekResult.data || []),
    members: membersResult.data || [],
  }
}
