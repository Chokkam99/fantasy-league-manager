import type { FinanceSnapshot } from '@/lib/financeClient'
import {
  calculatePrizePlan,
  calculateWeeklyPrizeResults,
  type PrizeMember,
  type PrizeScore,
} from '@/lib/prizes'
import {
  calculatePlayoffSeeds,
  calculateStandings,
  orderStandingsByPlayoffPicture,
  resolveDivisionNames,
  type StandingRow,
  type StandingsMatchup,
} from '@/lib/standings'

export interface OverviewMember extends PrizeMember {
  division?: string | null
}

export type OverviewScore = PrizeScore
export type OverviewMatchup = StandingsMatchup

export interface OverviewSeasonSettings {
  divisions?: unknown
  draft_food_cost: number
  fee_amount: number
  playoff_spots: number
  playoff_start_week: number
  prize_structure: object | null
  total_weeks: number
  weekly_prize_amount: number
}

export interface OverviewStanding {
  isDivisionLeader: boolean
  isPlayoffPosition: boolean
  row: StandingRow<OverviewMember>
  seed: number | null
}

export interface OverviewAttentionReason {
  label: string
  target: 'players' | 'prizes' | 'scores'
}

export interface OverviewViewModel {
  collected: number
  draftCost: number
  expected: number
  feeAmount: number
  finalPrizeTotal: number
  latestWeek: number
  latestWeeklyScore: number | null
  latestWeeklyWinners: string[]
  outstanding: number
  paidMembers: number
  partialMembers: number
  pendingMembers: number
  plannedOutflow: number
  seasonProgress: number
  standings: OverviewStanding[]
  totalMembers: number
  unallocatedPrizes: number
  weeklyPrizeTotal: number
}

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

function canonicalDues(
  members: OverviewMember[],
  finance: FinanceSnapshot | null,
  feeAmount: number,
) {
  const paymentByMemberId = new Map(
    (finance?.payments || finance?.dues || []).map((payment) => [
      payment.league_member_id,
      payment,
    ]),
  )

  return members.reduce(
    (summary, member) => {
      const payment = paymentByMemberId.get(member.id)
      const status = payment?.status || member.payment_status || 'pending'
      summary.expected += payment
        ? payment.expected_amount_cents / 100
        : feeAmount
      summary.collected += payment
        ? payment.paid_amount_cents / 100
        : status === 'paid'
          ? feeAmount
          : 0
      if (status === 'paid') summary.paidMembers += 1
      else if (status === 'partial') summary.partialMembers += 1
      else summary.pendingMembers += 1
      return summary
    },
    {
      collected: 0,
      expected: 0,
      paidMembers: 0,
      partialMembers: 0,
      pendingMembers: 0,
    },
  )
}

export function buildOverviewViewModel({
  finance,
  matchups,
  members,
  scores,
  settings,
}: {
  finance: FinanceSnapshot | null
  matchups: OverviewMatchup[]
  members: OverviewMember[]
  scores: OverviewScore[]
  settings: OverviewSeasonSettings
}): OverviewViewModel {
  const moneyPlan = calculatePrizePlan({
    draftCost: settings.draft_food_cost,
    entryFee: settings.fee_amount,
    members,
    prizeStructure: settings.prize_structure,
    totalWeeks: settings.total_weeks,
    weeklyPrizeAmount: settings.weekly_prize_amount,
  })
  const dues = canonicalDues(members, finance, moneyPlan.entryFee)
  const weeklyResults = calculateWeeklyPrizeResults(
    members,
    scores,
    settings.weekly_prize_amount,
    settings.total_weeks,
  )
  const latestResult = weeklyResults.find((result) => result.complete)
  const latestWeek = latestResult?.week || 0
  const regularSeasonEnd = Math.max(1, settings.playoff_start_week - 1)
  const standings = calculateStandings(
    members,
    scores,
    matchups,
    Math.min(latestWeek, regularSeasonEnd),
  )
  const divisions = resolveDivisionNames(settings.divisions, members)
  const seeds = calculatePlayoffSeeds(
    standings,
    divisions,
    settings.playoff_spots,
  )
  const orderedStandings = orderStandingsByPlayoffPicture(standings, seeds)
  const seedsByMemberId = new Map(seeds.map((seed) => [seed.team_id, seed]))
  const unallocatedPrizes = dues.expected - moneyPlan.totalOutflow

  return {
    collected: dues.collected,
    draftCost: moneyPlan.draftCost,
    expected: dues.expected,
    feeAmount: moneyPlan.entryFee,
    finalPrizeTotal: moneyPlan.finalAllocation,
    latestWeek,
    latestWeeklyScore: latestResult?.score ?? null,
    latestWeeklyWinners: latestResult?.winners.map(
      (winner) => winner.team_name || winner.manager_name,
    ) || [],
    outstanding: Math.max(dues.expected - dues.collected, 0),
    paidMembers: dues.paidMembers,
    partialMembers: dues.partialMembers,
    pendingMembers: dues.pendingMembers,
    plannedOutflow: moneyPlan.totalOutflow,
    seasonProgress:
      settings.total_weeks > 0
        ? Math.min((latestWeek / settings.total_weeks) * 100, 100)
        : 0,
    standings: (latestWeek > 0 ? orderedStandings : []).slice(0, 4).map((row) => {
      const seed = seedsByMemberId.get(row.member.id)
      return {
        isDivisionLeader: seed?.is_division_winner || false,
        isPlayoffPosition: Boolean(seed),
        row,
        seed: seed?.seed || null,
      }
    }),
    totalMembers: members.length,
    unallocatedPrizes,
    weeklyPrizeTotal: moneyPlan.weeklyAllocation,
  }
}

export function buildOverviewAttentionReasons({
  financeError,
  overview,
  seasonConfigError,
  syncError,
}: {
  financeError: string | null
  overview: OverviewViewModel
  seasonConfigError: string | null
  syncError: string | null
}): OverviewAttentionReason[] {
  const duesAttention = overview.pendingMembers + overview.partialMembers

  return [
    duesAttention > 0
      ? {
          label: `${duesAttention} ${duesAttention === 1 ? 'player has' : 'players have'} dues needing attention`,
          target: 'players' as const,
        }
      : null,
    syncError
      ? { label: syncError, target: 'scores' as const }
      : null,
    seasonConfigError
      ? { label: seasonConfigError, target: 'players' as const }
      : null,
    financeError
      ? { label: financeError, target: 'players' as const }
      : null,
    Math.abs(overview.unallocatedPrizes) > 0.01
      ? {
          label:
            overview.unallocatedPrizes > 0
              ? `${currency.format(overview.unallocatedPrizes)} remains to be assigned to prizes`
              : `Prizes exceed the available pool by ${currency.format(Math.abs(overview.unallocatedPrizes))}`,
          target: 'prizes' as const,
        }
      : null,
  ].filter((item): item is OverviewAttentionReason => Boolean(item))
}
