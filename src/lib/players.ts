import type { PaymentStatus } from './memberActions'
import { managerIdentityKey } from './managerIdentity'

export interface PlayerMembership {
  division?: string | null
  id: string
  is_active: boolean
  manager_id?: string | null
  manager_name: string
  payment_status: PaymentStatus
  season: string
  team_name: string
}

export interface PlayerDirectoryEntry {
  currentMemberId: string | null
  currentTeamName: string | null
  division: string | null
  isParticipating: boolean
  managerName: string
  managerId: string | null
  paymentStatus: PaymentStatus | null
  seasons: string[]
  sourceMemberId: string
  teamNames: string[]
}

export function buildPlayerDirectory(
  memberships: PlayerMembership[],
  selectedSeason: string,
): PlayerDirectoryEntry[] {
  const sortedMemberships = [...memberships].sort((a, b) => {
    const seasonComparison = b.season.localeCompare(a.season)
    return seasonComparison || a.manager_name.localeCompare(b.manager_name)
  })
  const directory = new Map<
    string,
    PlayerDirectoryEntry & { seasonSet: Set<string>; teamNameSet: Set<string> }
  >()

  sortedMemberships.forEach((membership) => {
    const key = managerIdentityKey(membership)
    const existing = directory.get(key)
    const entry =
      existing ||
      {
        currentMemberId: null,
        currentTeamName: null,
        division: null,
        isParticipating: false,
        managerId: membership.manager_id || null,
        managerName: membership.manager_name.trim(),
        paymentStatus: null,
        seasons: [],
        seasonSet: new Set<string>(),
        sourceMemberId: membership.id,
        teamNames: [],
        teamNameSet: new Set<string>(),
      }

    if (membership.is_active) entry.seasonSet.add(membership.season)
    if (membership.team_name && !entry.teamNameSet.has(membership.team_name)) {
      entry.teamNameSet.add(membership.team_name)
      entry.teamNames.push(membership.team_name)
    }

    if (membership.season === selectedSeason && membership.is_active) {
      entry.currentMemberId = membership.id
      entry.currentTeamName = membership.team_name
      entry.division = membership.division || null
      entry.isParticipating = true
      entry.paymentStatus = membership.payment_status
    }

    directory.set(key, entry)
  })

  return [...directory.values()]
    .map((entry) => ({
      currentMemberId: entry.currentMemberId,
      currentTeamName: entry.currentTeamName,
      division: entry.division,
      isParticipating: entry.isParticipating,
      managerName: entry.managerName,
      managerId: entry.managerId,
      paymentStatus: entry.paymentStatus,
      seasons: [...entry.seasonSet].sort((a, b) => b.localeCompare(a)),
      sourceMemberId: entry.sourceMemberId,
      teamNames: entry.teamNames,
    }))
    .sort((a, b) => a.managerName.localeCompare(b.managerName))
}
