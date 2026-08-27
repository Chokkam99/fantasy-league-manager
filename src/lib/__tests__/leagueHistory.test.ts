/** @jest-environment node */

import { buildLeagueHistoryRows } from '@/lib/leagueHistory'

const members = [
  {
    division: 'East',
    id: 'alpha-2025',
    manager_name: 'Alex',
    season: '2025',
    team_name: 'Alpha',
  },
  {
    division: 'West',
    id: 'bravo-2025',
    manager_name: 'Blair',
    season: '2025',
    team_name: 'Bravo',
  },
  {
    division: 'East',
    id: 'charlie-2025',
    manager_name: 'Casey',
    season: '2025',
    team_name: 'Charlie',
  },
  {
    division: null,
    id: 'alpha-2026',
    manager_name: 'Alex',
    season: '2026',
    team_name: 'New Alpha',
  },
]

describe('league history summary', () => {
  it('summarizes every season newest-first with saved final placements', () => {
    const rows = buildLeagueHistoryRows({
      matchups: [
        {
          is_tie: false,
          season: '2025',
          team1_member_id: 'alpha-2025',
          team1_score: 120,
          team2_member_id: 'bravo-2025',
          team2_score: 100,
          week_number: 1,
          winner_member_id: 'alpha-2025',
        },
      ],
      members,
      scores: [
        { member_id: 'alpha-2025', points: 120, season: '2025', week_number: 1 },
        { member_id: 'bravo-2025', points: 100, season: '2025', week_number: 1 },
        { member_id: 'charlie-2025', points: 90, season: '2025', week_number: 1 },
      ],
      seasons: [
        {
          divisions: ['East', 'West'],
          final_winners: {
            first: 'bravo-2025',
            second: 'alpha-2025',
            third: 'charlie-2025',
          },
          playoff_spots: 2,
          playoff_start_week: 15,
          season: '2025',
          total_weeks: 17,
        },
        {
          divisions: [],
          final_winners: null,
          playoff_spots: 1,
          playoff_start_week: 15,
          season: '2026',
          total_weeks: 17,
        },
      ],
    })

    expect(rows.map((row) => row.season)).toEqual(['2026', '2025'])
    expect(rows[0]).toMatchObject({ champion: null, status: 'in-progress' })
    expect(rows[1]).toMatchObject({
      champion: { team_name: 'Bravo' },
      runnerUp: { team_name: 'Alpha' },
      status: 'complete',
      thirdPlace: { team_name: 'Charlie' },
    })
    expect(rows[1].playoffTeams.map((member) => member.id)).toEqual([
      'alpha-2025',
      'bravo-2025',
    ])
  })

  it('does not confuse the same manager’s team IDs across seasons', () => {
    const [row] = buildLeagueHistoryRows({
      matchups: [],
      members,
      scores: [],
      seasons: [
        {
          divisions: [],
          final_winners: { first: 'alpha-2026' },
          playoff_spots: 1,
          playoff_start_week: 15,
          season: '2026',
          total_weeks: 17,
        },
      ],
    })

    expect(row.champion?.team_name).toBe('New Alpha')
    expect(row.playoffTeams).toHaveLength(1)
    expect(row.playoffTeams[0].season).toBe('2026')
  })
})
