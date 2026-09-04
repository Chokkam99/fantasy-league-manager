import {
  isValidESPNLeagueId,
  normalizeESPNLeagueId,
} from '@/lib/automationSettings'
import {
  validateSeasonRolloverRequest,
  type SeasonMemberSetup,
  type SeasonSetupConfiguration,
} from '@/lib/seasonRollover'

export interface NewLeagueMemberSetup extends Omit<SeasonMemberSetup, 'source_member_id'> {
  espn_team_id: number | null
}

export interface NewLeagueESPNConnection {
  auto_sync_enabled: boolean
  espn_s2?: string
  league_id: string
  private_league: boolean
  swid?: string
}

export interface NewLeagueSetupRequest {
  configuration: SeasonSetupConfiguration
  espn_connection: NewLeagueESPNConnection | null
  id: string
  members: NewLeagueMemberSetup[]
  name: string
  season: string
}

export type NewLeagueSetupValidation =
  | { errors: string[]; is_valid: false }
  | { is_valid: true; value: NewLeagueSetupRequest }

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function optionalCredential(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function leagueSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

export function validateNewLeagueSetupRequest(
  input: unknown,
): NewLeagueSetupValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['The league setup request must be an object.'], is_valid: false }
  }

  const body = input as Record<string, unknown>
  const name = normalizeText(body.name)
  const id = typeof body.id === 'string' ? body.id.trim().toLocaleLowerCase() : ''
  const season = typeof body.season === 'string' ? body.season.trim() : ''
  const errors: string[] = []

  if (!name || name.length > 100) {
    errors.push('Enter a league name of 100 characters or fewer.')
  }
  if (!SLUG_PATTERN.test(id) || id.length > 64 || id === 'new') {
    errors.push('Choose a league link using lowercase letters, numbers, and single hyphens.')
  }
  if (!/^\d{4}$/.test(season)) {
    errors.push('Enter a four-digit season start year.')
  }

  const previousSeason = /^\d{4}$/.test(season)
    ? String(Number.parseInt(season, 10) - 1).padStart(4, '0')
    : '0000'
  const rawMembers = Array.isArray(body.members) ? body.members : []
  const rolloverValidation = validateSeasonRolloverRequest(
    {
      configuration: body.configuration,
      confirmed: true,
      members: rawMembers.map((member) => {
        const record = member && typeof member === 'object' && !Array.isArray(member)
          ? member as Record<string, unknown>
          : {}
        return {
          division: record.division,
          manager_name: record.manager_name,
          source_member_id: null,
          team_name: record.team_name,
        }
      }),
      source_season: previousSeason,
      target_season: season,
    },
    previousSeason,
  )

  if (!rolloverValidation.is_valid) errors.push(...rolloverValidation.errors)

  const espnTeamIds: Array<number | null> = rawMembers.map((member) => {
    if (!member || typeof member !== 'object' || Array.isArray(member)) return null
    const value = (member as Record<string, unknown>).espn_team_id
    return value === null || value === undefined ? null : Number(value)
  })
  if (espnTeamIds.some((teamId) => teamId !== null && (!Number.isSafeInteger(teamId) || teamId <= 0))) {
    errors.push('Every ESPN team assignment must use a valid team ID.')
  }
  const assignedTeamIds = espnTeamIds.filter((teamId): teamId is number => teamId !== null)
  if (new Set(assignedTeamIds).size !== assignedTeamIds.length) {
    errors.push('Each ESPN team can only be included once.')
  }

  const normalizedTeamNames = rawMembers.map((member) => {
    if (!member || typeof member !== 'object' || Array.isArray(member)) return ''
    return normalizeText((member as Record<string, unknown>).team_name).toLocaleLowerCase()
  })
  if (new Set(normalizedTeamNames).size !== normalizedTeamNames.length) {
    errors.push('Each team name must be unique within the season.')
  }

  let espnConnection: NewLeagueESPNConnection | null = null
  if (body.espn_connection !== null && body.espn_connection !== undefined) {
    if (
      typeof body.espn_connection !== 'object' ||
      Array.isArray(body.espn_connection)
    ) {
      errors.push('The ESPN connection must be configured correctly.')
    } else {
      const connection = body.espn_connection as Record<string, unknown>
      const leagueId = typeof connection.league_id === 'string'
        ? normalizeESPNLeagueId(connection.league_id)
        : ''
      const privateLeague = connection.private_league
      const autoSyncEnabled = connection.auto_sync_enabled
      const espnS2 = optionalCredential(connection.espn_s2)
      const swid = optionalCredential(connection.swid)

      if (!isValidESPNLeagueId(leagueId)) errors.push('Enter a valid ESPN league URL or numeric league ID.')
      if (typeof privateLeague !== 'boolean') errors.push('Choose whether the ESPN league is private.')
      if (typeof autoSyncEnabled !== 'boolean') errors.push('Choose whether automatic sync is enabled.')
      if (privateLeague === true && (!espnS2 || !swid)) {
        errors.push('Private ESPN leagues require both ESPN_S2 and SWID cookies.')
      }
      if ((espnS2?.length || 0) > 4096) errors.push('ESPN_S2 is too long.')
      if ((swid?.length || 0) > 256) errors.push('SWID is too long.')

      espnConnection = {
        auto_sync_enabled: autoSyncEnabled === true,
        espn_s2: espnS2,
        league_id: leagueId,
        private_league: privateLeague === true,
        swid,
      }
    }
  }

  if (errors.length > 0 || !rolloverValidation.is_valid) {
    return { errors: [...new Set(errors)], is_valid: false }
  }

  return {
    is_valid: true,
    value: {
      configuration: rolloverValidation.value.configuration,
      espn_connection: espnConnection,
      id,
      members: rolloverValidation.value.members.map((member, index) => ({
        division: member.division,
        espn_team_id: espnTeamIds[index],
        manager_name: member.manager_name,
        team_name: member.team_name,
      })),
      name,
      season,
    },
  }
}
