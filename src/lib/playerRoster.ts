import { summarizeFinance, type DuesStatus } from '@/lib/finance'
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
  const duesByMemberId = new Map(
    (finance?.dues || []).map((dues) => [dues.league_member_id, dues]),
  )
  const currentPlayers = directory
    .filter((player) => player.isParticipating)
    .map<PlayerRosterEntry>((player) => {
      const payment = player.currentMemberId
        ? paymentByMemberId.get(player.currentMemberId)
        : undefined
      return {
        ...player,
        duesStatus: payment?.status ||
          (player.currentMemberId ? duesByMemberId.get(player.currentMemberId)?.status : undefined) ||
          player.paymentStatus || 'pending',
        payment,
      }
    })
    .sort((a, b) => a.managerName.localeCompare(b.managerName))
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

export function applyConfirmedPaymentStatus({
  finance,
  memberId,
  memberships,
  notes,
  paidAmountCents,
  paymentMethod,
  status,
}: {
  finance: FinanceSnapshot | null
  memberId: string
  memberships: PlayerMembership[]
  notes?: string | null
  paidAmountCents?: number | null
  paymentMethod?: string | null
  status: DuesStatus
}) {
  const nextMemberships = memberships.map((membership) =>
    membership.id === memberId
      ? {
          ...membership,
          payment_status: status === 'paid' ? 'paid' as const : 'pending' as const,
        }
      : membership,
  )

  if (!finance?.payments) {
    return { finance, memberships: nextMemberships }
  }

  const nextPayments = finance.payments.map((payment) => {
    if (payment.league_member_id !== memberId) return payment

    const nextPaidAmount =
      status === 'pending'
        ? 0
        : status === 'paid'
          ? paidAmountCents ?? payment.expected_amount_cents
          : paidAmountCents ?? payment.paid_amount_cents

    return {
      ...payment,
      notes: notes === undefined ? payment.notes : notes,
      paid_amount_cents: nextPaidAmount,
      paid_at:
        status === 'paid'
          ? payment.paid_at || new Date().toISOString()
          : null,
      payment_method:
        paymentMethod === undefined ? payment.payment_method : paymentMethod,
      status,
    }
  })

  return {
    finance: {
      ...finance,
      payments: nextPayments,
      summary: summarizeFinance({ payments: nextPayments, payouts: finance.payouts }),
    },
    memberships: nextMemberships,
  }
}
