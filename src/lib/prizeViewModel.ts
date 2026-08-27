import type {
  FinanceAward,
  FinancePayout,
  FinanceSnapshot,
} from '@/lib/financeClient'
import {
  calculatePrizePlan,
  calculateWeeklyPrizeResults,
  getFinalPrizeRules,
  type FinalPrizeRule,
  type PrizeMember,
  type PrizePlan,
  type PrizeScore,
  type WeeklyPrizeResult,
} from '@/lib/prizes'

export interface PrizeSeasonSettings {
  draft_food_cost: number
  fee_amount: number
  final_winners?: Record<string, unknown> | null
  prize_structure: object | null
  total_weeks: number
  weekly_prize_amount: number
}

export interface SeasonAwardView {
  award: FinanceAward | null
  amount: number
  id: string
  label: string
  payout: FinancePayout | null
  recipient: PrizeMember | null
  status: 'awaiting' | 'paid' | 'pending' | 'saved'
}

export interface PrizeViewModel {
  collectedFees: number
  completedWeeklyResults: number
  expectedFees: number
  finalRules: FinalPrizeRule[]
  outstandingFees: number
  paidPlayers: number
  paidPayoutAmount: number
  partialPlayers: number
  prizePlan: PrizePlan
  seasonAwards: SeasonAwardView[]
  usesCanonicalAwards: boolean
  weeklyResults: WeeklyPrizeResult[]
}

export function buildPrizeViewModel({
  finance,
  members,
  scores,
  settings,
}: {
  finance: FinanceSnapshot | null
  members: PrizeMember[]
  scores: PrizeScore[]
  settings: PrizeSeasonSettings
}): PrizeViewModel {
  const configuredPrizePlan = calculatePrizePlan({
    draftCost: settings.draft_food_cost,
    entryFee: settings.fee_amount,
    members,
    prizeStructure: settings.prize_structure,
    totalWeeks: settings.total_weeks,
    weeklyPrizeAmount: settings.weekly_prize_amount,
  })
  const weeklyResults = calculateWeeklyPrizeResults(
    members,
    scores,
    settings.weekly_prize_amount,
    settings.total_weeks,
  )
  const finalRules = getFinalPrizeRules(
    settings.prize_structure,
    settings.final_winners,
    members,
  )
  const membersById = new Map(members.map((member) => [member.id, member]))
  const payoutsByAwardId = new Map(
    (finance?.payouts || []).map((payout) => [payout.award_id, payout]),
  )
  const usesCanonicalAwards = finance?.schema_ready === true
  const expectedFees = finance?.summary
    ? finance.summary.expected_cents / 100
    : configuredPrizePlan.expectedFees
  const collectedFees = finance?.summary
    ? finance.summary.collected_cents / 100
    : configuredPrizePlan.collectedFees
  const outstandingFees = finance?.summary
    ? finance.summary.outstanding_cents / 100
    : configuredPrizePlan.outstandingFees
  const balance = expectedFees - configuredPrizePlan.totalOutflow
  const prizePlan: PrizePlan = {
    ...configuredPrizePlan,
    availablePool: expectedFees - configuredPrizePlan.draftCost,
    balance,
    collectedFees,
    expectedFees,
    outstandingFees,
    status:
      Math.abs(balance) < 0.01
        ? 'balanced'
        : balance > 0
          ? 'unallocated'
          : 'overallocated',
  }
  const seasonAwards: SeasonAwardView[] = usesCanonicalAwards
    ? finance.awards
        .filter(
          (award) =>
            award.award_type === 'final' || award.award_type === 'special',
        )
        .map((award) => {
          const payout = payoutsByAwardId.get(award.id) || null
          return {
            amount: award.planned_amount_cents / 100,
            award,
            id: award.id,
            label: award.label,
            payout,
            recipient: payout
              ? membersById.get(payout.league_member_id) || null
              : null,
            status:
              payout?.status === 'paid'
                ? 'paid'
                : payout
                  ? 'pending'
                  : 'awaiting',
          }
        })
    : finalRules.map((rule) => ({
        amount: rule.amount,
        award: null,
        id: rule.key,
        label: rule.label,
        payout: null,
        recipient: rule.recipient,
        status: rule.recipient ? 'saved' : 'awaiting',
      }))

  return {
    collectedFees,
    completedWeeklyResults: weeklyResults.filter((result) => result.complete)
      .length,
    expectedFees,
    finalRules,
    outstandingFees,
    paidPlayers: finance?.payments
      ? finance.payments.filter((payment) => payment.status === 'paid').length
      : prizePlan.paidPlayers,
    paidPayoutAmount:
      (finance?.payouts || [])
        .filter((payout) => payout.status === 'paid')
        .reduce((total, payout) => total + payout.amount_cents, 0) / 100,
    partialPlayers:
      finance?.payments?.filter((payment) => payment.status === 'partial')
        .length || 0,
    prizePlan,
    seasonAwards,
    usesCanonicalAwards,
    weeklyResults,
  }
}
