import { loadFinanceSnapshot, type FinanceSnapshot } from '@/lib/financeClient'
import type { PrizeMember, PrizeScore } from '@/lib/prizes'
import { supabase } from '@/lib/supabase'
import { loadLeagueView } from '@/lib/leagueReadClient'

interface PrizeQueryError {
  code?: string
  message?: string
}

interface PrizeQueryResult<T> {
  data: T[] | null
  error: PrizeQueryError | null
}

export interface PrizeDataSource {
  loadFinance(leagueId: string, season: string): Promise<FinanceSnapshot>
  loadMembers(
    leagueId: string,
    season: string,
  ): Promise<PrizeQueryResult<PrizeMember>>
  loadScores(
    leagueId: string,
    season: string,
  ): Promise<PrizeQueryResult<PrizeScore>>
}

export interface PrizeDataSnapshot {
  finance: FinanceSnapshot | null
  financeError: string | null
  members: PrizeMember[]
  scores: PrizeScore[]
}

export const supabasePrizeDataSource: PrizeDataSource = {
  loadFinance: loadFinanceSnapshot,
  async loadMembers(leagueId, season) {
    const result = await supabase
      .from('league_members')
      .select('id, manager_name, team_name, payment_status')
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('is_active', true)
      .order('manager_name')
    return result as PrizeQueryResult<PrizeMember>
  },
  async loadScores(leagueId, season) {
    const result = await supabase
      .from('weekly_scores')
      .select('member_id, week_number, points, is_final_score, week_status')
      .eq('league_id', leagueId)
      .eq('season', season)
      .order('week_number', { ascending: false })
    return result as PrizeQueryResult<PrizeScore>
  },
}

export async function loadPrizeData(
  leagueId: string,
  season: string,
  source?: PrizeDataSource,
): Promise<PrizeDataSnapshot> {
  if (!source) {
    const [payload, financeResult] = await Promise.all([
      loadLeagueView<{ members: PrizeMember[]; scores: PrizeScore[] }>(
        leagueId,
        'prizes',
        { season },
      ),
      loadFinanceSnapshot(leagueId, season)
        .then((finance) => ({ finance, financeError: null }))
        .catch((error: unknown) => ({
          finance: null,
          financeError:
            error instanceof Error
              ? error.message
              : 'Payout details could not be loaded.',
        })),
    ])
    return {
      finance: financeResult.finance,
      financeError: financeResult.financeError,
      members: payload.members,
      scores: payload.scores,
    }
  }

  const [membersResult, scoresResult, financeResult] = await Promise.all([
    source.loadMembers(leagueId, season),
    source.loadScores(leagueId, season),
    source
      .loadFinance(leagueId, season)
      .then((finance) => ({ finance, financeError: null }))
      .catch((error: unknown) => ({
        finance: null,
        financeError:
          error instanceof Error
            ? error.message
            : 'Payout details could not be loaded.',
      })),
  ])

  const dataError = membersResult.error || scoresResult.error
  if (dataError) throw dataError

  return {
    finance: financeResult.finance,
    financeError: financeResult.financeError,
    members: membersResult.data || [],
    scores: scoresResult.data || [],
  }
}
