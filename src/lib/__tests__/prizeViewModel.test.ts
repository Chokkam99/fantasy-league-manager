import type { FinanceSnapshot } from '@/lib/financeClient'
import type { PrizeMember } from '@/lib/prizes'
import { buildPrizeViewModel } from '@/lib/prizeViewModel'

const members: PrizeMember[] = [
  {
    id: 'member-one',
    manager_name: 'Manager One',
    payment_status: 'paid',
    team_name: 'Team One',
  },
  {
    id: 'member-two',
    manager_name: 'Manager Two',
    payment_status: 'pending',
    team_name: 'Team Two',
  },
]

const settings = {
  draft_food_cost: 20,
  fee_amount: 100,
  final_winners: { first: 'member-one' },
  prize_structure: { first: 100, second: 60 },
  total_weeks: 2,
  weekly_prize_amount: 10,
}

describe('prize page view model', () => {
  it('falls back to configured dues and saved winners before finance migration', () => {
    const model = buildPrizeViewModel({
      finance: {
        awards: [],
        is_commissioner: true,
        payouts: [],
        schema_ready: false,
        success: true,
        summary: null,
      },
      members,
      scores: [],
      settings,
    })

    expect(model).toMatchObject({
      collectedFees: 100,
      expectedFees: 200,
      outstandingFees: 100,
      paidPlayers: 1,
      partialPlayers: 0,
      usesCanonicalAwards: false,
    })
    expect(model.seasonAwards[0]).toMatchObject({
      label: '1st place',
      recipient: { id: 'member-one' },
      status: 'saved',
    })
  })

  it('uses canonical cents, recipients, and payout state when available', () => {
    const finance: FinanceSnapshot = {
      awards: [
        {
          award_key: 'final:first',
          award_type: 'final',
          category_key: 'first',
          id: 'award-one',
          label: 'Champion',
          planned_amount_cents: 12000,
          week_number: null,
        },
        {
          award_key: 'weekly:1',
          award_type: 'weekly',
          category_key: 'weekly',
          id: 'award-weekly',
          label: 'Week 1',
          planned_amount_cents: 1000,
          week_number: 1,
        },
      ],
      is_commissioner: true,
      payments: [
        {
          expected_amount_cents: 10000,
          id: 'payment-one',
          league_member_id: 'member-one',
          notes: null,
          paid_amount_cents: 5000,
          paid_at: null,
          payment_method: null,
          status: 'partial',
        },
      ],
      payouts: [
        {
          amount_cents: 12000,
          award_id: 'award-one',
          id: 'payout-one',
          league_member_id: 'member-two',
          paid_at: '2026-01-01T00:00:00.000Z',
          status: 'paid',
        },
      ],
      schema_ready: true,
      success: true,
      summary: {
        collected_cents: 5000,
        expected_cents: 10000,
        outstanding_cents: 5000,
        paid_payouts_cents: 12000,
        pending_payouts_cents: 0,
        planned_payouts_cents: 12000,
        projected_balance_cents: -7000,
      },
    }

    const model = buildPrizeViewModel({ finance, members, scores: [], settings })

    expect(model).toMatchObject({
      collectedFees: 50,
      expectedFees: 100,
      outstandingFees: 50,
      paidPayoutAmount: 120,
      partialPlayers: 1,
      usesCanonicalAwards: true,
    })
    expect(model.seasonAwards).toHaveLength(1)
    expect(model.seasonAwards[0]).toMatchObject({
      amount: 120,
      recipient: { id: 'member-two' },
      status: 'paid',
    })
  })

  it('builds a compact per-player tally from weekly and season awards', () => {
    const model = buildPrizeViewModel({
      finance: null,
      members,
      scores: [
        { member_id: 'member-one', points: 120, week_number: 1 },
        { member_id: 'member-two', points: 100, week_number: 1 },
        { member_id: 'member-one', points: 90, week_number: 2 },
        { member_id: 'member-two', points: 90, week_number: 2 },
      ],
      settings,
    })

    expect(model.playerWinnings).toEqual([
      expect.objectContaining({
        finalAmount: 100,
        totalAmount: 115,
        weeklyAmount: 15,
        weeklyWins: [1, 2],
      }),
      expect.objectContaining({
        finalAmount: 0,
        totalAmount: 5,
        weeklyAmount: 5,
        weeklyWins: [2],
      }),
    ])
  })
})
