import {
  calculatePrizePlan,
  calculateWeeklyPrizeResults,
  getFinalPrizeRules,
  type PrizeMember,
} from '../prizes'

const members: PrizeMember[] = [
  {
    id: 'a',
    manager_name: 'Alex',
    team_name: 'A Team',
    payment_status: 'paid',
  },
  {
    id: 'b',
    manager_name: 'Blair',
    team_name: 'B Team',
    payment_status: 'paid',
  },
  {
    id: 'c',
    manager_name: 'Casey',
    team_name: 'C Team',
    payment_status: 'pending',
  },
]

describe('prize calculations', () => {
  it('separates expected, collected, available, and allocated money', () => {
    const plan = calculatePrizePlan({
      members,
      entryFee: 100,
      draftCost: 30,
      weeklyPrizeAmount: 10,
      totalWeeks: 10,
      prizeStructure: { first: 100, second: 50, third: 20 },
    })

    expect(plan.expectedFees).toBe(300)
    expect(plan.collectedFees).toBe(200)
    expect(plan.outstandingFees).toBe(100)
    expect(plan.availablePool).toBe(270)
    expect(plan.weeklyAllocation).toBe(100)
    expect(plan.finalAllocation).toBe(170)
    expect(plan.totalOutflow).toBe(300)
    expect(plan.balance).toBe(0)
    expect(plan.status).toBe('balanced')
  })

  it('reports unallocated and overallocated plans', () => {
    const base = {
      members,
      entryFee: 100,
      draftCost: 0,
      weeklyPrizeAmount: 0,
      totalWeeks: 10,
    }

    expect(
      calculatePrizePlan({ ...base, prizeStructure: { first: 250 } }).status,
    ).toBe('unallocated')
    expect(
      calculatePrizePlan({ ...base, prizeStructure: { first: 350 } }).status,
    ).toBe('overallocated')
  })

  it('derives complete weekly winners, including ties and zero scores', () => {
    const results = calculateWeeklyPrizeResults(
      members,
      [
        { member_id: 'a', week_number: 1, points: 0 },
        { member_id: 'b', week_number: 1, points: -3 },
        { member_id: 'c', week_number: 1, points: 0 },
        { member_id: 'a', week_number: 2, points: 120 },
        { member_id: 'b', week_number: 2, points: 110 },
      ],
      15,
      17,
    )

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      week: 2,
      complete: false,
      winners: [],
    })
    expect(results[1].winners.map((winner) => winner.id)).toEqual(['a', 'c'])
    expect(results[1].score).toBe(0)
    expect(results[1].sharePerWinner).toBe(7.5)
  })

  it('accepts a finalized playoff week with fewer participating teams', () => {
    const [result] = calculateWeeklyPrizeResults(
      members,
      [
        {
          member_id: 'a',
          week_number: 15,
          points: 140,
          is_final_score: true,
        },
        {
          member_id: 'b',
          week_number: 15,
          points: 130,
          week_status: 'completed',
        },
      ],
      10,
      17,
    )

    expect(result).toMatchObject({
      complete: true,
      score: 140,
      recordedTeams: 2,
    })
    expect(result.winners.map((winner) => winner.id)).toEqual(['a'])
  })

  it('treats a partial historical week as finished once a later week exists', () => {
    const results = calculateWeeklyPrizeResults(
      members,
      [
        { member_id: 'a', week_number: 15, points: 140 },
        { member_id: 'b', week_number: 15, points: 130 },
        { member_id: 'a', week_number: 16, points: 150 },
      ],
      10,
      17,
    )

    const week15 = results.find((result) => result.week === 15)
    const week16 = results.find((result) => result.week === 16)

    expect(week15?.complete).toBe(true)
    expect(week15?.winners.map((winner) => winner.id)).toEqual(['a'])
    expect(week16?.complete).toBe(false)
  })

  it('orders configured final awards and resolves saved recipients', () => {
    const rules = getFinalPrizeRules(
      { lowest_weekly: 10, second: 75, first: 150, custom_bonus: 5 },
      { first: 'b', custom_bonus: 'missing' },
      members,
    )

    expect(rules.map((rule) => rule.key)).toEqual([
      'first',
      'second',
      'lowest_weekly',
      'custom_bonus',
    ])
    expect(rules[0].recipient?.team_name).toBe('B Team')
    expect(rules[1].recipientId).toBeNull()
    expect(rules[3]).toMatchObject({
      label: 'Custom Bonus',
      recipientId: 'missing',
      recipient: null,
    })
  })
})
