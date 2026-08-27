import {
  calculatePlayoffSeeds,
  calculateStandings,
  orderStandingsByPlayoffPicture,
  resolveDivisionNames,
} from '@/lib/standings'

const members = [
  { division: 'East', id: 'a', manager_name: 'Avery', team_name: 'A' },
  { division: 'East', id: 'b', manager_name: 'Blake', team_name: 'B' },
  { division: 'West', id: 'c', manager_name: 'Casey', team_name: 'C' },
  { division: 'West', id: 'd', manager_name: 'Drew', team_name: 'D' },
]

describe('standings calculations', () => {
  it('orders by winning percentage, then points, and counts ties', () => {
    const standings = calculateStandings(
      members,
      [
        { member_id: 'a', points: 100, week_number: 1 },
        { member_id: 'b', points: 120, week_number: 1 },
        { member_id: 'c', points: 90, week_number: 1 },
        { member_id: 'd', points: 0, week_number: 1 },
      ],
      [
        {
          is_tie: true,
          team1_member_id: 'a',
          team1_score: 100,
          team2_member_id: 'b',
          team2_score: 100,
          week_number: 1,
          winner_member_id: null,
        },
        {
          is_tie: false,
          team1_member_id: 'c',
          team1_score: 90,
          team2_member_id: 'd',
          team2_score: 0,
          week_number: 1,
          winner_member_id: 'c',
        },
      ],
      1,
    )

    expect(standings.map((row) => row.member.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(standings.find((row) => row.member.id === 'a')).toMatchObject({
      losses: 0,
      ties: 1,
      wins: 0,
    })
    expect(standings.find((row) => row.member.id === 'd')?.points_for).toBe(0)
  })

  it('splits weekly wins when the high score is tied', () => {
    const standings = calculateStandings(
      members,
      [
        { member_id: 'a', points: 120, week_number: 1 },
        { member_id: 'b', points: 120, week_number: 1 },
      ],
      [],
      1,
    )

    expect(standings.find((row) => row.member.id === 'a')?.weekly_wins).toBe(0.5)
    expect(standings.find((row) => row.member.id === 'b')?.weekly_wins).toBe(0.5)
  })

  it('seeds division winners before wildcards and keeps the cut line contiguous', () => {
    const standings = calculateStandings(
      members,
      members.map((member, index) => ({
        member_id: member.id,
        points: 200 - index * 10,
        week_number: 1,
      })),
      [],
      1,
    )
    const seeds = calculatePlayoffSeeds(standings, ['East', 'West'], 3)
    const ordered = orderStandingsByPlayoffPicture(standings, seeds)

    expect(seeds).toEqual([
      expect.objectContaining({ is_division_winner: true, team_id: 'a' }),
      expect.objectContaining({ is_division_winner: true, team_id: 'c' }),
      expect.objectContaining({ is_division_winner: false, team_id: 'b' }),
    ])
    expect(ordered.slice(0, 3).map((row) => row.member.id)).toEqual(['a', 'c', 'b'])
  })

  it('combines configured and assigned division names without duplicates', () => {
    expect(resolveDivisionNames({ divisions: ['East'] }, members)).toEqual([
      'East',
      'West',
    ])
  })
})
