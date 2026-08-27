import type { ESPNTeamMappingSnapshot } from './types'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

export function getSeasonTeamMappings(
  platformConfig: unknown,
  season: string,
): Record<string, string> {
  const allMappings = asRecord(asRecord(platformConfig).team_mappings)
  const seasonMappings = asRecord(allMappings[season])

  return Object.fromEntries(
    Object.entries(seasonMappings).filter(
      ([espnTeamId, memberId]) =>
        /^\d+$/.test(espnTeamId) &&
        typeof memberId === 'string' &&
        Boolean(memberId.trim()),
    ),
  ) as Record<string, string>
}

export function withSeasonTeamMappings(
  platformConfig: unknown,
  season: string,
  mappings: Record<string, string>,
): UnknownRecord {
  const config = asRecord(platformConfig)
  const allMappings = asRecord(config.team_mappings)

  return {
    ...config,
    team_mappings: {
      ...allMappings,
      [season]: { ...mappings },
    },
  }
}

export function parseTeamMappingInput(
  value: unknown,
): Record<string, string> | null {
  const input = asRecord(value)
  const entries = Object.entries(input)

  if (
    entries.length === 0 ||
    entries.some(
      ([espnTeamId, memberId]) =>
        !/^\d+$/.test(espnTeamId) ||
        typeof memberId !== 'string' ||
        !memberId.trim(),
    )
  ) {
    return null
  }

  return Object.fromEntries(
    entries.map(([espnTeamId, memberId]) => [
      espnTeamId,
      (memberId as string).trim(),
    ]),
  )
}

export function isCompleteTeamMappingSubmission(
  snapshot: ESPNTeamMappingSnapshot,
  mappings: Record<string, string>,
): boolean {
  const actualTeamIds = new Set(
    snapshot.teams.map((team) => String(team.espn_team_id)),
  )
  const submittedTeamIds = Object.keys(mappings)
  const assignedMemberIds = Object.values(mappings)

  return (
    snapshot.is_complete &&
    submittedTeamIds.length === actualTeamIds.size &&
    submittedTeamIds.every((teamId) => actualTeamIds.has(teamId)) &&
    new Set(assignedMemberIds).size === assignedMemberIds.length
  )
}
