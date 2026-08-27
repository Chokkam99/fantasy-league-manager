import type { FinancePayment, FinanceSnapshot } from '@/lib/financeClient'
import {
  buildPlayerDirectory,
  type PlayerDirectoryEntry,
  type PlayerMembership,
} from '@/lib/players'

export type DuesFilter = 'all' | 'paid' | 'partial' | 'pending'
export type PlayerDuesStatus = 'paid' | 'partial' | 'pending'

export interface PlayerRosterEntry extends PlayerDirectoryEntry {
  duesStatus: PlayerDuesStatus
  payment?: FinancePayment
}

export interface PlayerRosterViewModel {
  currentPlayers: PlayerRosterEntry[]
  filteredCurrentPlayers: PlayerRosterEntry[]
  filteredFormerPlayers: PlayerDirectoryEntry[]
  formerPlayers: PlayerDirectoryEntry[]
  paidPlayers: number
  partialPlayers: number
  pendingPlayers: number
  representedSeasons: number
  returningPlayers: number
}

interface PlayerRosterInput {
  duesFilter: DuesFilter
  finance: FinanceSnapshot | null
  isViewOnly: boolean
  memberships: PlayerMembership[]
  search: string
  selectedSeason: string
}

const duesOrder: Record<PlayerDuesStatus, number> = {
  partial: 0,
  pending: 1,
  paid: 2,
}

function matchesSearch(player: PlayerDirectoryEntry, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  if (!normalizedSearch) return true

  return [
    player.managerName,
    player.currentTeamName || '',
    ...player.teamNames,
    ...player.seasons,
  ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
}

export function buildPlayerRosterViewModel({
  duesFilter,
  finance,
  isViewOnly,
  memberships,
  search,
  selectedSeason,
}: PlayerRosterInput): PlayerRosterViewModel {
  const directory = buildPlayerDirectory(memberships, selectedSeason)
  const paymentByMemberId = new Map(
    (finance?.payments || []).map((payment) => [
      payment.league_member_id,
      payment,
    ]),
  )
  const currentPlayers = directory
    .filter((player) => player.isParticipating)
    .map<PlayerRosterEntry>((player) => {
      const payment = player.currentMemberId
        ? paymentByMemberId.get(player.currentMemberId)
        : undefined
      return {
        ...player,
        duesStatus: payment?.status || player.paymentStatus || 'pending',
        payment,
      }
    })
    .sort((a, b) => {
      if (!isViewOnly && a.duesStatus !== b.duesStatus) {
        return duesOrder[a.duesStatus] - duesOrder[b.duesStatus]
      }
      return a.managerName.localeCompare(b.managerName)
    })
  const formerPlayers = directory.filter((player) => !player.isParticipating)
  const paidPlayers = currentPlayers.filter(
    (player) => player.duesStatus === 'paid',
  ).length
  const partialPlayers = currentPlayers.filter(
    (player) => player.duesStatus === 'partial',
  ).length

  return {
    currentPlayers,
    filteredCurrentPlayers: currentPlayers.filter(
      (player) =>
        matchesSearch(player, search) &&
        (isViewOnly || duesFilter === 'all' || player.duesStatus === duesFilter),
    ),
    filteredFormerPlayers: formerPlayers.filter((player) =>
      matchesSearch(player, search),
    ),
    formerPlayers,
    paidPlayers,
    partialPlayers,
    pendingPlayers: currentPlayers.length - paidPlayers - partialPlayers,
    representedSeasons: new Set(
      directory.flatMap((player) => player.seasons),
    ).size,
    returningPlayers: currentPlayers.filter(
      (player) => player.seasons.length > 1,
    ).length,
  }
}
