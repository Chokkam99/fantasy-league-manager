import type { ESPNAPIResponse, ESPNTeamData } from '@/lib/espn/types'

export interface ESPNOnboardingTeam {
  manager_name: string
  team_id: number
  team_name: string
}

export interface ESPNOnboardingSnapshot {
  league_name: string
  teams: ESPNOnboardingTeam[]
}

function normalizedName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function teamName(team: ESPNTeamData) {
  return (
    normalizedName(team.name) ||
    normalizedName([team.location, team.nickname].filter(Boolean).join(' ')) ||
    `Team ${team.id}`
  )
}

export function parseESPNOnboardingSnapshot(
  data: ESPNAPIResponse,
): ESPNOnboardingSnapshot | null {
  if (!data.settings || !Array.isArray(data.teams) || data.teams.length === 0) {
    return null
  }

  const memberNames = new Map(
    (data.members || []).map((member) => [
      member.id,
      normalizedName(`${member.firstName || ''} ${member.lastName || ''}`),
    ]),
  )
  const teams = data.teams.flatMap((team) => {
    if (!Number.isSafeInteger(team.id) || team.id <= 0) return []
    const primaryOwner = typeof team.primaryOwner === 'string'
      ? team.primaryOwner
      : Array.isArray(team.owners) && typeof team.owners[0] === 'string'
        ? team.owners[0]
        : ''

    return [{
      manager_name: memberNames.get(primaryOwner) || '',
      team_id: team.id,
      team_name: teamName(team),
    }]
  })

  if (teams.length === 0) return null

  return {
    league_name: normalizedName(data.settings.name) || 'ESPN League',
    teams: teams.sort((left, right) => left.team_id - right.team_id),
  }
}
