import { isMissingFinanceSchema } from '@/lib/finance'
import { isMissingLifecycleSchema } from '@/lib/lifecycle'
import { hasConfiguredLeagueSeason } from '@/lib/leagueSeason'
import {
  buildPortfolioLeagues,
  type PortfolioLeague,
  type PortfolioMemberRow,
  type PortfolioPaymentRow,
  type PortfolioScoreRow,
} from '@/lib/portfolio'
import {
  PUBLIC_LEAGUE_COLUMNS,
  PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE,
} from '@/lib/publicLeague'
import { normalizeSeasonConfig } from '@/lib/seasonConfig'
import {
  supabase,
  type League,
  type LeagueSeasonRow,
} from '@/lib/supabase'

interface PortfolioQueryError {
  code?: string
  message?: string
}

interface PortfolioQueryResult<T> {
  data: T[] | null
  error: PortfolioQueryError | null
}

export interface PortfolioDataSource {
  loadPayments?(leagueIds: string[], seasons: string[]): Promise<PortfolioQueryResult<PortfolioPaymentRow>>
  loadLegacyLeagues(): Promise<PortfolioQueryResult<League>>
  loadLifecycleLeagues(): Promise<PortfolioQueryResult<League>>
  loadMembers(
    leagueIds: string[],
    seasons: string[],
  ): Promise<PortfolioQueryResult<PortfolioMemberRow>>
  loadScores(
    leagueIds: string[],
    seasons: string[],
  ): Promise<PortfolioQueryResult<PortfolioScoreRow>>
  loadSeasons(
    leagueIds: string[],
    seasons: string[],
  ): Promise<PortfolioQueryResult<LeagueSeasonRow>>
}

export const supabasePortfolioDataSource: PortfolioDataSource = {
  async loadPayments(leagueIds, seasons) {
    return supabase.from('season_payments')
      .select('league_id, season, league_member_id, expected_amount_cents, paid_amount_cents, status')
      .in('league_id', leagueIds).in('season', seasons)
  },
  async loadLegacyLeagues() {
    const result = await supabase
      .from('leagues')
      .select(PUBLIC_LEAGUE_COLUMNS)
      .order('created_at', { ascending: false })
    return result as PortfolioQueryResult<League>
  },
  async loadLifecycleLeagues() {
    const result = await supabase
      .from('leagues')
      .select(PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE)
      .order('created_at', { ascending: false })
    return result as PortfolioQueryResult<League>
  },
  async loadMembers(leagueIds, seasons) {
    return supabase
      .from('league_members')
      .select('id, manager_name, league_id, season, payment_status, is_active')
      .in('league_id', leagueIds)
      .in('season', seasons)
  },
  async loadScores(leagueIds, seasons) {
    return supabase
      .from('weekly_scores')
      .select(
        'league_id, season, week_number, points, week_status, is_final_score',
      )
      .in('league_id', leagueIds)
      .in('season', seasons)
  },
  async loadSeasons(leagueIds, seasons) {
    return supabase
      .from('league_seasons')
      .select('*')
      .in('league_id', leagueIds)
      .in('season', seasons)
  },
}

export async function loadPortfolioLeagues(
  source: PortfolioDataSource = supabasePortfolioDataSource,
): Promise<PortfolioLeague[]> {
  const lifecycleResult = await source.loadLifecycleLeagues()
  const leagueResult =
    lifecycleResult.error && isMissingLifecycleSchema(lifecycleResult.error)
      ? await source.loadLegacyLeagues()
      : lifecycleResult

  if (leagueResult.error) throw leagueResult.error

  const leagues = (leagueResult.data || []).filter(hasConfiguredLeagueSeason)
  if (leagues.length === 0) return []

  const leagueIds = leagues.map((league) => league.id)
  const currentSeasons = [...new Set(leagues.map((league) => league.current_season))]
  const [seasonsResult, membersResult, scoresResult, paymentsResult] = await Promise.all([
    source.loadSeasons(leagueIds, currentSeasons),
    source.loadMembers(leagueIds, currentSeasons),
    source.loadScores(leagueIds, currentSeasons),
    source.loadPayments?.(leagueIds, currentSeasons) ?? Promise.resolve({ data: [], error: null }),
  ])
  const queryError =
    seasonsResult.error || membersResult.error || scoresResult.error
  if (queryError) throw queryError
  if (paymentsResult.error && !isMissingFinanceSchema(paymentsResult.error)) throw paymentsResult.error

  return buildPortfolioLeagues({
    leagues,
    payments: paymentsResult.data || [],
    members: membersResult.data || [],
    scores: scoresResult.data || [],
    seasons: (seasonsResult.data || []).map(normalizeSeasonConfig),
  })
}

export async function loadCommissionerPortfolio(): Promise<PortfolioLeague[]> {
  const response = await fetch('/api/leagues')
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === 'string'
        ? payload.error
        : 'The league portfolio could not be loaded.',
    )
  }
  return payload.leagues as PortfolioLeague[]
}
