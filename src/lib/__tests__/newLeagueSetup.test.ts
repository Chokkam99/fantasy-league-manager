import {
  leagueSlug,
  validateNewLeagueSetupRequest,
} from '@/lib/newLeagueSetup'

const validRequest = {
  configuration: {
    divisions: ['East', 'West'],
    draft_food_cost: 50,
    fee_amount: 100,
    playoff_spots: 2,
    playoff_start_week: 15,
    prize_structure: { first: 120, second: 30 },
    total_weeks: 17,
    weekly_prize_amount: 0,
  },
  espn_connection: null,
  id: 'sunday-legends',
  members: [
    { division: 'East', espn_team_id: null, manager_name: ' Alex ', team_name: ' Team A ' },
    { division: 'West', espn_team_id: null, manager_name: 'Blake', team_name: 'Team B' },
  ],
  name: ' Sunday   Legends ',
  season: '2026',
}

describe('new league setup', () => {
  it('creates a readable normalized league slug', () => {
    expect(leagueSlug('  Gridiron Gurus & Friends!  ')).toBe('gridiron-gurus-friends')
  })

  it('normalizes a complete manual first season', () => {
    const result = validateNewLeagueSetupRequest(validRequest)

    expect(result).toMatchObject({
      is_valid: true,
      value: {
        id: 'sunday-legends',
        name: 'Sunday Legends',
        members: [
          { manager_name: 'Alex', team_name: 'Team A' },
          { manager_name: 'Blake', team_name: 'Team B' },
        ],
      },
    })
  })

  it('requires an even, unique roster and a safe slug', () => {
    const result = validateNewLeagueSetupRequest({
      ...validRequest,
      id: 'new',
      members: [validRequest.members[0], validRequest.members[0], validRequest.members[1]],
    })

    expect(result).toMatchObject({ is_valid: false })
    if (result.is_valid) throw new Error('Expected invalid setup')
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('league link'),
      expect.stringContaining('even number'),
      expect.stringContaining('manager'),
      expect.stringContaining('team name'),
    ]))
  })

  it('accepts exact ESPN team assignments and private credentials', () => {
    const result = validateNewLeagueSetupRequest({
      ...validRequest,
      espn_connection: {
        auto_sync_enabled: true,
        espn_s2: 'cookie',
        league_id: '123456',
        private_league: true,
        swid: '{ABC}',
      },
      members: validRequest.members.map((member, index) => ({
        ...member,
        espn_team_id: index + 1,
      })),
    })

    expect(result).toMatchObject({ is_valid: true })
  })

  it('normalizes a pasted ESPN URL before saving the private connection', () => {
    const result = validateNewLeagueSetupRequest({
      ...validRequest,
      espn_connection: {
        auto_sync_enabled: false,
        espn_s2: 'cookie',
        league_id: 'https://fantasy.espn.com/football/team?leagueId=9876543210&teamId=1',
        private_league: true,
        swid: '{ABC}',
      },
      members: validRequest.members.map((member, index) => ({
        ...member,
        espn_team_id: index + 1,
      })),
    })

    expect(result).toMatchObject({
      is_valid: true,
      value: { espn_connection: { league_id: '9876543210' } },
    })
  })
})
