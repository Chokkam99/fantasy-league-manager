import { loadFinanceSnapshot, type FinanceSnapshot } from '@/lib/financeClient'
import type {
  OverviewMatchup,
  OverviewMember,
  OverviewScore,
} from '@/lib/overview'
import { supabase } from '@/lib/supabase'
import { loadLeagueView } from '@/lib/leagueReadClient'

interface OverviewQueryError {
  code?: string
  message?: string
}

interface OverviewQueryResult<T> {
  data: T[] | null
  error: OverviewQueryError | null
}

export interface OverviewDataSource {
  loadFinance(leagueId: string, season: string): Promise<FinanceSnapshot>
  loadMatchups(
    leagueId: string,
    season: string,
  ): Promise<OverviewQueryResult<OverviewMatchup>>
  loadMembers(
    leagueId: string,
    season: string,
  ): Promise<OverviewQueryResult<OverviewMember>>
  loadScores(
    leagueId: string,
    season: string,
  ): Promise<OverviewQueryResult<OverviewScore>>
}

export interface OverviewDataSnapshot {
  finance: FinanceSnapshot | null
  financeError: string | null
  matchups: OverviewMatchup[]
  members: OverviewMember[]
  scores: OverviewScore[]
  standingsError: string | null
}

export const supabaseOverviewDataSource: OverviewDataSource = {
  loadFinance: loadFinanceSnapshot,
  async loadMatchups(leagueId, season) {
    const result = await supabase
      .from('matchup_results_with_scores')
      .select(
        'is_tie, team1_member_id, team1_score, team2_member_id, team2_score, week_number, winner_member_id',
      )
      .eq('league_id', leagueId)
      .eq('season', season)
    return result as OverviewQueryResult<OverviewMatchup>
  },
  async loadMembers(leagueId, season) {
    const result = await supabase
      .from('league_members')
      .select('id, manager_name, team_name, payment_status, division')
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('is_active', true)
    return result as OverviewQueryResult<OverviewMember>
  },
  async loadScores(leagueId, season) {
    const result = await supabase
      .from('weekly_scores')
      .select('member_id, week_number, points, is_final_score, week_status')
      .eq('league_id', leagueId)
      .eq('season', season)
    return result as OverviewQueryResult<OverviewScore>
  },
}

export async function loadOverviewData(
  leagueId: string,
  season: string,
  source?: OverviewDataSource,
): Promise<OverviewDataSnapshot> {
  if (!source) {
    const [payload, financeResult] = await Promise.all([
      loadLeagueView<{
        matchups: OverviewMatchup[]
        members: OverviewMember[]
        scores: OverviewScore[]
      }>(leagueId, 'overview', { season }),
      loadFinanceSnapshot(leagueId, season)
        .then((finance) => ({ finance, financeError: null }))
        .catch((error: unknown) => ({
          finance: null,
          financeError:
            error instanceof Error
              ? error.message
              : 'Detailed dues could not be loaded.',
        })),
    ])
    return {
      finance: financeResult.finance,
      financeError: financeResult.financeError,
      matchups: payload.matchups,
      members: payload.members,
      scores: payload.scores,
      standingsError: null,
    }
  }

  const [membersResult, scoresResult, matchupsResult, financeResult] =
    await Promise.all([
      source.loadMembers(leagueId, season),
      source.loadScores(leagueId, season),
      source.loadMatchups(leagueId, season),
      source
        .loadFinance(leagueId, season)
        .then((finance) => ({ finance, financeError: null }))
        .catch((error: unknown) => ({
          finance: null,
          financeError:
            error instanceof Error
              ? error.message
              : 'Detailed dues could not be loaded.',
        })),
    ])

  const dataError = membersResult.error || scoresResult.error
  if (dataError) throw dataError

  return {
    finance: financeResult.finance,
    financeError: financeResult.financeError,
    matchups: matchupsResult.data || [],
    members: membersResult.data || [],
    scores: scoresResult.data || [],
    standingsError: matchupsResult.error
      ? matchupsResult.error.message || 'Standings could not be loaded.'
      : null,
  }
}
