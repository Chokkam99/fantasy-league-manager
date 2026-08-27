import { buildWeeklyRanking, getLatestRecordedWeek } from '@/lib/weeklyRanking'

const members = [
  { id: 'a', manager_name: 'Avery' },
  { id: 'b', manager_name: 'Blake' },
  { id: 'c', manager_name: 'Casey' },
  { id: 'd', manager_name: 'Drew' },
]

describe('weekly score ranking', () => {
  it('uses competition ranks for tied scores', () => {
    const ranking = buildWeeklyRanking(members, [
      { member_id: 'a', points: 100 },
      { member_id: 'b', points: 100 },
      { member_id: 'c', points: 80 },
      { member_id: 'd', points: 70 },
    ])

    expect(ranking.map(({ rank }) => rank)).toEqual([1, 1, 3, 4])
  })

  it('treats zero and negative totals as recorded scores', () => {
    const ranking = buildWeeklyRanking(members, [
      { member_id: 'a', points: 0 },
      { member_id: 'b', points: -4 },
    ])

    expect(ranking.map(({ member, points, rank }) => ({
      id: member.id,
      points,
      rank,
    }))).toEqual([
      { id: 'a', points: 0, rank: 1 },
      { id: 'b', points: -4, rank: 2 },
      { id: 'c', points: null, rank: null },
      { id: 'd', points: null, rank: null },
    ])
  })
})

describe('latest recorded week', () => {
  it('opens the most recent saved week', () => {
    expect(
      getLatestRecordedWeek([
        { week_number: 1 },
        { week_number: 17 },
        { week_number: 8 },
      ]),
    ).toBe(17)
  })

  it('falls back to week one when there are no valid saved weeks', () => {
    expect(getLatestRecordedWeek([])).toBe(1)
    expect(
      getLatestRecordedWeek([
        { week_number: 0 },
        { week_number: Number.NaN },
      ]),
    ).toBe(1)
  })
})
