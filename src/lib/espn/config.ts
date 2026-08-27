import type { ESPNConfig } from './types'
import { getSeasonTeamMappings } from './team-mapping-config'

type UnknownRecord = Record<string, unknown>

export interface ESPNLeagueConfigurationRecord {
  current_season: string | null
  espn_league_id?: string | null
  espn_s2?: string | null
  espn_swid?: string | null
  platform_config?: unknown
  platform_league_id?: string | null
  platform_type?: string | null
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {}
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function resolveESPNConfig(
  league: ESPNLeagueConfigurationRecord,
): ESPNConfig | null {
  const platformConfig = asRecord(league.platform_config)
  const credentials = asRecord(platformConfig.credentials)
  const usesGenericESPN = league.platform_type === 'espn'
  const canUseLegacyESPN =
    !league.platform_type || league.platform_type === 'manual'

  const leagueId = usesGenericESPN
    ? optionalString(league.platform_league_id) ||
      optionalString(platformConfig.league_id) ||
      optionalString(league.espn_league_id)
    : canUseLegacyESPN
      ? optionalString(league.espn_league_id)
      : undefined

  if (!leagueId) return null

  const season = optionalString(league.current_season)
  if (!season || !/^\d{4}$/.test(season)) return null

  const year = Number.parseInt(season, 10)

  const privateLeague = usesGenericESPN
    ? platformConfig.private_league === true
    : Boolean(league.espn_s2 && league.espn_swid)

  return {
    league_id: leagueId,
    year,
    private_league: privateLeague,
    espn_s2: privateLeague
      ? optionalString(credentials.espn_s2) || optionalString(league.espn_s2)
      : undefined,
    swid: privateLeague
      ? optionalString(credentials.swid) || optionalString(league.espn_swid)
      : undefined,
    team_mappings: getSeasonTeamMappings(league.platform_config, season),
  }
}
