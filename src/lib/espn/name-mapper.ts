import type { ESPNTeamMappingSnapshot } from './types'

export interface ESPNMemberIdentity {
  firstName: string
  id: string
  lastName: string
}

export interface ESPNTeamIdentity {
  id: number
  name: string
  owners: string[]
}

export interface DatabaseMemberIdentity {
  id: string
  manager_name: string
  team_name: string
}

export interface TeamMapping {
  db_manager_name: string
  db_member_id: string
  db_team_name: string
  espn_owner_name: string
  espn_team_id: number
  espn_team_name: string
  source: 'automatic' | 'saved'
}

export interface TeamMappingResult {
  duplicateMatches: string[]
  mappings: TeamMapping[]
  unmappedDbMembers: DatabaseMemberIdentity[]
  unmappedEspnTeams: ESPNTeamIdentity[]
}

export class ESPNTeamMappingError extends Error {
  readonly snapshot: ESPNTeamMappingSnapshot

  constructor(snapshot: ESPNTeamMappingSnapshot) {
    super('ESPN team mapping needs review before scores can be imported.')
    this.name = 'ESPNTeamMappingError'
    this.snapshot = snapshot
  }
}

export class ESPNNameMapper {
  static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
  }

  static createNameVariations(name: string): string[] {
    const normalized = this.normalizeName(name)
    const variations = [normalized]
    const nameParts = normalized.split(' ').filter((part) => part.length > 1)

    if (nameParts.length > 2) {
      variations.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`)
    }

    if (nameParts.length >= 2) {
      variations.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`)
    }

    return [...new Set(variations)]
  }

  static createTeamMapping(
    espnMembers: ESPNMemberIdentity[],
    espnTeams: ESPNTeamIdentity[],
    dbMembers: DatabaseMemberIdentity[],
    savedMappings: Record<string, string> = {},
  ): TeamMappingResult {
    const mappings: TeamMapping[] = []
    const duplicateMatches: string[] = []
    const espnMemberMap = new Map(espnMembers.map((member) => [member.id, member]))
    const dbMemberMap = new Map(dbMembers.map((member) => [member.id, member]))
    const usedMemberIds = new Set<string>()
    const unresolvedTeams: ESPNTeamIdentity[] = []

    const ownerName = (team: ESPNTeamIdentity) => {
      const owner = espnMemberMap.get(team.owners[0])
      return owner ? `${owner.firstName} ${owner.lastName}`.trim() : ''
    }

    const addMapping = (
      team: ESPNTeamIdentity,
      member: DatabaseMemberIdentity,
      source: TeamMapping['source'],
    ) => {
      mappings.push({
        db_manager_name: member.manager_name,
        db_member_id: member.id,
        db_team_name: member.team_name,
        espn_owner_name: ownerName(team),
        espn_team_id: team.id,
        espn_team_name: team.name,
        source,
      })
      usedMemberIds.add(member.id)
    }

    for (const team of espnTeams) {
      const savedMemberId = savedMappings[String(team.id)]
      if (!savedMemberId) {
        unresolvedTeams.push(team)
        continue
      }

      const member = dbMemberMap.get(savedMemberId)
      if (!member) {
        duplicateMatches.push(
          `Saved ESPN team ${team.id} points to a player who is not active this season.`,
        )
        unresolvedTeams.push(team)
        continue
      }

      if (usedMemberIds.has(member.id)) {
        duplicateMatches.push(
          `More than one ESPN team is assigned to ${member.manager_name}.`,
        )
        unresolvedTeams.push(team)
        continue
      }

      addMapping(team, member, 'saved')
    }

    const dbMemberByNormalizedName = new Map<string, DatabaseMemberIdentity[]>()
    for (const member of dbMembers) {
      if (usedMemberIds.has(member.id)) continue

      for (const variation of this.createNameVariations(member.manager_name)) {
        const matches = dbMemberByNormalizedName.get(variation) || []
        matches.push(member)
        dbMemberByNormalizedName.set(variation, matches)
      }
    }

    const unmappedEspnTeams: ESPNTeamIdentity[] = []
    for (const team of unresolvedTeams) {
      const espnOwnerName = ownerName(team)
      if (!espnOwnerName) {
        unmappedEspnTeams.push(team)
        continue
      }

      const potentialMatches = new Map<string, DatabaseMemberIdentity>()
      for (const variation of this.createNameVariations(espnOwnerName)) {
        for (const member of dbMemberByNormalizedName.get(variation) || []) {
          if (!usedMemberIds.has(member.id)) potentialMatches.set(member.id, member)
        }
      }

      if (potentialMatches.size === 1) {
        addMapping(team, [...potentialMatches.values()][0], 'automatic')
      } else {
        if (potentialMatches.size > 1) {
          duplicateMatches.push(
            `ESPN owner ${espnOwnerName} matches multiple active players.`,
          )
        }
        unmappedEspnTeams.push(team)
      }
    }

    return {
      duplicateMatches,
      mappings,
      unmappedDbMembers: dbMembers.filter((member) => !usedMemberIds.has(member.id)),
      unmappedEspnTeams,
    }
  }

  static validateMapping(result: TeamMappingResult) {
    const errors: string[] = []
    const warnings: string[] = []

    if (result.unmappedEspnTeams.length > 0) {
      errors.push(
        `${result.unmappedEspnTeams.length} ESPN team(s) need a league-player assignment.`,
      )
    }
    if (result.duplicateMatches.length > 0) {
      errors.push(...result.duplicateMatches)
    }
    if (result.unmappedDbMembers.length > 0) {
      warnings.push(
        `${result.unmappedDbMembers.length} active league player(s) are not assigned to ESPN teams.`,
      )
    }

    return {
      errors,
      isValid: errors.length === 0,
      summary: `${result.mappings.length} of ${result.mappings.length + result.unmappedEspnTeams.length} ESPN teams mapped.`,
      warnings,
    }
  }

  static createLookupMap(mappings: TeamMapping[]): Map<number, string> {
    return new Map(
      mappings.map((mapping) => [mapping.espn_team_id, mapping.db_member_id]),
    )
  }

  static createSnapshot(
    result: TeamMappingResult,
    espnMembers: ESPNMemberIdentity[],
    espnTeams: ESPNTeamIdentity[],
    dbMembers: DatabaseMemberIdentity[],
  ): ESPNTeamMappingSnapshot {
    const espnMemberMap = new Map(espnMembers.map((member) => [member.id, member]))

    return {
      assignments: result.mappings.map((mapping) => ({
        espn_team_id: mapping.espn_team_id,
        member_id: mapping.db_member_id,
        source: mapping.source,
      })),
      duplicate_matches: result.duplicateMatches,
      is_complete:
        result.unmappedEspnTeams.length === 0 &&
        result.duplicateMatches.length === 0,
      members: dbMembers.map((member) => ({
        manager_name: member.manager_name,
        member_id: member.id,
        team_name: member.team_name,
      })),
      teams: espnTeams.map((team) => {
        const owner = espnMemberMap.get(team.owners[0])
        return {
          espn_owner_name: owner
            ? `${owner.firstName} ${owner.lastName}`.trim()
            : 'Owner unavailable',
          espn_team_id: team.id,
          espn_team_name: team.name,
        }
      }),
      unmapped_espn_team_ids: result.unmappedEspnTeams.map((team) => team.id),
      unmapped_member_ids: result.unmappedDbMembers.map((member) => member.id),
    }
  }
}
