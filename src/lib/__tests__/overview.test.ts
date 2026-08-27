import type { FinanceSnapshot } from '@/lib/financeClient'
import {
  buildOverviewAttentionReasons,
  buildOverviewViewModel,
  type OverviewMember,
} from '@/lib/overview'

const members: OverviewMember[] = [
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
  {
    id: 'member-three',
    manager_name: 'Manager Three',
    payment_status: 'pending',
    team_name: 'Team Three',
  },
]

const settings = {
  draft_food_cost: 20,
  fee_amount: 100,
  playoff_spots: 2,
  playoff_start_week: 15,
  prize_structure: { first: 100 },
  total_weeks: 17,
  weekly_prize_amount: 10,
}

const finance: FinanceSnapshot = {
  awards: [],
  is_commissioner: true,
  payments: [
    {
      expected_amount_cents: 10000,
      id: 'payment-one',
      league_member_id: 'member-one',
      notes: null,
      paid_amount_cents: 10000,
      paid_at: null,
      payment_method: null,
      status: 'paid',
    },
    {
      expected_amount_cents: 10000,
      id: 'payment-two',
      league_member_id: 'member-two',
      notes: null,
      paid_amount_cents: 4000,
      paid_at: null,
      payment_method: null,
      status: 'partial',
    },
  ],
  payouts: [],
  schema_ready: true,
  success: true,
  summary: null,
}

describe('league overview view model', () => {
  it('uses complete weeks, canonical active-player dues, and a standings preview', () => {
    const model = buildOverviewViewModel({
      finance,
      matchups: [
        {
          is_tie: false,
          team1_member_id: 'member-one',
          team1_score: 120,
          team2_member_id: 'member-two',
          team2_score: 100,
          week_number: 1,
          winner_member_id: 'member-one',
        },
      ],
      members,
      scores: [
        { member_id: 'member-one', points: 120, week_number: 1, is_final_score: true },
        { member_id: 'member-two', points: 100, week_number: 1, is_final_score: true },
        { member_id: 'member-three', points: 80, week_number: 1, is_final_score: true },
        { member_id: 'member-one', points: 140, week_number: 2 },
      ],
      settings,
    })

    expect(model).toMatchObject({
      collected: 140,
      expected: 300,
      latestWeek: 1,
      latestWeeklyScore: 120,
      latestWeeklyWinners: ['Team One'],
      outstanding: 160,
      paidMembers: 1,
      partialMembers: 1,
      pendingMembers: 1,
      unallocatedPrizes: 10,
    })
    expect(model.standings[0]).toMatchObject({
      isPlayoffPosition: true,
      row: { member: { id: 'member-one' }, wins: 1 },
      seed: 1,
    })
  })

  it('recognizes a finalized zero-score tie as completed progress', () => {
    const model = buildOverviewViewModel({
      finance: null,
      matchups: [],
      members,
      scores: members.map((member) => ({
        is_final_score: true,
        member_id: member.id,
        points: 0,
        week_number: 1,
      })),
      settings,
    })

    expect(model.latestWeek).toBe(1)
    expect(model.latestWeeklyScore).toBe(0)
    expect(model.latestWeeklyWinners).toHaveLength(3)
  })

  it('builds commissioner attention without mixing it into shared views', () => {
    const overview = buildOverviewViewModel({
      finance,
      matchups: [],
      members,
      scores: [],
      settings,
    })

    expect(
      buildOverviewAttentionReasons({
        financeError: 'Detailed dues unavailable',
        overview,
        seasonConfigError: null,
        syncError: 'The last score sync failed',
      }),
    ).toEqual([
      { label: '2 players have dues needing attention', target: 'players' },
      { label: 'The last score sync failed', target: 'scores' },
      { label: 'Detailed dues unavailable', target: 'players' },
      { label: '$10 remains to be assigned to prizes', target: 'prizes' },
    ])
  })
})
