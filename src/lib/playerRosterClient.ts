import { loadFinanceSnapshot, type FinanceSnapshot } from '@/lib/financeClient'
import { isMissingManagerIdentitySchema } from '@/lib/managerIdentity'
import type { PlayerMembership } from '@/lib/players'
import { supabase } from '@/lib/supabase'
import { loadLeagueView } from '@/lib/leagueReadClient'

interface PlayerQueryError {
  code?: string
  message?: string
}

interface PlayerQueryResult {
  data: PlayerMembership[] | null
  error: PlayerQueryError | null
}

export interface PlayerRosterDataSource {
  loadCanonicalMemberships(leagueId: string): Promise<PlayerQueryResult>
  loadFinance(leagueId: string, season: string): Promise<FinanceSnapshot>
  loadLegacyMemberships(leagueId: string): Promise<PlayerQueryResult>
}

export interface PlayerRosterSnapshot {
  finance: FinanceSnapshot | null
  financeError: string | null
  memberships: PlayerMembership[]
}

export const supabasePlayerRosterDataSource: PlayerRosterDataSource = {
  async loadCanonicalMemberships(leagueId) {
    const result = await supabase
      .from('league_members')
      .select(
        'id, manager_id, manager_name, team_name, payment_status, season, is_active, division',
      )
      .eq('league_id', leagueId)
    return result as unknown as PlayerQueryResult
  },
  loadFinance: loadFinanceSnapshot,
  async loadLegacyMemberships(leagueId) {
    const result = await supabase
      .from('league_members')
      .select(
        'id, manager_name, team_name, payment_status, season, is_active, division',
      )
      .eq('league_id', leagueId)
    return result as unknown as PlayerQueryResult
  },
}

export async function loadPlayerRoster(
  leagueId: string,
  season: string,
  source?: PlayerRosterDataSource,
): Promise<PlayerRosterSnapshot> {
  if (!source) {
    const [payload, financeResult] = await Promise.all([
      loadLeagueView<{ data: PlayerMembership[] }>(
        leagueId,
        'memberships',
        { season },
      ),
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
      memberships: payload.data,
    }
  }

  const [canonicalResult, financeResult] = await Promise.all([
    source.loadCanonicalMemberships(leagueId),
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
  const membershipResult =
    canonicalResult.error && isMissingManagerIdentitySchema(canonicalResult.error)
      ? await source.loadLegacyMemberships(leagueId)
      : canonicalResult

  if (membershipResult.error) throw membershipResult.error

  return {
    finance: financeResult.finance,
    financeError: financeResult.financeError,
    memberships: membershipResult.data || [],
  }
}
