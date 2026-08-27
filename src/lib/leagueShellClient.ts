import { isMissingLifecycleSchema } from '@/lib/lifecycle'
import {
  PUBLIC_LEAGUE_COLUMNS,
  PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE,
} from '@/lib/publicLeague'
import { supabase, type League } from '@/lib/supabase'
import { loadLeagueView } from '@/lib/leagueReadClient'

export const LEAGUE_SHELL_SEASON_COLUMNS = 'season, archived_at'
export const LEAGUE_SHELL_LEGACY_SEASON_COLUMNS = 'season'

export interface LeagueShellSeasonRecord {
  archived_at?: string | null
  season: string
}

interface LeagueShellQueryError {
  code?: string
  message?: string
}

interface LeagueShellLeagueResult {
  data: League | null
  error: LeagueShellQueryError | null
}

interface LeagueShellSeasonsResult {
  data: LeagueShellSeasonRecord[] | null
  error: LeagueShellQueryError | null
}

export interface LeagueShellDataSource {
  loadLeague(leagueId: string): Promise<LeagueShellLeagueResult>
  loadLegacyLeague(leagueId: string): Promise<LeagueShellLeagueResult>
  loadLegacySeasons(leagueId: string): Promise<LeagueShellSeasonsResult>
  loadSeasons(leagueId: string): Promise<LeagueShellSeasonsResult>
}

export interface LeagueShellSnapshot {
  leagueResult: LeagueShellLeagueResult
  seasonsResult: LeagueShellSeasonsResult
}

export const supabaseLeagueShellDataSource: LeagueShellDataSource = {
  async loadLeague(leagueId) {
    const result = await supabase
      .from('leagues')
      .select(PUBLIC_LEAGUE_COLUMNS_WITH_LIFECYCLE)
      .eq('id', leagueId)
      .single()
    return result as unknown as LeagueShellLeagueResult
  },
  async loadLegacyLeague(leagueId) {
    const result = await supabase
      .from('leagues')
      .select(PUBLIC_LEAGUE_COLUMNS)
      .eq('id', leagueId)
      .single()
    return result as unknown as LeagueShellLeagueResult
  },
  async loadLegacySeasons(leagueId) {
    const result = await supabase
      .from('league_seasons')
      .select(LEAGUE_SHELL_LEGACY_SEASON_COLUMNS)
      .eq('league_id', leagueId)
    return result as unknown as LeagueShellSeasonsResult
  },
  async loadSeasons(leagueId) {
    const result = await supabase
      .from('league_seasons')
      .select(LEAGUE_SHELL_SEASON_COLUMNS)
      .eq('league_id', leagueId)
    return result as unknown as LeagueShellSeasonsResult
  },
}

export async function loadLeagueShellData(
  leagueId: string,
  source?: LeagueShellDataSource,
  requestScope?: { season?: string; shareToken?: string },
): Promise<LeagueShellSnapshot> {
  if (!source) {
    try {
      const payload = await loadLeagueView<{
        league: League | null
        seasons: LeagueShellSeasonRecord[]
      }>(leagueId, 'shell', {
        season: requestScope?.season ||
          (typeof window === 'undefined'
            ? undefined
            : new URLSearchParams(window.location.search).get('season') || undefined),
        shareToken: requestScope?.shareToken,
      })
      return {
        leagueResult: { data: payload.league, error: null },
        seasonsResult: { data: payload.seasons, error: null },
      }
    } catch (error) {
      const queryError = {
        message: error instanceof Error ? error.message : 'The league could not be loaded.',
      }
      return {
        leagueResult: { data: null, error: queryError },
        seasonsResult: { data: null, error: queryError },
      }
    }
  }

  const [lifecycleLeagueResult, lifecycleSeasonsResult] = await Promise.all([
    source.loadLeague(leagueId),
    source.loadSeasons(leagueId),
  ])

  const leagueResult =
    lifecycleLeagueResult.error &&
    isMissingLifecycleSchema(lifecycleLeagueResult.error)
      ? await source.loadLegacyLeague(leagueId)
      : lifecycleLeagueResult
  const seasonsResult =
    lifecycleSeasonsResult.error &&
    isMissingLifecycleSchema(lifecycleSeasonsResult.error)
      ? await source.loadLegacySeasons(leagueId)
      : lifecycleSeasonsResult

  return { leagueResult, seasonsResult }
}
