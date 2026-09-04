/** @jest-environment node */

import {
  buildLeagueHistoryMatrix,
  buildLeagueHistoryRows,
} from '@/lib/leagueHistory'

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
          week_number: 14,
          winner_member_id: 'alpha-2025',
        },
      ],
      members,
      scores: [
        { member_id: 'alpha-2025', points: 120, season: '2025', week_number: 14 },
        { member_id: 'bravo-2025', points: 100, season: '2025', week_number: 14 },
        { member_id: 'charlie-2025', points: 90, season: '2025', week_number: 14 },
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
      scores: [
        {
          member_id: 'alpha-2026',
          points: 100,
          season: '2026',
          week_number: 14,
        },
      ],
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

  it('does not project playoff teams before the regular-season cutoff', () => {
    const baseSnapshot = {
      matchups: [],
      members: members.filter((member) => member.season === '2025'),
      seasons: [
        {
          divisions: ['East', 'West'],
          final_winners: null,
          playoff_spots: 2,
          playoff_start_week: 15,
          season: '2025',
          total_weeks: 17,
        },
      ],
    }

    const [emptySeason] = buildLeagueHistoryRows({
      ...baseSnapshot,
      scores: [],
    })
    const [beforeCutoff] = buildLeagueHistoryRows({
      ...baseSnapshot,
      scores: [
        {
          member_id: 'alpha-2025',
          points: 120,
          season: '2025',
          week_number: 13,
        },
      ],
    })
    const [atCutoff] = buildLeagueHistoryRows({
      ...baseSnapshot,
      scores: [
        {
          member_id: 'alpha-2025',
          points: 120,
          season: '2025',
          week_number: 14,
        },
      ],
    })

    expect(emptySeason.playoffTeams).toEqual([])
    expect(beforeCutoff.playoffTeams).toEqual([])
    expect(atCutoff.playoffTeams).toHaveLength(2)
  })

  it('keeps one manager row across team-name changes and summarizes each result', () => {
    const delta = {
      division: 'West',
      id: 'delta-2025',
      manager_id: 'manager-delta',
      manager_name: 'Devon',
      season: '2025',
      team_name: 'Delta',
    }
    const stableMembers = members.map((member) => ({
      ...member,
      manager_id:
        member.manager_name === 'Alex'
          ? 'manager-alex'
          : `manager-${member.manager_name.toLowerCase()}`,
    }))
    const matrix = buildLeagueHistoryMatrix(
      {
        matchups: [],
        members: [...stableMembers, delta],
        scores: [],
        seasons: [],
      },
      [
        {
          champion: null,
          playoffTeams: [],
          runnerUp: null,
          season: '2026',
          status: 'in-progress',
          thirdPlace: null,
        },
        {
          champion: stableMembers[1],
          playoffTeams: [stableMembers[0], stableMembers[1], delta],
          runnerUp: stableMembers[0],
          season: '2025',
          status: 'complete',
          thirdPlace: stableMembers[2],
        },
      ],
    )

    const alex = matrix.find((player) => player.managerName === 'Alex')
    expect(alex?.cells).toMatchObject({
      '2025': { result: 'runner-up', teamName: 'Alpha' },
      '2026': { result: 'participant', teamName: 'New Alpha' },
    })
    expect(matrix.find((player) => player.managerName === 'Blair')?.cells['2025'].result).toBe('champion')
    expect(matrix.find((player) => player.managerName === 'Casey')?.cells['2025'].result).toBe('third')
    expect(matrix.find((player) => player.managerName === 'Devon')?.cells['2025'].result).toBe('playoff')
  })
})
